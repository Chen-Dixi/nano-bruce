import type { AgentTool } from "@nano-bruce/agent-core";
import { Type } from "@sinclair/typebox";
import { constants } from "node:fs";
import { access as fsAccess, readFile as fsReadFile, writeFile as fsWriteFile } from "node:fs/promises";
import {
  detectLineEnding,
  fuzzyFindText,
  generateDiffString,
  normalizeForFuzzyMatch,
  normalizeToLF,
  restoreLineEndings,
  stripBom,
} from "./edit-diff.js";
import { resolveToCwd } from "./path-utils.js";

const editSchema = Type.Object({
  path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
  oldText: Type.String({ description: "Exact text to find and replace" }),
  newText: Type.String({ description: "New text to replace the old text with" }),
});

export interface EditToolDetails {
  diff: string;
  firstChangedLine?: number;
}

export interface EditOperations {
  readFile: (absolutePath: string) => Promise<Buffer>;
  writeFile: (absolutePath: string, content: string) => Promise<void>;
  access: (absolutePath: string) => Promise<void>;
}

const defaultEditOperations: EditOperations = {
  readFile: (path) => fsReadFile(path),
  writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
  access: (path) => fsAccess(path, constants.R_OK | constants.W_OK),
};

export interface EditToolOptions {
  operations?: EditOperations;
}

export function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<typeof editSchema, EditToolDetails> {
  const ops = options?.operations ?? defaultEditOperations;

  return {
    name: "edit",
    label: "Edit",
    description:
      "Edit a file by replacing exact text. oldText must match exactly (including whitespace). Use for precise edits.",
    parameters: editSchema,
    execute: async (_toolCallId, { path, oldText, newText }, signal?) => {
      const absolutePath = resolveToCwd(path, cwd);
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
            const rawContent = buffer.toString("utf-8");
            const { bom, text: content } = stripBom(rawContent);
            const originalEnding = detectLineEnding(content);
            const normalizedContent = normalizeToLF(content);
            const normalizedOldText = normalizeToLF(oldText);
            const normalizedNewText = normalizeToLF(newText);
            const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);

            if (!matchResult.found) {
              reject(new Error(`Could not find the exact text in ${path}. oldText must match exactly.`));
              return;
            }
            const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
            const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
            const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
            if (occurrences > 1) {
              reject(new Error(`Found ${occurrences} occurrences in ${path}. Make oldText unique.`));
              return;
            }
            if (aborted) return;
            const baseContent = matchResult.contentForReplacement;
            const newContent =
              baseContent.substring(0, matchResult.index) +
              normalizedNewText +
              baseContent.substring(matchResult.index + matchResult.matchLength);
            if (baseContent === newContent) {
              reject(new Error(`No changes made to ${path}. Replacement produced identical content.`));
              return;
            }
            const finalContent = bom + restoreLineEndings(newContent, originalEnding);
            await ops.writeFile(absolutePath, finalContent);
            if (aborted) return;
            if (signal) signal.removeEventListener("abort", onAbort);
            const diffResult = generateDiffString(baseContent, newContent);
            resolve({
              content: `Replaced text in ${path}.`,
              details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine },
            });
          } catch (err) {
            if (signal) signal.removeEventListener("abort", onAbort);
            if (!aborted) reject(err);
          }
        })();
      });
    },
  };
}
