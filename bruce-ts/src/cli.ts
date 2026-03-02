#!/usr/bin/env node
/**
 * Bruce 命令行入口
 *
 * 运行：node dist/cli.js [--skills 目录] [--provider 提供方] [--message "用户消息"]
 * 示例：npm start -- --provider moonshot --message "列出可用的 skills"
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, SkillRegistry, PromptBuilder } from "./bruce/index.js";
import { createProvider } from "./ai/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILLS = path.resolve(__dirname, "..", "..", "bruce", "skills");

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
  let skillsDir = DEFAULT_SKILLS;
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
  console.error("Loaded skills:", registry.listSkills());

  const apiKey = getEnv(getEnvKey(provider));
  const { provider: llmProvider, model } = createProvider(
    provider === "moonshot" ? "moonshot" : provider === "deepseek" ? "deepseek" : "openai",
    { apiKey }
  );
  const agent = new Agent({
    provider: llmProvider,
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
