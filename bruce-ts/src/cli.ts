#!/usr/bin/env node
/**
 * CLI entry: run agent with skills from a directory.
 * Usage: npx tsx src/cli.ts [--skills dir] [--provider moonshot|deepseek] [--message "user message"]
 * Or: node dist/cli.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "./agent.js";
import { createLLM } from "./llm.js";
import { PromptBuilder } from "./prompt-builder.js";
import { SkillRegistry } from "./skill-registry.js";

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
