/**
 * OpenAI-compatible LLM client (Strategy). Use baseURL for Moonshot, DeepSeek, etc.
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions.js";

export interface LLMOptions {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export function createLLM(options: LLMOptions): OpenAI {
  const { apiKey, baseURL, model: _ } = options;
  return new OpenAI({
    apiKey,
    baseURL: baseURL ?? "https://api.openai.com/v1",
  });
}

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
