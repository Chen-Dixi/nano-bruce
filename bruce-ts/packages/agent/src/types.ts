/**
 * Agent 层类型：与 Pi 风格对齐的 AgentMessage、Context、Loop 配置与事件
 *
 * 消息在 agent 内以 AgentMessage 流转；仅在调用 LLM 时通过 convertToLlm 转为 ai 层 ChatMessage[]。
 */

import type { TSchema } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import {
  type AssistantMessage,
  type ChatMessage,
  type ChatOptions,
  type ChatStreamEvent,
  type Message,
  type Model,
  stream,
  type ToolResultMessage,
} from "@nano-bruce/ai";

/** 从 TypeBox 复用以保持与 Pi-mono 命名一致，工具参数 schema 的基约束 */
export type { TSchema } from "@sinclair/typebox";
export type { Static } from "@sinclair/typebox";

/** Agent 内统一消息类型 */
export type AgentMessage = Message

export type StreamFn = (
	...args: Parameters<typeof stream>
) => ReturnType<typeof stream> | Promise<ReturnType<typeof stream>>;

/**
 * 工具执行结果（供 execute 返回）。
 * TDetails：工具可选的详细信息类型（如截断信息、匹配数等），供 UI 类型安全地消费。
 */
export interface AgentToolResult<TDetails = any> {
  content: string;
  isError?: boolean;
  details?: TDetails;
}

/**
 * 可选：execute 执行过程中的增量结果回调（流式更新）。
 */
export type AgentToolUpdateCallback<TDetails = any> = (
  partial: AgentToolResult<TDetails>
) => void;

/**
 * 工具基接口：name、description、parameters（TypeBox schema）。
 * TParameters 为参数 schema，用于 LLM 与运行时校验，Static<TParameters> 为参数 TS 类型。
 */
export interface Tool<TParameters extends TSchema = TSchema> {
  name: string;
  description?: string;
  parameters?: TParameters;
}

/**
 * Agent 工具定义（对齐 Pi-mono）：继承 Tool，增加 label 与 execute。
 * - TParameters extends TSchema：参数 schema，execute 的 params 为 Static<TParameters>，编译时类型安全。
 * - TDetails：执行结果 details 类型，供 UI/上层类型安全地访问元数据。
 */
export interface AgentTool<
  TParameters extends TSchema = TSchema,
  TDetails = any
> extends Tool<TParameters> {
  /** 供 UI 展示的人类可读标签 */
  label: string;
  execute(
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>
  ): Promise<AgentToolResult<TDetails>>;
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
export interface AgentLoopConfig extends ChatOptions {
  agentTools?: AgentTool[];
  /** AgentMessage[] → ChatMessage[]，未提供时 agent-loop 使用内置 defaultConvertToLlm */
  convertToLlm: ConvertToLlm;

  /**
	 * 动态获取 API key
	 * 适用于过期 token 的情况（如 GitHub Copilot OAuth）
	 */
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;

  /** 可选：在每次 LLM 调用前对 messages 做裁剪/注入 */
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => AgentMessage[] | Promise<AgentMessage[]>;

  /** 每轮工具执行后检查是否有“转向”消息（用户中途输入），有则跳过剩余工具并注入 */
  getSteeringMessages?: () => Promise<AgentMessage[]>;

  /** 当本轮无更多 tool_calls 时检查是否有后续用户消息，有则继续下一轮 */
  getFollowUpMessages?: () => Promise<AgentMessage[]>;
}

// --- 事件类型（供 UI / 上层订阅）---

/**
 * Agent 事件：供 for await (event of stream) 消费，用于 UI 渲染、日志、状态同步。
 */
export type AgentEvent =
  | { type: "agent_start" } // agent_start: 一次 agent 运行开始（含多轮 turn）
  | { type: "agent_end"; messages: AgentMessage[] } // agent_end: 一次 agent 运行结束，messages 为本轮产生的全部新消息
  | { type: "turn_start" } // turn_start: 新一轮 turn 开始（即将调 LLM）
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] } // turn_end: 本轮 turn 结束，含本轮的 assistant message 与本轮产生的 tool 结果列表
  | { type: "message_start"; message: AgentMessage } // message_start: 某条消息开始（user/assistant/toolResult），message 为完整或占位
  | { type: "message_update"; message: AssistantMessage, assistantMessageEvent: ChatStreamEvent } // message_update: 仅流式时出现，assistant 消息的中间状态（如打字机效果），message 为当前累积的 partial
  | { type: "message_end"; message: AgentMessage } // message_end: 某条消息结束，message 为最终完整内容
  | {
      type: "tool_execution_start"; // tool_execution_start: 开始执行一个 tool call，含 id、name、解析后的 args
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_execution_end"; // tool_execution_end: 单个 tool 执行完毕，含 result 与是否错误
      toolCallId: string;
      toolName: string;
      result: AgentToolResult<unknown>;
      isError: boolean;
    };
