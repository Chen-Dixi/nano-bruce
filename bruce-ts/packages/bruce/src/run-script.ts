/**
 * 安全执行 skill 的 scripts/ 目录下脚本
 *
 * 策略：路径必须在 scriptsDir 下、扩展名白名单（.py / .sh / .bash / .js / .mjs）、
 * 超时 60 秒、用 spawn 无 shell，参数列表传递避免注入。
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALLOWED_EXTENSIONS = [".py", ".sh", ".bash", ".js", ".mjs"];
const SCRIPT_TIMEOUT_MS = 60_000;
const MAX_SCRIPT_ARGS = 32;

export interface RunScriptResult {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: string;
}

/**
 * 在 scriptsDir 下执行 scriptName，传入 args；.py 用 python3、.sh 用 bash、.js 用 node
 */
export function runSkillScript(
  scriptsDir: string,
  scriptName: string,
  args: string[] = []
): Promise<RunScriptResult> {
  const scriptsDirResolved = path.resolve(scriptsDir);
  if (!fs.existsSync(scriptsDirResolved) || !fs.statSync(scriptsDirResolved).isDirectory()) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      error: "scripts/ directory not found",
    });
  }

  const scriptPath = path.resolve(scriptsDirResolved, scriptName.replace(/\\/g, "/").trim());
  if (!scriptPath.startsWith(scriptsDirResolved + path.sep) && scriptPath !== scriptsDirResolved) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      error: "script path must be under the skill's scripts/ directory",
    });
  }

  if (!fs.existsSync(scriptPath) || !fs.statSync(scriptPath).isFile()) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      error: `script not found: ${path.basename(scriptPath)}`,
    });
  }

  const ext = path.extname(scriptPath);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      code: null,
      error: `script extension not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    });
  }

  const safeArgs = args.slice(0, MAX_SCRIPT_ARGS).map(String);

  let command: string;
  let execArgs: string[];
  if (ext === ".py") {
    command = process.platform === "win32" ? "python" : "python3";
    execArgs = [scriptPath, ...safeArgs];
  } else if (ext === ".sh" || ext === ".bash") {
    command = "bash";
    execArgs = [scriptPath, ...safeArgs];
  } else {
    command = "node";
    execArgs = [scriptPath, ...safeArgs];
  }

  return new Promise((resolve) => {
    const proc = spawn(command, execArgs, {
      cwd: scriptsDirResolved,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        stdout,
        stderr,
        code: null,
        error: `script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s`,
      });
    }, SCRIPT_TIMEOUT_MS);

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        code: null,
        error: String(err.message),
      });
    });

    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        code: code ?? (signal ? -1 : 0),
      });
    });
  });
}
