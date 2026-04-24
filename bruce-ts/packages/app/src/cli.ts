#!/usr/bin/env node
/**
 * Bruce 命令行入口
 *
 * 运行模式：
 * - `bruce` → 进入 REPL 多轮对话
 * - `bruce -s <uuid>` → 恢复指定 session 并进入 REPL
 * - `bruce --message "xxx"` → 单轮对话（不创建 session）
 * - `bruce init` → 初始化配置文件
 *
 * 退出方式：
 * - Ctrl+D → 保存 session 后优雅退出
 * - 双 Ctrl+C → 强制退出（不保存最后一轮）
 */

// 抑制第三方依赖的 punycode deprecation warning（需在导入前设置）
const _process: any = process;
const _originalEmit = _process.emit;
_process.emit = function (event: string, warning: Error) {
  if (
    event === "warning" &&
    warning?.name === "DeprecationWarning" &&
    warning?.message?.includes("punycode")
  ) {
    return false;
  }
  return _originalEmit.apply(_process, arguments);
};

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Agent, SkillRegistry, PromptBuilder } from "@nano-bruce/bruce";
import { createModel } from "@nano-bruce/ai";
import {
  getEffectiveConfig,
  initSettings,
  getBruceDir,
  mergeSettings,
} from "./config/index.js";
import { SessionStorage } from "./session/storage.js";
import type { Session } from "./session/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findGitRepoRoot(startDir: string): string | null {
  const resolved = path.resolve(startDir);
  let dir = resolved;
  while (true) {
    const gitDir = path.join(dir, ".git");
    if (fs.existsSync(gitDir) && fs.statSync(gitDir).isDirectory()) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** 从 startDir 向上到 git 根，收集各层候选的 skills 目录，返回第一个存在的 */
function getDefaultSkillsDir(startDir: string): string {
  const resolvedStart = path.resolve(startDir);
  const gitRoot = findGitRepoRoot(resolvedStart);
  const candidates: string[] = [];
  let dir = resolvedStart;

  while (true) {
    candidates.push(path.join(dir, ".bruce", "skills"));
    candidates.push(path.join(dir, ".agents", "skills"));
    if (gitRoot && dir === gitRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const d of candidates) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
  }

  // 尝试从配置获取 skillsDir
  const settings = mergeSettings();
  const configSkillsDir = settings.workingDir?.skillsDir;
  if (configSkillsDir && fs.existsSync(configSkillsDir)) {
    return configSkillsDir;
  }

  // 默认使用 ~/.bruce/skills
  const bruceSkillsDir = path.join(getBruceDir(), "skills");
  if (fs.existsSync(bruceSkillsDir)) {
    return bruceSkillsDir;
  }

  return gitRoot
    ? path.join(gitRoot, "bruce", "skills")
    : path.resolve(__dirname, "..", "..", "..", "..", "bruce", "skills");
}

/** 解析命令行参数 */
interface CliArgs {
  sessionUuid?: string;
  message?: string;
  skillsDir?: string;
  isInit: boolean;
  isSessions: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = { isInit: false, isSessions: false };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "init") {
      result.isInit = true;
    } else if (argv[i] === "sessions") {
      result.isSessions = true;
    } else if (argv[i] === "-s" && argv[i + 1]) {
      result.sessionUuid = argv[++i];
    } else if (argv[i] === "--message" && argv[i + 1]) {
      result.message = argv[++i];
    } else if (argv[i] === "--skills" && argv[i + 1]) {
      result.skillsDir = path.resolve(argv[++i]);
    }
  }

  return result;
}

/** 单轮对话模式（不创建 session） */
async function runSingleTurn(
  message: string,
  skillsDir: string
): Promise<void> {
  const registry = new SkillRegistry(skillsDir);
  registry.load();

  const config = getEffectiveConfig();
  const model = createModel(config.provider as any, config.model);

  const agent = new Agent({
    model,
    skillRegistry: registry,
    promptBuilder: new PromptBuilder(registry),
    toolsEnabled: true,
    getApiKey: () => config.apiKey,
  });

  agent.subscribe((event) => {
    if (event.type !== "message_update") return;
    const e = event.assistantMessageEvent;
    if (e.type === "text_delta" || e.type === "thinking_delta") {
      process.stdout.write(e.delta);
    } else if (e.type === "text_end" || e.type === "thinking_end") {
      process.stdout.write("\n");
    }
  });

  await agent.chat(message);
}

