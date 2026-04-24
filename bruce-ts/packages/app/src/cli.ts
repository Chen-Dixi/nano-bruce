#!/usr/bin/env node
/**
 * Bruce 命令行入口
 *
 * 运行：node dist/cli.js [--skills 目录] [--message "用户消息"]
 * 示例：npm start -- --message "列出可用的 skills"
 *
 * 配置：通过 ~/.bruce/settings.json 或环境变量配置 Provider
 * 初始化：bruce init 生成配置文件模板
 */

// 抑制第三方依赖的 punycode deprecation warning（需在导入前设置）
const _process: any = process;
const _originalEmit = _process.emit;
_process.emit = function(event: string, warning: Error) {
  if (event === 'warning' && warning?.name === 'DeprecationWarning' && warning?.message?.includes('punycode')) {
    return false;
  }
  return _originalEmit.apply(_process, arguments);
};

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, SkillRegistry, PromptBuilder } from "@nano-bruce/bruce";
import { createModel } from "@nano-bruce/ai";
import { getEffectiveConfig, initSettings, getBruceDir, mergeSettings } from "./config/index.js";

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

  return gitRoot ? path.join(gitRoot, "bruce", "skills") : path.resolve(__dirname, "..", "..", "..", "..", "bruce", "skills");
}

async function main() {
  const args = process.argv.slice(2);

  // 处理 init 命令
  if (args[0] === "init") {
    initSettings();
    return;
  }

  let skillsDir = getDefaultSkillsDir(process.cwd());
  let message = "列出当前可用的 skills，并简要说明各自用途。";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skills" && args[i + 1]) {
      skillsDir = path.resolve(args[++i]);
    } else if (args[i] === "--message" && args[i + 1]) {
      message = args[++i];
    }
  }

  const registry = new SkillRegistry(skillsDir);
  registry.load();

  // 从配置获取 Provider 信息
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
    // 只对面向用户的文本做打字机效果
    if (e.type === "text_delta" || e.type === "thinking_delta") {
      process.stdout.write(e.delta);
    } else if (e.type === "text_end" || e.type === "thinking_end") {
      process.stdout.write("\n");
    }
  });
  await agent.chat(message);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
