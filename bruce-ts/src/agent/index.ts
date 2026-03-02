/**
 * Agent 引擎：核心循环、事件流、EngineAgent 类
 */

export { agentLoop, agentLoopContinue } from "./agent-loop.js";
export { createAgentStream } from "./event-stream.js";
export { EngineAgent, type EngineAgentOptions, type EngineAgentState } from "./agent.js";
export type {
  AgentMessage,
  AgentContext,
  AgentLoopConfig,
  AgentEvent,
  AgentTool,
  AgentToolResult,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  ConvertToLlm,
} from "./types.js";
