import type { AgentTool } from "@nano-bruce/agent-core";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  type TruncationResult,
  truncateTail,
} from "./truncate.js";

const bashSchema = Type.Object({
  command: Type.String({ description: "Shell command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds" })),
});

export interface BashToolDetails {
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

export interface BashOperations {
  exec: (
    command: string,
    cwd: string,
    options: { onData: (data: Buffer) => void; signal?: AbortSignal; timeout?: number }
  ) => Promise<{ exitCode: number | null }>;
}

function killProcessTree(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
}

const defaultBashOperations: BashOperations = {
  exec: (command, cwd, { onData, signal, timeout }) => {
    return new Promise((resolve, reject) => {
      if (!existsSync(cwd)) {
        reject(new Error(`Working directory does not exist: ${cwd}`));
        return;
      }
      const isWin = process.platform === "win32";
      const child = spawn(isWin ? (process.env.COMSPEC ?? "cmd.exe") : "sh", isWin ? ["/c", command] : ["-c", command], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let timedOut = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      if (timeout != null && timeout > 0) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          if (child.pid) killProcessTree(child.pid);
        }, timeout * 1000);
      }
      if (child.stdout) child.stdout.on("data", onData);
      if (child.stderr) child.stderr.on("data", onData);
      child.on("error", (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (signal) signal.removeEventListener("abort", onAbort);
        reject(err);
      });
      const onAbort = () => {
        if (child.pid) killProcessTree(child.pid);
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
      child.on("close", (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (signal) signal.removeEventListener("abort", onAbort);
        if (signal?.aborted) {
          reject(new Error("Operation aborted"));
          return;
        }
        if (timedOut) {
          reject(new Error(`timeout:${timeout}`));
          return;
        }
        resolve({ exitCode: code });
      });
    });
  },
};

export interface BashToolOptions {
  operations?: BashOperations;
}

export function createBashTool(cwd: string, options?: BashToolOptions): AgentTool<typeof bashSchema, BashToolDetails> {
  const ops = options?.operations ?? defaultBashOperations;

  return {
    name: "bash",
    label: "Bash",
    description: `Execute a shell command in the working directory. Output truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB. Optional timeout in seconds.`,
    parameters: bashSchema,
    execute: async (_toolCallId, { command, timeout }, signal?, onUpdate?) => {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let chunksBytes = 0;
        const maxChunksBytes = DEFAULT_MAX_BYTES * 2;
        const handleData = (data: Buffer) => {
          chunks.push(data);
          chunksBytes += data.length;
          while (chunksBytes > maxChunksBytes && chunks.length > 1) {
            const removed = chunks.shift()!;
            chunksBytes -= removed.length;
          }
          if (onUpdate) {
            const fullText = Buffer.concat(chunks).toString("utf-8");
            const truncation = truncateTail(fullText);
            onUpdate({
              content: truncation.content || "(running...)",
              details: truncation.truncated ? { truncation } : undefined,
            });
          }
        };

        ops
          .exec(command, cwd, { onData: handleData, signal, timeout })
          .then(({ exitCode }) => {
            const fullOutput = Buffer.concat(chunks).toString("utf-8");
            const truncation = truncateTail(fullOutput);
            let outputText = truncation.content || "(no output)";
            let details: BashToolDetails | undefined;
            if (truncation.truncated) {
              details = { truncation };
              const startLine = truncation.totalLines - truncation.outputLines + 1;
              const endLine = truncation.totalLines;
              if (truncation.truncatedBy === "lines") {
                outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}.]`;
              } else {
                outputText += `\n\n[Showing last ${formatSize(truncation.outputBytes)}.]`;
              }
            }
            if (exitCode !== 0 && exitCode !== null) {
              outputText += `\n\nExit code ${exitCode}`;
              reject(new Error(outputText));
            } else {
              resolve({ content: outputText, details });
            }
          })
          .catch((err: Error) => {
            const output = Buffer.concat(chunks).toString("utf-8");
            if (err.message === "Operation aborted" || err.message === "aborted") {
              reject(new Error(output ? `${output}\n\nCommand aborted` : "Command aborted"));
            } else if (err.message.startsWith("timeout:")) {
              const secs = err.message.split(":")[1];
              reject(new Error(output ? `${output}\n\nTimed out after ${secs}s` : `Timed out after ${secs}s`));
            } else {
              reject(err);
            }
          });
      });
    },
  };
}
