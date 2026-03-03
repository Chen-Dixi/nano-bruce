/**
 * Agent 层类型：与 Pi 风格对齐的 AgentMessage、Context、Loop 配置与事件
 *
 * 消息在 agent 内以 AgentMessage 流转；仅在调用 LLM 时通过 convertToLlm 转为 ai 层 ChatMessage[]。
 */

import type { ChatMessage, LLMProvider } from "@nano-bruce/ai";

/** 用户消息 */
export interface UserMessage {
  role: "user";
  content: string;
  timestamp?: number;
}

/** 工具调用（助手消息中的一项） */
export interface ToolCallPart {
  type: "toolCall";
  id: string;
  name: string;
  arguments: string;
}

/** 助手消息 */
export interface AssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
  stopReason?: "stop" | "length" | "tool_calls" | "error" | "aborted";
  errorMessage?: string;
  timestamp?: number;
}

/** 工具结果消息 */
export interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: string;
  isError?: boolean;
  timestamp?: number;
}

/** Agent 内统一消息类型 */
export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage;

/** 工具执行结果（供 execute 返回） */
export interface AgentToolResult {
  content: string;
  isError?: boolean;
}

/**
 * Agent 工具定义：名称、描述、参数 schema、执行函数。
 * 调用 LLM 时转为 ai 层 ChatTool；收到 tool_calls 时按 name 查找并执行 execute。
 */
export interface AgentTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute(
    toolCallId: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<AgentToolResult>;
}

/** Agent 上下文：系统提示 + 消息历史 + 工具列表 */
export interface AgentContext {
  systemPrompt: string;
  messages: AgentMessage[];
  tools?: AgentTool[];
}

/**
 * 将 AgentMessage[] 转为 LLM 可接受的 ChatMessage[]（含 system 由 systemPrompt 注入）。
 * 默认实现：过滤仅保留 user/assistant/tool，并映射为 ChatMessage 形状。
 */
export type ConvertToLlm = (messages: AgentMessage[], systemPrompt: string) => ChatMessage[] | Promise<ChatMessage[]>;

/**
 * Agent 循环配置：Provider、模型、转换与可选的回调（steering / follow-up）
 */
export interface AgentLoopConfig {
  /** 调用 LLM 的 provider */
  provider: LLMProvider;
  model: string;
  systemPrompt: string;
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;

  /** AgentMessage[] → ChatMessage[]，默认实现只保留 user/assistant/tool 并映射 */
  convertToLlm?: ConvertToLlm;

  /** 可选：在每次 LLM 调用前对 messages 做裁剪/注入 */
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => AgentMessage[] | Promise<AgentMessage[]>;

  /** 每轮工具执行后检查是否有“转向”消息（用户中途输入），有则跳过剩余工具并注入 */
  getSteeringMessages?: () => Promise<AgentMessage[]>;

  /** 当本轮无更多 tool_calls 时检查是否有后续用户消息，有则继续下一轮 */
  getFollowUpMessages?: () => Promise<AgentMessage[]>;
}

// --- 事件类型（供 UI / 上层订阅）---

export type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AssistantMessage }
  | { type: "message_end"; message: AgentMessage }
  | {
      type: "tool_execution_start";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_execution_end";
      toolCallId: string;
      toolName: string;
      result: AgentToolResult;
      isError: boolean;
    };