/** 列出所有 sessions */
function listSessions(): void {
  const storage = new SessionStorage();
  const sessions = storage.listSessions();
  storage.close();

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  console.log("\nSessions:");
  console.log("─".repeat(70));
  console.log(
    "Session ID".padEnd(36) +
    " | " + "Created".padEnd(16) +
    " | " + "Messages"
  );
  console.log("─".repeat(70));

  for (const s of sessions) {
    const created = new Date(s.createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      s.uuid.padEnd(36) +
      " | " + created.padEnd(16) +
      " | " + s.messageCount
    );
  }
  console.log("─".repeat(70));
  console.log(`Total: ${sessions.length} sessions`);
}

/** REPL 多轮对话模式 */
async function runRepl(
  sessionUuid: string | undefined,
  skillsDir: string
): Promise<void> {
  const storage = new SessionStorage();
  let session: Session;

  // 加载或创建 session
  if (sessionUuid) {
    const loaded = storage.loadSession(sessionUuid);
    if (!loaded) {
      console.error(`Session not found: ${sessionUuid}`);
      storage.close();
      process.exit(1);
    }
    session = loaded;
    console.log(`Resumed session: ${sessionUuid}`);
    console.log(`Messages in history: ${session.messages.length}`);
  } else {
    session = storage.createSession({
      cwd: process.cwd(),
      skillsDir,
    });
    console.log(`New session: ${session.uuid}`);
  }

  const registry = new SkillRegistry(skillsDir);
  registry.load();

  const config = getEffectiveConfig();
  const model = createModel(config.provider as any, config.model);

  const agent = new Agent({
    model,
    skillRegistry: registry,
    promptBuilder: new PromptBuilder(registry),
    toolsEnabled: true,
    cwd: process.cwd(),
    getApiKey: () => config.apiKey,
  });

  // 恢复已有消息到 agent
  if (session.messages.length > 0) {
    agent.setMessageHistory(session.messages);
    console.log(`Restored ${session.messages.length} messages from history`);
  }

  agent.subscribe((event) => {
    if (event.type !== "message_update") return;
    const e = event.assistantMessageEvent;
    if (e.type === "text_delta" || e.type === "thinking_delta") {
      process.stdout.write(e.delta);
    } else if (e.type === "text_end" || e.type === "thinking_end") {
      process.stdout.write("\n");
    }
  });

  // Ctrl+C 处理状态
  let ctrlCCount = 0;
  let ctrlCTimer: NodeJS.Timeout | null = null;

  const rl = readline.createInterface({ input, output });

  // 处理 Ctrl+C
  rl.on("SIGINT", () => {
    ctrlCCount++;
    if (ctrlCTimer) clearTimeout(ctrlCTimer);

    if (ctrlCCount === 1) {
      console.log("\nPress Ctrl+C again to exit (unsaved), or Ctrl+D to save and exit");
      ctrlCTimer = setTimeout(() => {
        ctrlCCount = 0;
      }, 2000);
    } else if (ctrlCCount >= 2) {
      console.log("\nExiting without saving...");
      rl.close();
      storage.close();
      process.exit(0);
    }
  });

  console.log("\nEnter your message (Ctrl+D to save and exit):");

  try {
    while (true) {
      output.write("bruce> ");
      const userInput = await rl.question("");

      if (userInput.trim() === "") continue;

      // 重置 Ctrl+C 计数
      ctrlCCount = 0;
      if (ctrlCTimer) clearTimeout(ctrlCTimer);

      // 添加用户消息到 session
      session.messages.push({
        role: "user",
        content: userInput.trim(),
        timestamp: Date.now(),
      });

      // 调用 agent
      try {
        await agent.chat(userInput.trim());

        // 获取完整对话历史并保存
        session.messages = agent.getMessageHistory();

        // 保存 session
        storage.saveSession(session);
        console.log();
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    // Ctrl+D 会触发 AbortError
    if (err instanceof Error && (err.name === "AbortError" || (err as any).code === "ABORT_ERR")) {
      console.log("\nSaving session and exiting...");
      storage.saveSession(session);
      storage.close();
      process.exit(0);
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 处理 init 命令
  if (args.isInit) {
    initSettings();
    return;
  }

  // 处理 sessions 命令
  if (args.isSessions) {
    listSessions();
    return;
  }

  const skillsDir = args.skillsDir ?? getDefaultSkillsDir(process.cwd());

  // 单轮对话模式
  if (args.message) {
    await runSingleTurn(args.message, skillsDir);
    return;
  }

  // REPL 多轮对话模式
  await runRepl(args.sessionUuid, skillsDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});