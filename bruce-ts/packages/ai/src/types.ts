/**
 * AI 层类型：与具体厂商无关的 LLM 调用抽象
 *
 * Provider 接收统一的消息格式（兼容 OpenAI Chat Completion），
 * 返回助手消息（含可选 tool_calls），由 agent 层负责解析与工具执行循环。
 */

/** 单条对话消息（OpenAI 兼容：system/user/assistant/tool） */
import { EventStream } from "./event-stream.js";
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{ id: string; name: string; arguments: string }>;
    }
  | { role: "tool"; tool_call_id: string; content: string };

/** 工具定义（OpenAI Function Calling 格式） */
export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/** 停止原因 */
export type StopReason = "stop" | "length" | "tool_calls" | "error" | "aborted";

/** 文本内容块 */
export interface TextContent {
  type: "text";
  text: string;
}

/** 思考/推理内容块（如 reasoning_content） */
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
}

export interface ImageContent {
	type: "image";
	data: string; // base64 encoded image data
	mimeType: string; // e.g., "image/jpeg", "image/png"
}

/** 工具调用块（与 content 数组中的一项对应） */
export interface ToolCallContent {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** 助手消息的 content 数组项 */
export type ChatContentBlock = TextContent | ThinkingContent | ToolCallContent;

/** 一次 completion 的返回：助手消息（content 为块数组，tool 调用在 content 中为 toolCall 块） */
export interface ChatResult {
  message: AssistantMessage;
  /** 可选：token 用量等，便于后续扩展 */
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[]
  timestamp: number; // Unix timestamp in milliseconds
}

/** 助手消息：content 为块数组（text / thinking / toolCall），仿 Pi-mono */
export interface AssistantMessage {
  role: "assistant";
  content: ChatContentBlock[];
  stopReason?: StopReason;
  errorMessage?: string;
  timestamp?: number;
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContent | ImageContent)[]; // Supports text and images
	details?: TDetails;
	isError: boolean;
	timestamp: number; // Unix timestamp in milliseconds
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;

/**
 * 流式事件：每类事件携带 partial（当前累积的助手消息），便于 UI 实时渲染
 */
export type ChatStreamEvent =
  | { type: "start"; partial: AssistantMessage } // 流开始，partial 为初始空消息，可用来在 UI 显示“正在输入”
  | { type: "text_start"; contentIndex: number; partial: AssistantMessage } // 开始一个新的文本块，contentIndex 为 content 数组下标
  | { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage } // 文本块增量，delta 为本 chunk 片段，partial 为当前累积的完整消息
  | { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage } // 当前文本块结束，content 为该块最终完整文本
  | { type: "thinking_start"; contentIndex: number; partial: AssistantMessage } // 开始一个思考/推理块（如 reasoning_content）
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage } // 思考块增量
  | { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage } // 思考块结束，content 为该块最终内容
  | { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage } // 开始一个 tool call 块
  | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage } // tool call 的 arguments 流式片段（通常为 JSON 片段）
  | { type: "toolcall_end"; contentIndex: number; toolCall: ToolCallContent; partial: AssistantMessage } // 当前 tool call 结束，toolCall 为解析后的完整调用
  | { type: "done"; reason: StopReason; message: AssistantMessage } // 流正常结束，reason 为停止原因，message 为最终完整助手消息
  | { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage }; // 流异常结束（如网络错误或 abort），error 为带 errorMessage 的 partial 消息

/** 调用 LLM 的选项 */
export interface ChatOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  tools?: ChatTool[];
  signal?: AbortSignal;
}

export class AssistantMessageEventStream extends EventStream<ChatStreamEvent, AssistantMessage> {
  constructor() {
    super(
      (event) => event.type === "done" || event.type === "error",
      (event) => {
				if (event.type === "done") {
					return event.message;
				} else if (event.type === "error") {
					return event.error;
				}
				throw new Error("Unexpected event type for final result");
			},
    );
  }
}

/**
 * 大模型厂商适配接口：根据消息和选项发起一次 completion，返回助手消息。
 * 各厂商在 ai/ 下实现此接口（如 openai-provider）。
 * 可选 chatStream：流式返回，供 agent 层做打字机效果与增量推送。
 */
export interface LLMProvider {
  chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult>;
  /** 可选：流式 completion，返回 AsyncIterable<ChatStreamEvent> */
  chatStream?(
    messages: ChatMessage[],
    options: ChatOptions
  ): AsyncIterable<ChatStreamEvent> | Promise<AsyncIterable<ChatStreamEvent>>;

  streamChat?(
    messages: ChatMessage[],
    options: ChatOptions,
  ): AssistantMessageEventStream
}
