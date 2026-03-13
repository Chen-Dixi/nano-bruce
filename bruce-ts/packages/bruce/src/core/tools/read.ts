import type { AgentTool } from "@nano-bruce/agent-core";
import { Type } from "@sinclair/typebox";
import { constants } from "node:fs";
import { access as fsAccess, readFile as fsReadFile } from "node:fs/promises";
import { resolveReadPath } from "./path-utils.js";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  type TruncationResult,
  truncateHead,
} from "./truncate.js";

const readSchema = Type.Object({
  path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
  offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

export interface ReadToolDetails {
  truncation?: TruncationResult;
}

export interface ReadOperations {
  readFile: (absolutePath: string) => Promise<Buffer>;
  access: (absolutePath: string) => Promise<void>;
}

const defaultReadOperations: ReadOperations = {
  readFile: (path) => fsReadFile(path),
  access: (path) => fsAccess(path, constants.R_OK),
};

export interface ReadToolOptions {
  operations?: ReadOperations;
}

export function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<typeof readSchema, ReadToolDetails> {
  const ops = options?.operations ?? defaultReadOperations;

  return {
    name: "read",
    label: "Read",
    description: `Read the contents of a text file. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB. Use offset/limit for large files.`,
    parameters: readSchema,
    execute: async (_toolCallId, { path, offset, limit }, signal?) => {
      const absolutePath = resolveReadPath(path, cwd);
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Operation aborted"));
          return;
        }
        let aborted = false;
        const onAbort = () => {
          aborted = true;
          reject(new Error("Operation aborted"));
        };
        if (signal) signal.addEventListener("abort", onAbort, { once: true });

        (async () => {
          try {
            await ops.access(absolutePath);
            if (aborted) return;
            const buffer = await ops.readFile(absolutePath);
            const textContent = buffer.toString("utf-8");
            const allLines = textContent.split("\n");
            const totalFileLines = allLines.length;
            const startLine = offset ? Math.max(0, offset - 1) : 0;
            const startLineDisplay = startLine + 1;
            if (startLine >= allLines.length) {
              throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
            }
            let selectedContent: string;
            let userLimitedLines: number | undefined;
            if (limit !== undefined) {
              const endLine = Math.min(startLine + limit, allLines.length);
              selectedContent = allLines.slice(startLine, endLine).join("\n");
              userLimitedLines = endLine - startLine;
            } else {
              selectedContent = allLines.slice(startLine).join("\n");
            }
            const truncation = truncateHead(selectedContent);
            let outputText: string;
            let details: ReadToolDetails | undefined;

            if (truncation.firstLineExceedsLimit) {
              const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine], "utf-8"));
              outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit.]`;
              details = { truncation };
            } else if (truncation.truncated) {
              const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
              const nextOffset = endLineDisplay + 1;
              outputText = truncation.content;
              if (truncation.truncatedBy === "lines") {
                outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
              } else {
                outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
              }
              details = { truncation };
            } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
              const remaining = allLines.length - (startLine + userLimitedLines);
              const nextOffset = startLine + userLimitedLines + 1;
              outputText = truncation.content + `\n\n[${remaining} more lines. Use offset=${nextOffset} to continue.]`;
            } else {
              outputText = truncation.content;
            }
            if (aborted) return;
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve({ content: outputText, details });
          } catch (err) {
            if (signal) signal.removeEventListener("abort", onAbort);
            if (!aborted) reject(err);
          }
        })();
      });
    },
  };
}
