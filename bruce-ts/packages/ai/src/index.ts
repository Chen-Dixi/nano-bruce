/**
 * AI 层：不同大模型厂商的 Provider 适配
 *
 * 对外暴露 createProvider(providerName, config)，返回统一的 LLMProvider，
 * 供 agent 层调用，不关心具体 API 形态。
 */

import type { LLMProvider } from "./types.js";
import { createOpenAIProvider } from "./openai-provider.js";
export type {
  ChatMessage,
  ChatResult,
  ChatTool,
  ChatOptions,
  LLMProvider,
} from "./types.js";
export { createOpenAIProvider } from "./openai-provider.js";
export { createLLM, chatCompletion, type LLMOptions } from "./llm.js";

export type ProviderName = "openai" | "moonshot" | "deepseek";

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  moonshot: "kimi-k2-turbo-preview",
  deepseek: "deepseek-chat",
};

const DEFAULT_BASE_URLS: Record<ProviderName, string | undefined> = {
  openai: undefined,
  moonshot: "https://api.moonshot.cn/v1",
  deepseek: "https://api.deepseek.com",
};

/**
 * 根据厂商名和配置创建 LLMProvider，并返回默认 model/baseURL（用于调用方拼 options）
 */
export function createProvider(
  name: ProviderName,
  config: { apiKey: string; baseURL?: string; model?: string }
): { provider: LLMProvider; model: string; baseURL?: string } {
  const baseURL = config.baseURL ?? DEFAULT_BASE_URLS[name];
  const model = config.model ?? DEFAULT_MODELS[name];
  const provider = createOpenAIProvider({
    apiKey: config.apiKey,
    baseURL,
  });
  return { provider, model, baseURL };
}
