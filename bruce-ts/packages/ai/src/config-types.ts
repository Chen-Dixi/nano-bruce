/**
 * 配置系统类型定义
 */

import type { KnownProvider } from "./types.js";

/** 单个 Provider 的配置 */
export interface ProviderSettings {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

/** 用户偏好设置 */
export interface UserPreferences {
  defaultProvider?: KnownProvider;
  streamOutput?: boolean;
}

/** 工作目录配置 */
export interface WorkingDirSettings {
  skillsDir?: string;
  memoryDir?: string;
}

/** 完整配置文件结构 */
export interface SettingsConfig {
  providers?: Partial<Record<KnownProvider, ProviderSettings>>;
  preferences?: UserPreferences;
  workingDir?: WorkingDirSettings;
}

/** 默认配置 */
export const DEFAULT_SETTINGS: SettingsConfig = {
  providers: {},
  preferences: {
    defaultProvider: "moonshot",
    streamOutput: true,
  },
  workingDir: {
    skillsDir: undefined, // 将在加载时动态计算
    memoryDir: undefined,
  },
};

/** 配置文件路径 */
export const DEFAULT_SETTINGS_FILE = "settings.json";
export const DEFAULT_BRUCE_DIR = ".bruce";