/**
 * EngineAgent：引擎级 Agent，封装状态与循环入口，参考 Pi Agent
 *
 * 持有 systemPrompt、messages、tools，提供 prompt() / continue()，
 * 内部调用 agentLoop / agentLoopContinue，将事件推送给订阅者。
 */

import { agentLoop, agentLoopContinue } from "./agent-loop.js";
import type {
  AgentContext,
  AgentEvent,
  AgentLoopConfig,
  AgentMessage,
  AgentTool,
  ConvertToLlm,
} from "./types.js";

import type { Message, UserMessage, Model } from "@nano-bruce/ai";
import type { ChatMessage } from "@nano-bruce/ai";

/** 默认：将 AgentMessage[]（Message）转为 ChatMessage[] 供 Provider 使用 */
function defaultConvertToLlm(messages: AgentMessage[], systemPrompt: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (systemPrompt.trim()) out.push({ role: "system", content: systemPrompt });
  for (const m of messages) {
    if (m.role === "system") {
      out.push({ role: "system", content: m.content });
    } else if (m.role === "user") {
      const content = typeof m.content === "string" ? m.content : m.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("");
      out.push({ role: "user", content });
    } else if (m.role === "assistant") {
      const textParts: string[] = [];
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      for (const b of m.content) {
        if (b.type === "text") textParts.push(b.text);
        else if (b.type === "thinking") textParts.push(b.thinking);
        else if (b.type === "toolCall") toolCalls.push({ id: b.id, name: b.name, arguments: JSON.stringify(b.arguments) });
      }
      out.push({
        role: "assistant",
        content: textParts.length ? textParts.join("") : null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      });
    } else if (m.role === "toolResult") {
      const text = m.content.map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("");
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: text });
    }
  }
  return out;
}

/** 引擎级 Agent 创建配置 */
export interface EngineAgentOptions {
  model: Model<any>;
  systemPrompt?: string;
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;

  /** 可选：按 provider 返回 API key */
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;

  /** 可选：context 转换（裁剪/注入） */
  transformContext?: (
    messages: AgentMessage[],
    signal?: AbortSignal
  ) => AgentMessage[] | Promise<AgentMessage[]>;

  convertToLlm?: ConvertToLlm

  /** 是否启用 steering/follow-up 队列（默认 false，CLI 单轮不需要） */
  steeringMode?: "all" | "one-at-a-time";
  followUpMode?: "all" | "one-at-a-time";
}

export interface EngineAgentState {
  systemPrompt: string;
  messages: AgentMessage[];
  tools: AgentTool[];
  isStreaming: boolean;
  error?: string;
}

export class EngineAgent {  
  private _model: Model<any>
  /** 系统提示，每次对话会注入到 context 首条 */
  private _systemPrompt: string;
  /** 对话历史：user / assistant / toolResult 消息列表 */
  private _messages: AgentMessage[] = [];
  /** 当前注册的工具列表，会传给 agent 循环用于 function calling */
  private _tools: AgentTool[];
  /**
	 * 动态获取 API key
	 * 适用于过期 token 的情况（如 GitHub Copilot OAuth）
	 */
  public getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  /** LLM 采样温度，未设则用 provider 默认 */
  private _temperature?: number;
  /** 单次 completion 最大 token 数 */
  private _maxTokens?: number;
  /** 可选：在每次 LLM 调用前对 messages 做裁剪或注入 */
  private _transformContext?: EngineAgentOptions["transformContext"];
  /** AgentMessage[] → ChatMessage[]，默认实现只保留 user/assistant/tool 并映射 */
  private _convertToLlm: ConvertToLlm;
  /** 是否正在运行 agent 循环（prompt/continue 进行中） */
  private _isStreaming = false;
  /** 最近一次运行失败时的错误信息 */
  private _error?: string;
  /** 当前会话的 AbortController，用于 abort() 中断请求 */
  private _abortController: AbortController | null = null;
  /** 运行中用户中途输入的消息队列（steering），下一轮会注入 */
  private _steeringQueue: AgentMessage[] = [];
  /** 本轮结束后待处理的后续用户消息队列（follow-up） */
  private _followUpQueue: AgentMessage[] = [];
  /** 事件订阅者：收到 agent 流事件时逐一调用 */
  private _listeners = new Set<(e: AgentEvent) => void>();

