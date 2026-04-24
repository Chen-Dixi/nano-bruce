/**
 * Session 类型定义
 *
 * Session 存储用户与 Agent 的对话历史，支持多轮对话持久化
 */

import type { AgentMessage } from "@nano-bruce/agent-core";

export interface Session {
  /** UUID v4 标识 */
  uuid: string;
  /** 对话历史消息 */
  messages: AgentMessage[];
  /** 创建时间（Unix timestamp ms） */
  createdAt: number;
  /** 最后更新时间（Unix timestamp ms） */
  updatedAt: number;
  /** 可选元数据 */
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  /** 启动时的工作目录 */
  cwd?: string;
  /** skills 目录路径 */
  skillsDir?: string;
  /** 默认 provider */
  provider?: string;
  /** 默认 model */
  model?: string;
}

export interface SessionListItem {
  uuid: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}