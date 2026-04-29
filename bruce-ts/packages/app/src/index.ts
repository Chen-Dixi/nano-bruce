/**
 * @nano-bruce/app — 入口：agent 引擎 + 厂商适配 + Bruce 技能层 + CLI
 */
export { Agent, type AgentOptions, getBruceAgentTools, type BruceToolsOptions, PromptBuilder, SkillRegistry, type SkillProperties, getDefaultTools, runSkillScript, type RunScriptResult } from "@nano-bruce/bruce";
export { createProvider, createOpenAIProvider, createLLM, chatCompletion, type ProviderName, type LLMProvider, type ChatMessage, type ChatResult, type LLMOptions } from "@nano-bruce/ai";
export { EngineAgent, agentLoop, agentLoopContinue, createAgentStream } from "@nano-bruce/agent-core";
export type { EngineAgentOptions, EngineAgentState } from "@nano-bruce/agent-core";
export type { AgentMessage, AgentTool, AgentEvent } from "@nano-bruce/agent-core";

// 配置模块
export {
  getBruceDir,
  getSettingsPath,
  loadSettingsFromFile,
  mergeSettings,
  getEffectiveConfig,
  initSettings,
} from "./config/index.js";
