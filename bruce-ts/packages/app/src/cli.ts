#!/usr/bin/env bun
/**
 * Bruce 命令行入口
 *
 * 运行模式：
 * - `bruce` → 启动 TUI 多轮对话
 * - `bruce -s <uuid>` 或 `bruce --session <uuid>` → 恢复指定 session
 * - `bruce --message "xxx"` → 单轮对话（不创建 session）
 * - `bruce init` → 初始化配置文件
 * - `bruce list-sessions` → 列出当前目录下的 session
 * - `bruce list-sessions -g` → 列出所有 session
 *
 * 退出方式：
 * - Ctrl+C → 保存 session 后退出
 * - Esc → 保存 session 后退出
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
import { launchTui } from "./tui/index.js";

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
  isListSessions: boolean;
  listAllSessions: boolean; // -g 参数
}

function parseArgs(argv: string[]): CliArgs {
  const result: CliArgs = { isInit: false, isListSessions: false, listAllSessions: false };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "init") {
      result.isInit = true;
    } else if (argv[i] === "list-sessions") {
      result.isListSessions = true;
    } else if (argv[i] === "-g" && result.isListSessions) {
      result.listAllSessions = true;
    } else if (argv[i] === "-s" && argv[i + 1]) {
      result.sessionUuid = argv[++i];
    } else if (argv[i] === "--session" && argv[i + 1]) {
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
    temperature: 1,
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

/** 列出 sessions（可选按 cwd 过滤） */
function listSessions(showAll: boolean): void {
  const storage = new SessionStorage();
  const cwd = showAll ? undefined : process.cwd();
  const sessions = storage.listSessions(cwd);
  storage.close();

  if (sessions.length === 0) {
    if (showAll) {
      console.log("No sessions found.");
    } else {
      console.log(`No sessions found in current directory: ${cwd}`);
      console.log("Use `bruce list-sessions -g` to see all sessions.");
    }
    return;
  }

  const scopeLabel = showAll ? "All sessions:" : `Sessions in ${cwd}:`;
  console.log(`\n${scopeLabel}`);
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

/** TUI 多轮对话模式 */
async function runTui(
  sessionUuid: string | undefined,
  skillsDir: string
): Promise<void> {
  const storage = new SessionStorage();
  let session: Session | null = null;
  let sessionCreated = false;

  // 加载已有 session（如果指定了 uuid）
  if (sessionUuid) {
    const loaded = storage.loadSession(sessionUuid);
    if (!loaded) {
      console.error(`Session not found: ${sessionUuid}`);
      storage.close();
      process.exit(1);
    }
    session = loaded;
    sessionCreated = true;
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
    temperature: 1,
    cwd: process.cwd(),
    getApiKey: () => config.apiKey,
  });

  // 恢复已有消息到 agent
  if (session && session.messages.length > 0) {
    agent.setMessageHistory(session.messages);
  }

  await launchTui({
    agent,
    initialMessages: session?.messages,
    provider: config.provider,
    model: config.model || model.id,
    cwd: process.cwd(),
    onExit: () => {
      if (session && sessionCreated) {
        session.messages = agent.getMessageHistory();
        storage.saveSession(session);
      }
      storage.close();
    },
    onSessionSave: (messages) => {
      if (session) {
        session.messages = messages;
        storage.saveSession(session);
      } else {
        // 首次输入后创建 session
        session = storage.createSession({
          cwd: process.cwd(),
          skillsDir,
        });
        sessionCreated = true;
        session.messages = messages;
        storage.saveSession(session);
      }
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // 处理 init 命令
  if (args.isInit) {
    initSettings();
    return;
  }

  // 处理 list-sessions 命令
  if (args.isListSessions) {
    listSessions(args.listAllSessions);
    return;
  }

  const skillsDir = args.skillsDir ?? getDefaultSkillsDir(process.cwd());

  // 单轮对话模式
  if (args.message) {
    await runSingleTurn(args.message, skillsDir);
    return;
  }

  // TUI 多轮对话模式
  await runTui(args.sessionUuid, skillsDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
