/**
 * OpenAI 兼容的 LLM 客户端（Strategy 模式）
 *
 * 通过 baseURL 可对接 Moonshot、DeepSeek 等兼容 OpenAI 的 API；
 * 本模块供 legacy Agent 使用，Pi 路径用 pi-ai 的 getModel + streamSimple。
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";

export interface LLMOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

/** 创建 OpenAI 实例，未传 baseURL 时默认官方 API */
export function createLLM(options: LLMOptions): OpenAI {
  const { apiKey, baseURL, model: _ } = options;
  return new OpenAI({
    apiKey,
    baseURL: baseURL ?? "https://api.openai.com/v1",
  });
}

/** 一次 chat completion 调用，支持 tools（Function Calling） */
export async function chatCompletion(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
  options: {
    model: string;
    temperature?: number;
    tools?: ChatCompletionTool[];
  }
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const { model, temperature = 0.7, tools } = options;
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    temperature,
  };
  if (tools?.length) body.tools = tools;
  return client.chat.completions.create(body);
}
