/**
 * OpenAI 兼容 API 的 Provider 实现
 *
 * 通过 baseURL 可对接 OpenAI、Moonshot、DeepSeek 等兼容 OpenAI 的接口。
 */

import OpenAI from "openai";
import type { ChatMessage, ChatResult, ChatTool, ChatOptions, LLMProvider } from "./types.js";

export interface OpenAIProviderConfig {
  apiKey: string;
  baseURL?: string;
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
          message: { role: "assistant", content: "" },
          usage: response.usage as ChatResult["usage"],
        };
      }

      const msg = choice.message;
      const toolCalls = msg.tool_calls?.map((tc) => ({
        id: tc.id ?? "",
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "{}",
      }));

      let content: string | null = null;
      if (typeof msg.content === "string") content = msg.content;
      else if (Array.isArray(msg.content) && msg.content[0] && typeof (msg.content[0] as { type?: string }).type === "string" && (msg.content[0] as { type: string; text?: string }).type === "text")
        content = (msg.content[0] as { text: string }).text ?? null;

      return {
        message: {
          role: "assistant",
          content,
          tool_calls: toolCalls?.length ? toolCalls : undefined,
        },
        usage: response.usage as ChatResult["usage"],
      };
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
