/**
 * Agent 类：封装状态与循环入口，参考 Pi Agent
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
  UserMessage,
} from "./types.js";
import type { LLMProvider } from "../ai/types.js";

export interface AgentOptions {
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  tools?: AgentTool[];
  temperature?: number;
  maxTokens?: number;

  /** 可选：动态 API key（如过期 token） */
  getApiKey?: () => Promise<string | undefined> | string | undefined;

  /** 可选：context 转换（裁剪/注入） */
  transformContext?: (
    messages: AgentMessage[],
    signal?: AbortSignal
  ) => AgentMessage[] | Promise<AgentMessage[]>;

  /** 是否启用 steering/follow-up 队列（默认 false，CLI 单轮不需要） */
  steeringMode?: "all" | "one-at-a-time";
  followUpMode?: "all" | "one-at-a-time";
}

export interface AgentState {
  systemPrompt: string;
  messages: AgentMessage[];
  tools: AgentTool[];
  isStreaming: boolean;
  error?: string;
}

export class Agent {
  private _provider: LLMProvider;
  private _model: string;
  private _systemPrompt: string;
  private _messages: AgentMessage[] = [];
  private _tools: AgentTool[];
  private _temperature?: number;
  private _maxTokens?: number;
  private _transformContext?: AgentOptions["transformContext"];
  private _isStreaming = false;
  private _error?: string;
  private _abortController: AbortController | null = null;
  private _steeringQueue: AgentMessage[] = [];
  private _followUpQueue: AgentMessage[] = [];
  private _listeners = new Set<(e: AgentEvent) => void>();

  constructor(options: AgentOptions) {
    this._provider = options.provider;
    this._model = options.model;
    this._systemPrompt = options.systemPrompt ?? "";
    this._tools = options.tools ?? [];
    this._temperature = options.temperature;
    this._maxTokens = options.maxTokens;
    this._transformContext = options.transformContext;
  }

  get state(): AgentState {
    return {
      systemPrompt: this._systemPrompt,
      messages: [...this._messages],
      tools: [...this._tools],
      isStreaming: this._isStreaming,
      error: this._error,
    };
  }

  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
  }

  setTools(tools: AgentTool[]): void {
    this._tools = tools;
  }

  appendMessage(m: AgentMessage): void {
    this._messages.push(m);
  }

  clearMessages(): void {
    this._messages = [];
  }

  subscribe(fn: (e: AgentEvent) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private emit(e: AgentEvent): void {
    for (const fn of this._listeners) fn(e);
  }

  abort(): void {
    this._abortController?.abort();
  }

  /**
   * 发送一条用户消息并运行 agent 循环，返回最终助手文本（最后一条 assistant content）
   */
  async prompt(userMessage: string): Promise<string> {
    if (this._isStreaming) {
      throw new Error("Agent is already processing. Wait for completion or use steer/followUp.");
    }
    const msg: UserMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    return this.runLoop([msg]);
  }

  /**
   * 从当前 context 继续（用于 retry 或队列中的下一条）
   */
  async continue(): Promise<string> {
    if (this._isStreaming) {
      throw new Error("Agent is already processing.");
    }
    if (this._messages.length === 0) throw new Error("No messages to continue from.");
    const last = this._messages[this._messages.length - 1];
    if (last.role === "assistant") {
      throw new Error("Cannot continue from assistant message.");
    }
    return this.runLoop(undefined);
  }

  private async runLoop(initialPrompts?: AgentMessage[]): Promise<string> {
    this._isStreaming = true;
    this._error = undefined;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const context: AgentContext = {
      systemPrompt: this._systemPrompt,
      messages: [...this._messages],
      tools: this._tools.length ? this._tools : undefined,
    };

    const config: AgentLoopConfig = {
      provider: this._provider,
      model: this._model,
      systemPrompt: this._systemPrompt,
      tools: this._tools.length ? this._tools : undefined,
      temperature: this._temperature,
      maxTokens: this._maxTokens,
      signal,
      transformContext: this._transformContext,
    };

    const stream = initialPrompts
      ? agentLoop(initialPrompts, context, config)
      : agentLoopContinue(context, config);

    let lastAssistantContent = "";
    try {
      for await (const event of stream) {
        this.emit(event);
        switch (event.type) {
          case "message_end":
            this._messages.push(event.message);
            if (event.message.role === "assistant" && event.message.content) {
              lastAssistantContent = event.message.content;
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

    return lastAssistantContent;
  }
}
