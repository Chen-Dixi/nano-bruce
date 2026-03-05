/**
 * OpenAI 兼容 API 的 Provider 实现
 *
 * 通过 baseURL 可对接 OpenAI、Moonshot、DeepSeek 等兼容 OpenAI 的接口。
 * 流式将 SSE 积累到 content 块数组并发出带 partial 的事件，仿 Pi-mono。
 */

import OpenAI from "openai";
import type {
  ChatMessage,
  ChatResult,
  ChatTool,
  ChatOptions,
  LLMProvider,
  ChatStreamEvent,
  AssistantMessage,
  ChatContentBlock,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  StopReason,
} from "../types.js";
import { AssistantMessageEventStream } from "../types.js";

export interface OpenAIProviderConfig {
  apiKey: string;
  baseURL?: string;
}

/** 流式 JSON 片段累积后尝试解析，解析失败返回 {} */
function parseStreamingJson(s: string): Record<string, unknown> {
  if (!s || !s.trim()) return {};
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o !== null ? o : {};
  } catch {
    return {};
  }
}

/**
 * 共享流式逻辑：消费 OpenAI stream 并产出 ChatStreamEvent，供 chatStream 与 streamChat 复用（仿 Pi-mono）
 */
async function* streamOpenAIChatEvents(
  client: OpenAI,
  messages: ChatMessage[],
  options: ChatOptions
): AsyncIterable<ChatStreamEvent> {
  const { model, temperature = 0.7, max_tokens, tools, signal } = options;
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model,
    messages: messages.map(toOpenAIMessage),
    temperature,
    stream: true,
  };
  if (max_tokens != null) body.max_completion_tokens = max_tokens;
  if (tools?.length) body.tools = tools.map(toOpenAITool);

  const apiStream = await client.chat.completions.create({
    ...body,
    ...(signal && { signal }),
  });

  const output: AssistantMessage = {
    role: "assistant",
    content: [],
    stopReason: "stop",
    timestamp: Date.now(),
  };

  type Block = TextContent | (ThinkingContent & { thinkingSignature?: string }) | (ToolCallContent & { partialArgs?: string });
  let currentBlock: Block | null = null;
  const blocks = output.content as Block[];
  const blockIndex = () => blocks.length - 1;

  const finishAndEmitEnd = function* (block: Block | null): Generator<ChatStreamEvent> {
    if (!block) return;
    if (block.type === "text") {
      yield {
        type: "text_end",
        contentIndex: blockIndex(),
        content: block.text,
        partial: output,
      };
    } else if (block.type === "thinking") {
      yield {
        type: "thinking_end",
        contentIndex: blockIndex(),
        content: block.thinking,
        partial: output,
      };
    } else if (block.type === "toolCall") {
      const t = block as ToolCallContent & { partialArgs?: string };
      t.arguments = parseStreamingJson(t.partialArgs ?? "{}");
      delete t.partialArgs;
      yield {
        type: "toolcall_end",
        contentIndex: blockIndex(),
        toolCall: block as ToolCallContent,
        partial: output,
      };
    }
  };

  yield { type: "start", partial: output };

  try {
    for await (const chunk of apiStream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
      const delta = chunk.choices?.[0]?.delta;
      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason) {
        if (finishReason === "stop") output.stopReason = "stop";
        else if (finishReason === "length") output.stopReason = "length";
        else if (finishReason === "tool_calls" || finishReason === "function_call") output.stopReason = "tool_calls";
      }
      if (!delta) continue;

      if (typeof delta.content === "string" && delta.content.length > 0) {
        if (!currentBlock || currentBlock.type !== "text") {
          for (const e of finishAndEmitEnd(currentBlock)) yield e;
          currentBlock = { type: "text", text: "" };
          blocks.push(currentBlock);
          yield { type: "text_start", contentIndex: blockIndex(), partial: output };
        }
        (currentBlock as TextContent).text += delta.content;
        yield {
          type: "text_delta",
          contentIndex: blockIndex(),
          delta: delta.content,
          partial: output,
        };
      }

      const reasoningFields = ["reasoning_content", "reasoning", "reasoning_text"];
      let reasoningDelta: string | null = null;
      for (const field of reasoningFields) {
        const v = (delta as Record<string, unknown>)[field];
        if (typeof v === "string" && v.length > 0) {
          reasoningDelta = v;
          break;
        }
      }
      if (reasoningDelta) {
        if (!currentBlock || currentBlock.type !== "thinking") {
          for (const e of finishAndEmitEnd(currentBlock)) yield e;
          currentBlock = { type: "thinking", thinking: "" };
          blocks.push(currentBlock);
          yield { type: "thinking_start", contentIndex: blockIndex(), partial: output };
        }
        (currentBlock as ThinkingContent).thinking += reasoningDelta;
        yield {
          type: "thinking_delta",
          contentIndex: blockIndex(),
          delta: reasoningDelta,
          partial: output,
        };
      }

      if (delta.tool_calls?.length) {
        for (const tc of delta.tool_calls) {
          const i = tc.index ?? blocks.length;
          while (blocks.length <= i) {
            for (const e of finishAndEmitEnd(currentBlock)) yield e;
            currentBlock = {
              type: "toolCall",
              id: "",
              name: "",
              arguments: {},
              partialArgs: "",
            };
            blocks.push(currentBlock);
            yield { type: "toolcall_start", contentIndex: blockIndex(), partial: output };
          }
          const cur = blocks[i] as ToolCallContent & { partialArgs?: string };
          if (tc.id != null) cur.id = tc.id;
          if (tc.function?.name != null) cur.name = tc.function.name;
          if (tc.function?.arguments != null) {
            cur.partialArgs = (cur.partialArgs ?? "") + tc.function.arguments;
            cur.arguments = parseStreamingJson(cur.partialArgs);
          }
          yield {
            type: "toolcall_delta",
            contentIndex: i,
            delta: tc.function?.arguments ?? "",
            partial: output,
          };
        }
      }
    }

    for (const e of finishAndEmitEnd(currentBlock)) yield e;

    yield { type: "done", reason: (output.stopReason ?? "stop") as StopReason, message: output };
  } catch (err) {
    output.stopReason = options.signal?.aborted ? "aborted" : "error";
    output.errorMessage = err instanceof Error ? err.message : String(err);
    yield { type: "error", reason: output.stopReason as "aborted" | "error", error: output };
  }
}

