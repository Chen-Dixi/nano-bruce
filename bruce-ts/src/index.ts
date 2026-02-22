/**
 * @nano-bruce/agent — 基于 TypeScript 的客户端 Agent，支持 Anthropic-style skills
 *
 * 推荐：用 createBrucePiAgent + runBrucePiPrompt（基于 Pi）；兼容：用 Agent + createLLM（moonshot/deepseek）。
 * Python 目录 bruce/ 用于后端服务；Agent 在 TS 侧运行，权限小、数据在本地。
 */

export { Agent, type AgentOptions } from "./agent.js";
export { createLLM, chatCompletion, type LLMOptions } from "./llm.js";
export { PromptBuilder } from "./prompt-builder.js";
export { SkillRegistry, type SkillProperties } from "./skill-registry.js";
export { getDefaultTools } from "./tools.js";
export { runSkillScript } from "./run-script.js";

export {
  createBrucePiAgent,
  runBrucePiPrompt,
  type BrucePiProvider,
  type BrucePiModelId,
} from "./pi-agent.js";
export {
  createBruceTools,
  createBruceToolsWithDefaultReadFile,
} from "./pi-tools.js";
