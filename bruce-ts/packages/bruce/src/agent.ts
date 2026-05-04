/**
 * Bruce Agent 门面：组合 agent 引擎 + ai provider + SkillRegistry + PromptBuilder + 元工具
 */

import type { Model } from "@nano-bruce/ai";
import { EngineAgent } from "@nano-bruce/agent-core";
import { PromptBuilder } from "./prompt-builder.js";
import type { SkillRegistry } from "./skill-registry.js";
import { getBruceAgentTools } from "./bruce-tools.js";
import { createCodingTools } from "./core/tools/index.js";
import type { AgentEvent } from "@nano-bruce/agent-core";
import type { CodingToolsOptions } from "./core/tools/index.js";

export interface AgentOptions {
  model: Model<any>;
  skillRegistry: SkillRegistry;
  promptBuilder?: PromptBuilder;
  toolsEnabled?: boolean;
  /** 工作目录，供 read/write/edit/bash 等元工具解析相对路径，默认 process.cwd() */
  cwd?: string;
  /** 是否启用 4 个元工具（read、bash、write、edit），默认 true；与 skills 工具同时生效 */
  codingTools?: boolean;
  /** 元工具可选配置（Operations 等） */
  codingToolsOptions?: CodingToolsOptions;
  temperature?: number;
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
}

/**
 * 对外 Agent：基于 agent 引擎与 ai stream 的 Bruce 技能 Agent
 */
export class Agent {
  private engine: EngineAgent;
  private registry: SkillRegistry;
  private promptBuilder: PromptBuilder;
  /** session 内已加载的 skill 名称，避免重复返回全文 */
  private loadedSkills = new Set<string>();

  constructor(options: AgentOptions) {
    const {
      model,
      skillRegistry,
      promptBuilder = new PromptBuilder(skillRegistry),
      toolsEnabled = true,
      cwd = process.cwd(),
      codingTools = true,
      codingToolsOptions,
      temperature = 0.7,
      getApiKey,
    } = options;

    this.registry = skillRegistry;
    this.promptBuilder = promptBuilder;
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const skillTools = toolsEnabled
      ? getBruceAgentTools({ registry: skillRegistry, loadedSkills: this.loadedSkills })
      : [];
    const metaTools =
      toolsEnabled && codingTools ? createCodingTools(cwd, codingToolsOptions) : [];
    const tools = [...skillTools, ...metaTools];

    this.engine = new EngineAgent({
      model,
      systemPrompt,
      tools,
      temperature,
      getApiKey,
    });
  }

  subscribe(fn: (e: AgentEvent) => void): () => void {
    return this.engine.subscribe(fn);
  }
  

  /**
   * 单次对话：发一条用户消息，跑完 agent 循环（含工具调用），返回最后一条助手文本
   */
  async chat(
    userMessage: string,
    options?: {
      systemOverride?: string | null;
      skillNames?: string[] | null;
      temperature?: number;
    }
  ): Promise<void> {
    const { systemOverride = null, skillNames = null } = options ?? {};
    if (systemOverride != null) this.engine.setSystemPrompt(systemOverride);
    else if (skillNames != null)
      this.engine.setSystemPrompt(this.promptBuilder.buildSystemPrompt(skillNames));
    await this.engine.prompt(userMessage);
  }

  listSkills(): string[] {
    return this.registry.listSkills();
  }

  /** 获取当前 session 已加载的 skill 名称列表 */
  getLoadedSkills(): string[] {
    return [...this.loadedSkills];
  }

  /** 清空已加载的 skill 记录，下次 load_skill 会重新返回全文 */
  resetLoadedSkills(): void {
    this.loadedSkills.clear();
  }

  /** 获取当前对话历史（副本） */
  getMessageHistory(): import("@nano-bruce/agent-core").AgentMessage[] {
    return this.engine.getMessages();
  }

  /** 设置对话历史（用于恢复 session） */
  setMessageHistory(messages: import("@nano-bruce/agent-core").AgentMessage[]): void {
    this.engine.setMessages(messages);
  }
}