  constructor(options: EngineAgentOptions) {
    this._model = options.model;
    this.getApiKey = options.getApiKey;
    this._systemPrompt = options.systemPrompt ?? "";
    this._tools = options.tools ?? [];
    this._temperature = options.temperature;
    this._maxTokens = options.maxTokens;
    this._transformContext = options.transformContext;
    this._convertToLlm = options.convertToLlm || defaultConvertToLlm;
  }

  /** 当前快照：systemPrompt、messages、tools、是否在流式、错误信息 */
  get state(): EngineAgentState {
    return {
      systemPrompt: this._systemPrompt,
      messages: [...this._messages],
      tools: [...this._tools],
      isStreaming: this._isStreaming,
      error: this._error,
    };
  }

  /** 设置系统提示，后续 prompt/continue 会使用新内容 */
  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
  }

  /** 替换当前工具列表 */
  setTools(tools: AgentTool[]): void {
    this._tools = tools;
  }

  /** 向对话历史末尾追加一条消息（不触发循环） */
  appendMessage(m: AgentMessage): void {
    this._messages.push(m);
  }

  /** 清空对话历史，系统提示和工具不变 */
  clearMessages(): void {
    this._messages = [];
  }

  /** 订阅 agent 流事件（message_start、message_update、message_end、turn_end 等），返回取消订阅函数 */
  subscribe(fn: (e: AgentEvent) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** 向所有订阅者派发一条事件 */
  private emit(e: AgentEvent): void {
    for (const fn of this._listeners) fn(e);
  }

  /** 中断当前正在进行的 agent 请求（若有） */
  abort(): void {
    this._abortController?.abort();
  }

  /**
   * 发送一条用户消息并运行 agent 循环，返回最终助手文本（最后一条 assistant content）
   */
  async prompt(userMessage: string): Promise<void> {
    if (this._isStreaming) {
      throw new Error("EngineAgent is already processing. Wait for completion or use steer/followUp.");
    }
    const msg: UserMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    await this.runLoop([msg]);
  }

  /**
   * 从当前 context 继续（用于 retry 或队列中的下一条）
   */
  async continue(): Promise<void> {
    if (this._isStreaming) {
      throw new Error("EngineAgent is already processing.");
    }
    if (this._messages.length === 0) throw new Error("No messages to continue from.");
    const last = this._messages[this._messages.length - 1];
    if (last.role === "assistant") {
      throw new Error("Cannot continue from assistant message.");
    }
    this.runLoop(undefined);
  }

  private async runLoop(initialPrompts?: AgentMessage[]) {
    this._isStreaming = true;
    this._error = undefined;
    this._abortController = new AbortController();

    const context: AgentContext = {
      systemPrompt: this._systemPrompt,
      messages: [...this._messages],
      tools: this._tools.length ? this._tools : undefined,
    };

    const config: AgentLoopConfig = {
      model: this._model,
      agentTools: this._tools.length ? this._tools : undefined,
      temperature: this._temperature,
      max_tokens: this._maxTokens,
      signal: this._abortController?.signal,
      transformContext: this._transformContext,
      convertToLlm: this._convertToLlm,
      getApiKey: this.getApiKey,
    };

    const stream = initialPrompts
      ? agentLoop(initialPrompts, context, config)
      : agentLoopContinue(context, config);

    
    try {
      for await (const event of stream) {
        this.emit(event);
        switch (event.type) {
          case "message_end":
            this._messages.push(event.message);
            if (event.message.role === "assistant" && event.message.content) {
              // lastAssistantContent = event.message.content;
            }
            break;
          case "agent_end":
            break;
          default:
            break;
        }
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this._isStreaming = false;
      this._abortController = null;
    }
  }
}
