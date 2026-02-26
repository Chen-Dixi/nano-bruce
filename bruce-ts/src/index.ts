/**
 * @nano-bruce/agent — 自实现的 TypeScript 客户端 Agent，支持 Anthropic-style skills
 *
 * 不依赖 Pi，核心（Agent、SkillRegistry、PromptBuilder、tools、run_skill_script）均为自实现，便于后续优化。
 * Python 目录 bruce/ 用于后端服务；Agent 在 TS 侧运行，权限小、数据在本地。
 */

export { Agent, type AgentOptions } from "./agent.js";
export { createLLM, chatCompletion, type LLMOptions } from "./llm.js";
export { PromptBuilder } from "./prompt-builder.js";
export { SkillRegistry, type SkillProperties } from "./skill-registry.js";
export { getDefaultTools } from "./tools.js";
export { runSkillScript } from "./run-script.js";
