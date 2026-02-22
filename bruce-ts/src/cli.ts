#!/usr/bin/env node
/**
 * Bruce 命令行入口：从本目录运行带 skills 的 Agent
 *
 * 运行方式（需先 npm run build）：
 *   node dist/cli.js [--skills 目录] [--provider 提供方] [--message "用户消息"]
 *
 * 示例：
 *   npm start
 *   npm start -- --provider kimi-coding --message "列出可用的 skills"
 *   npm start -- --skills /path/to/skills --message "写一份周报"
 *
 * 环境变量：
 *   kimi-coding → KIMI_API_KEY
 *   openai      → OPENAI_API_KEY
 *   moonshot    → MOONSHOT_API_KEY（走 legacy 路径）
 *   deepseek    → DEEPSEEK_API_KEY（走 legacy 路径）
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { SkillRegistry } from "./skill-registry.js";
import { createBrucePiAgent, runBrucePiPrompt } from "./pi-agent.js";
import { Agent } from "./agent.js";
import { createLLM } from "./llm.js";
import { PromptBuilder } from "./prompt-builder.js";

// ESM 下没有 __dirname，用 import.meta.url 算出当前脚本所在目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 未指定 --skills 时使用的 skills 目录（默认指向仓库里的 bruce/skills） */
const DEFAULT_SKILLS = path.resolve(__dirname, "..", "..", "bruce", "skills");

/** 从环境变量读取 key，不存在则打错并 process.exit(1) */
function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const args = process.argv.slice(2);
  let skillsDir = DEFAULT_SKILLS;
  let provider = "kimi-coding";
  let message = "列出当前可用的 skills，并简要说明各自用途。";

  // 简单解析 --skills / --provider / --message
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
  console.error("Loaded skills:", registry.listSkills());

  // 优先走 Pi：kimi-coding / openai 用 pi-ai 的 getModel + Pi Agent
  if (provider === "kimi-coding" || provider === "openai") {
    getEnv(provider === "kimi-coding" ? "KIMI_API_KEY" : "OPENAI_API_KEY");
    const modelId = provider === "kimi-coding" ? "kimi-k2" : "gpt-4o-mini";
    const agent = createBrucePiAgent(registry, { provider: provider as "kimi-coding" | "openai", modelId });
    const response = await runBrucePiPrompt(agent, message);
    console.log(response);
    return;
  }

  // 兼容旧用法：moonshot / deepseek 用自定义 Agent + OpenAI 兼容客户端（自定义 baseURL）
  const apiKey =
    provider === "moonshot"
      ? getEnv("MOONSHOT_API_KEY")
      : provider === "deepseek"
        ? getEnv("DEEPSEEK_API_KEY")
        : getEnv("OPENAI_API_KEY");
  const baseURL =
    provider === "moonshot"
      ? "https://api.moonshot.cn/v1"
      : provider === "deepseek"
        ? "https://api.deepseek.com"
        : undefined;
  const model =
    provider === "moonshot"
      ? "kimi-k2-turbo-preview"
      : provider === "deepseek"
        ? "deepseek-chat"
        : "gpt-4o-mini";
  const client = createLLM({ apiKey, baseURL, model });
  const agent = new Agent({
    client,
    model,
    skillRegistry: registry,
    promptBuilder: new PromptBuilder(registry),
    toolsEnabled: true,
  });
  const response = await agent.chat(message);
  console.log(response);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
