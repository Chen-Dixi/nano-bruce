import type { AgentTool } from "@nano-bruce/agent-core";
import { Type } from "@sinclair/typebox";
import { dirname } from "node:path";
import { mkdir as fsMkdir, writeFile as fsWriteFile } from "node:fs/promises";
import { resolveToCwd } from "./path-utils.js";

const writeSchema = Type.Object({
  path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
  content: Type.String({ description: "Content to write to the file" }),
});

export interface WriteOperations {
  writeFile: (absolutePath: string, content: string) => Promise<void>;
  mkdir: (dir: string) => Promise<void>;
}

const defaultWriteOperations: WriteOperations = {
  writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
  mkdir: (dir) => fsMkdir(dir, { recursive: true }).then(() => {}),
};

export interface WriteToolOptions {
  operations?: WriteOperations;
}

export function createWriteTool(cwd: string, options?: WriteToolOptions): AgentTool<typeof writeSchema> {
  const ops = options?.operations ?? defaultWriteOperations;

  return {
    name: "write",
    label: "Write",
    description:
      "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories as needed.",
    parameters: writeSchema,
    execute: async (_toolCallId, { path, content }, signal?) => {
      const absolutePath = resolveToCwd(path, cwd);
      const dir = dirname(absolutePath);
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
            await ops.mkdir(dir);
            if (aborted) return;
            await ops.writeFile(absolutePath, content);
            if (aborted) return;
            if (signal) signal.removeEventListener("abort", onAbort);
            resolve({ content: `Wrote ${content.length} bytes to ${path}` });
          } catch (err) {
            if (signal) signal.removeEventListener("abort", onAbort);
            if (!aborted) reject(err);
          }
        })();
      });
    },
  };
}
