/**
 * 4 个元工具（read、bash、write、edit），对齐 Pi coding-agent 的工厂 + Operations 模式。
 * createCodingTools(cwd, options?) 返回配置好的工具数组，供 Agent 使用。
 */

import type { AgentTool } from "@nano-bruce/agent-core";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";

export { createReadTool } from "./read.js";
export type { ReadToolDetails, ReadToolOptions, ReadOperations } from "./read.js";
export { createWriteTool } from "./write.js";
export type { WriteToolOptions, WriteOperations } from "./write.js";
export { createEditTool } from "./edit.js";
export type { EditToolDetails, EditToolOptions, EditOperations } from "./edit.js";
export { createBashTool } from "./bash.js";
export type { BashToolDetails, BashToolOptions, BashOperations } from "./bash.js";
export { resolveToCwd, resolveReadPath, expandPath } from "./path-utils.js";
export {
  truncateHead,
  truncateTail,
  formatSize,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_BYTES,
} from "./truncate.js";
export type { TruncationResult, TruncationOptions } from "./truncate.js";

export interface CodingToolsOptions {
  read?: Parameters<typeof createReadTool>[1];
  write?: Parameters<typeof createWriteTool>[1];
  edit?: Parameters<typeof createEditTool>[1];
  bash?: Parameters<typeof createBashTool>[1];
}

/**
 * 创建针对给定工作目录配置的 4 个编码工具：read、bash、write、edit。
 */
export function createCodingTools(cwd: string, options?: CodingToolsOptions): AgentTool[] {
  return [
    createReadTool(cwd, options?.read),
    createBashTool(cwd, options?.bash),
    createEditTool(cwd, options?.edit),
    createWriteTool(cwd, options?.write),
  ];
}
