/**
 * AI 层：不同大模型厂商的 Provider 适配
 *
 * 对外暴露 createProvider(providerName, config)，返回统一的 LLMProvider，
 * 供 agent 层调用，不关心具体 API 形态。
 */

import { createOpenAIProvider } from "./providers/openai-provider.js";
import type { LLMProvider, Model } from "./types.js";
export { EventStream } from "./event-stream.js";
export { chatCompletion, createLLM, type LLMOptions } from "./llm.js";
export { stream } from "./model-service.js";
export { createOpenAIProvider } from "./providers/openai-provider.js";
export * from "./providers/register.js";
export type {
  AssistantMessage,
  ChatContentBlock,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatStreamEvent,
  ChatTool,
  LLMProvider,
  Message,
  Model,
  StopReason,
  SystemMessage,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  ToolResultMessage,
  UserMessage,
  KnownProvider,
} from "./types.js";
export type {
  ProviderSettings,
  UserPreferences,
  WorkingDirSettings,
  SettingsConfig,
} from "./config-types.js";
export { DEFAULT_SETTINGS, DEFAULT_SETTINGS_FILE, DEFAULT_BRUCE_DIR } from "./config-types.js";

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

const API_BY_PROVIDER: Record<ProviderName, string> = {
  openai: "openai-completions",
  moonshot: "moonshot-completions",
  deepseek: "deepseek-completions",
};

/**
 * 根据厂商名和可选 modelId 创建 Model，供 Agent 与 stream 使用
 */
export function createModel(
  provider: ProviderName,
  modelId?: string
): Model<any> {
  const id = modelId ?? DEFAULT_MODELS[provider];
  const baseURL = DEFAULT_BASE_URLS[provider] ?? "";
  return {
    id,
    name: id,
    api: API_BY_PROVIDER[provider],
    provider,
    baseURL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
  };
}

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