/**
 * 使用 OpenAI SDK 创建 LLMProvider。
 * baseURL 不传时使用官方 https://api.openai.com/v1
 */
export function createOpenAIProvider(config: OpenAIProviderConfig): LLMProvider {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL ?? "https://api.openai.com/v1",
  });

  return {
    async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
      const { model, temperature = 0.7, max_tokens, tools, signal } = options;

      const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: messages.map(toOpenAIMessage),
        temperature,
      };
      if (max_tokens != null) body.max_tokens = max_tokens;
      if (tools?.length) body.tools = tools.map(toOpenAITool);

      const response = await client.chat.completions.create({
        ...body,
        stream: false,
        ...(signal && { signal }),
      });

      const choice = response.choices[0];
      if (!choice?.message) {
        return {
          message: { role: "assistant", content: [] },
          usage: response.usage as ChatResult["usage"],
        };
      }

      const msg = choice.message;
      const content: ChatContentBlock[] = [];

      let textContent: string | null = null;
      if (typeof msg.content === "string") textContent = msg.content;
      else if (Array.isArray(msg.content) && msg.content[0] && (msg.content[0] as { type?: string }).type === "text")
        textContent = (msg.content[0] as { text: string }).text ?? null;
      if (textContent != null && textContent.length > 0) content.push({ type: "text", text: textContent });

      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          const argsStr = tc.function?.arguments ?? "{}";
          content.push({
            type: "toolCall",
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            arguments: parseStreamingJson(argsStr),
          });
        }
      }

      return {
        message: {
          role: "assistant",
          content,
          stopReason: "stop",
          timestamp: Date.now(),
        },
        usage: response.usage as ChatResult["usage"],
      };
    },

    async *chatStream(messages: ChatMessage[], options: ChatOptions): AsyncIterable<ChatStreamEvent> {
      yield* streamOpenAIChatEvents(client, messages, options);
    },

    streamChat(messages: ChatMessage[], options: ChatOptions): AssistantMessageEventStream {
      const stream = new AssistantMessageEventStream();
      (async () => {
        for await (const event of streamOpenAIChatEvents(client, messages, options)) {
          stream.push(event);
        }
      })();
      return stream;
    },
  };
}

function toOpenAIMessage(m: ChatMessage): OpenAI.Chat.Completions.ChatCompletionMessageParam {
  if (m.role === "system") return { role: "system", content: m.content };
  if (m.role === "user") return { role: "user", content: m.content };
  if (m.role === "assistant") {
    if (m.tool_calls?.length)
      return {
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    return { role: "assistant", content: m.content ?? "" };
  }
  return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
}

function toOpenAITool(t: ChatTool): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as Record<string, unknown> | undefined,
    },
  };
}
