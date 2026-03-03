/**
 * AI 层类型：与具体厂商无关的 LLM 调用抽象
 *
 * Provider 接收统一的消息格式（兼容 OpenAI Chat Completion），
 * 返回助手消息（含可选 tool_calls），由 agent 层负责解析与工具执行循环。
 */

/** 单条对话消息（OpenAI 兼容：system/user/assistant/tool） */
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

/** 一次 completion 的返回：助手消息（含 content 与可选的 tool_calls） */
export interface ChatResult {
  message: ChatAssistantMessage;
  /** 可选：token 用量等，便于后续扩展 */
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** 助手消息（与 ChatResult.message 同形，便于流式 done 事件复用） */
export interface ChatAssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
}

/** 流式调用时的事件：先 text_delta 再 done（tool_calls 在 done 时给出） */
export type ChatStreamEvent =
  | { type: "start" }
  | { type: "text_delta"; delta: string }
  | { type: "done"; message: ChatAssistantMessage }
  | { type: "error"; error: unknown };

/** 调用 LLM 的选项 */
export interface ChatOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  tools?: ChatTool[];
  signal?: AbortSignal;
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
}
