#!/usr/bin/env node
/**
 * Bruce 命令行入口
 *
 * 运行：node dist/cli.js [--skills 目录] [--provider 提供方] [--message "用户消息"]
 * 示例：npm start -- --provider moonshot --message "列出可用的 skills"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, SkillRegistry, PromptBuilder } from "@nano-bruce/bruce";
import { createModel } from "@nano-bruce/ai";

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

/** 从 startDir 向上到 git 根，收集各层候选的 skills 目录（.nano_bruce/skills 或 .agents/skills），返回第一个存在的 */
function getDefaultSkillsDir(startDir: string): string {
  const resolvedStart = path.resolve(startDir);
  const gitRoot = findGitRepoRoot(resolvedStart);
  const candidates: string[] = [];
  let dir = resolvedStart;

  while (true) {
    candidates.push(path.join(dir, ".nano_bruce", "skills"));
    candidates.push(path.join(dir, ".agents", "skills"));
    if (gitRoot && dir === gitRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const d of candidates) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) return d;
  }
  return gitRoot ? path.join(gitRoot, "bruce", "skills") : path.resolve(__dirname, "..", "..", "..", "..", "bruce", "skills");
}

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
  return v;
}

function getEnvKey(provider: string): string {
  switch (provider) {
    case "moonshot": return "MOONSHOT_API_KEY";
    case "deepseek": return "DEEPSEEK_API_KEY";
    default: return "OPENAI_API_KEY";
  }
}

async function main() {
  const args = process.argv.slice(2);
  let skillsDir = getDefaultSkillsDir(process.cwd());
  let provider = "moonshot";
  let message = "列出当前可用的 skills，并简要说明各自用途。";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skills" && args[i + 1]) {
      skillsDir = path.resolve(args[++i]);
    } else if (args[i] === "--provider" && args[i + 1]) {
      provider = args[++i];
    } else if (args[i] === "--message" && args[i + 1]) {
      message = args[++i];
    }
  }

  const registry = new SkillRegistry(skillsDir);
  registry.load();

  const providerName = provider === "moonshot" ? "moonshot" : provider === "deepseek" ? "deepseek" : "openai";
  const model = createModel(providerName);
  const apiKey = getEnv(getEnvKey(provider));
  const agent = new Agent({
    model,
    skillRegistry: registry,
    promptBuilder: new PromptBuilder(registry),
    toolsEnabled: true,
    getApiKey: () => apiKey,
  });

  agent.subscribe((event) => {
    if (event.type !== "message_update") return;
    const e = event.assistantMessageEvent;
    // 只对面向用户的文本做打字机效果，不打印工具调用的 JSON（避免出现 "{}" 或参数片段）
    if (e.type === "text_delta" || e.type === "thinking_delta") {
      process.stdout.write(e.delta);
    } else if (e.type === "text_end" || e.type === "thinking_end") {
      process.stdout.write("\n");
    }
  });
  await agent.chat(message);
  // console.log(response);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
