/**
 * 配置文件读取与管理
 *
 * 配置优先级：环境变量 > 配置文件 > 默认值
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  SettingsConfig,
  ProviderSettings,
  KnownProvider,
  DEFAULT_SETTINGS,
} from "@nano-bruce/ai";
import { DEFAULT_SETTINGS as BASE_DEFAULT_SETTINGS, DEFAULT_BRUCE_DIR, DEFAULT_SETTINGS_FILE } from "@nano-bruce/ai";

/** Bruce 目录路径（默认 ~/.bruce） */
export function getBruceDir(): string {
  return path.join(os.homedir(), DEFAULT_BRUCE_DIR);
}

/** 配置文件路径（默认 ~/.bruce/settings.json） */
export function getSettingsPath(): string {
  return path.join(getBruceDir(), DEFAULT_SETTINGS_FILE);
}

/** 从文件加载配置 */
export function loadSettingsFromFile(): SettingsConfig | null {
  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed as SettingsConfig;
  } catch (err) {
    console.error(`Failed to parse settings file at ${settingsPath}:`, err);
    return null;
  }
}

/** 从环境变量获取 Provider API Key */
function getApiKeyFromEnv(provider: KnownProvider): string | undefined {
  const envMap: Partial<Record<KnownProvider, string>> = {
    openai: "OPENAI_API_KEY",
    moonshot: "MOONSHOT_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GEMINI_API_KEY",
    groq: "GROQ_API_KEY",
    xai: "XAI_API_KEY",
    mistral: "MISTRAL_API_KEY",
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : undefined;
}

/** 从环境变量获取 Provider baseURL */
function getBaseURLFromEnv(provider: KnownProvider): string | undefined {
  const envMap: Partial<Record<KnownProvider, string>> = {
    openai: "OPENAI_BASE_URL",
    moonshot: "MOONSHOT_BASE_URL",
    deepseek: "DEEPSEEK_BASE_URL",
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : undefined;
}

/** 合并单个 Provider 配置：环境变量 > 配置文件 */
export function mergeProviderSettings(
  provider: KnownProvider,
  fileSettings?: ProviderSettings
): ProviderSettings {
  const envApiKey = getApiKeyFromEnv(provider);
  const envBaseURL = getBaseURLFromEnv(provider);

  return {
    apiKey: envApiKey ?? fileSettings?.apiKey,
    baseURL: envBaseURL ?? fileSettings?.baseURL,
    defaultModel: fileSettings?.defaultModel,
  };
}

/** 合并完整配置：环境变量 > 配置文件 > 默认值 */
export function mergeSettings(): SettingsConfig {
  const fileSettings = loadSettingsFromFile() ?? {};
  const defaultProvider = fileSettings.preferences?.defaultProvider ?? "moonshot";

  // 合并各 Provider 配置
  const mergedProviders: Partial<Record<KnownProvider, ProviderSettings>> = {};
  const providersToMerge = Object.keys(fileSettings.providers || {}) as KnownProvider[];

  // 确保默认 provider 被处理
  if (!providersToMerge.includes(defaultProvider)) {
    providersToMerge.push(defaultProvider);
  }

  for (const provider of providersToMerge) {
    mergedProviders[provider] = mergeProviderSettings(
      provider,
      fileSettings.providers?.[provider]
    );
  }

  return {
    providers: mergedProviders,
    preferences: {
      defaultProvider,
      streamOutput: fileSettings.preferences?.streamOutput ?? true,
    },
    workingDir: {
      skillsDir: fileSettings.workingDir?.skillsDir ?? path.join(getBruceDir(), "skills"),
      memoryDir: fileSettings.workingDir?.memoryDir ?? path.join(getBruceDir(), "memory"),
    },
  };
}

/** 获取有效配置（简化版，供 CLI 使用） */
export function getEffectiveConfig(): {
  provider: KnownProvider;
  apiKey: string;
  baseURL?: string;
  model: string;
} {
  const settings = mergeSettings();
  const provider = settings.preferences?.defaultProvider ?? "moonshot";
  const providerSettings = settings.providers?.[provider];

  if (!providerSettings?.apiKey) {
    throw new Error(
      `No API key configured for provider "${provider}".\n` +
      `Set environment variable or add to ~/.bruce/settings.json:\n` +
      `  Environment: export ${provider.toUpperCase()}_API_KEY=your-key\n` +
      `  Config file: { "providers": { "${provider}": { "apiKey": "your-key" } } }`
    );
  }

  // 默认 model
  const defaultModels: Partial<Record<KnownProvider, string>> = {
    openai: "gpt-4o-mini",
    moonshot: "kimi-k2-turbo-preview",
    deepseek: "deepseek-chat",
    anthropic: "claude-sonnet-4-6",
    google: "gemini-2.0-flash",
  };

  return {
    provider,
    apiKey: providerSettings.apiKey,
    baseURL: providerSettings.baseURL,
    model: providerSettings.defaultModel ?? defaultModels[provider] ?? "unknown",
  };
}

/** 初始化配置文件（生成默认模板） */
export function initSettings(): void {
  const bruceDir = getBruceDir();
  const settingsPath = getSettingsPath();

  // 创建目录
  if (!fs.existsSync(bruceDir)) {
    fs.mkdirSync(bruceDir, { recursive: true });
  }

  // 如果文件已存在，提示用户
  if (fs.existsSync(settingsPath)) {
    console.log(`Settings file already exists at ${settingsPath}`);
    console.log("To view: cat " + settingsPath);
    return;
  }

  // 写入默认配置模板
  const template = {
    providers: {
      moonshot: {
        apiKey: "YOUR_MOONSHOT_API_KEY_HERE",
        defaultModel: "kimi-k2-turbo-preview",
      },
      openai: {
        apiKey: "YOUR_OPENAI_API_KEY_HERE",
        defaultModel: "gpt-4o-mini",
      },
      deepseek: {
        apiKey: "YOUR_DEEPSEEK_API_KEY_HERE",
        defaultModel: "deepseek-chat",
      },
    },
    preferences: {
      defaultProvider: "moonshot",
      streamOutput: true,
    },
    workingDir: {
      skillsDir: null,
      memoryDir: null,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(template, null, 2));
  console.log(`Created settings file at ${settingsPath}`);
  console.log("\nPlease edit the file and add your API keys:");
  console.log(`  Edit: ${settingsPath}`);
}