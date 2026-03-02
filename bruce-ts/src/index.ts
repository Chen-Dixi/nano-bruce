/**
 * @nano-bruce/agent — 入口：agent 引擎（agent/）+ 厂商适配（ai/）+ Bruce 技能层（bruce/）
 */

export { Agent, type AgentOptions, getBruceAgentTools, type BruceToolsOptions, PromptBuilder, SkillRegistry, type SkillProperties, getDefaultTools, runSkillScript, type RunScriptResult } from "./bruce/index.js";
export { createProvider, createOpenAIProvider, createLLM, chatCompletion, type ProviderName, type LLMProvider, type ChatMessage, type ChatResult, type LLMOptions } from "./ai/index.js";
export { Agent as EngineAgent, agentLoop, agentLoopContinue, createAgentStream } from "./agent/index.js";
export type { AgentMessage, AgentTool, AgentEvent } from "./agent/types.js";
