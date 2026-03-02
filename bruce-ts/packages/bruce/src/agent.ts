/**
 * Bruce Agent 门面：组合 agent 引擎 + ai provider + SkillRegistry + PromptBuilder
 */

import type { LLMProvider } from "@nano-bruce/ai";
import { EngineAgent } from "@nano-bruce/agent-core";
import { PromptBuilder } from "./prompt-builder.js";
import type { SkillRegistry } from "./skill-registry.js";
import { getBruceAgentTools } from "./bruce-tools.js";

export interface AgentOptions {
  provider: LLMProvider;
  model: string;
  skillRegistry: SkillRegistry;
  promptBuilder?: PromptBuilder;
  toolsEnabled?: boolean;
  temperature?: number;
}

/**
 * 对外 Agent：基于 agent 引擎与 ai provider 的 Bruce 技能 Agent
 */
export class Agent {
  private engine: EngineAgent;
  private registry: SkillRegistry;
  private promptBuilder: PromptBuilder;

  constructor(options: AgentOptions) {
    const {
      provider,
      model,
      skillRegistry,
      promptBuilder = new PromptBuilder(skillRegistry),
      toolsEnabled = true,
      temperature = 0.7,
    } = options;

    this.registry = skillRegistry;
    this.promptBuilder = promptBuilder;
    const systemPrompt = promptBuilder.buildSystemPrompt();
    const tools = toolsEnabled ? getBruceAgentTools({ registry: skillRegistry }) : [];

    this.engine = new EngineAgent({
      provider,
      model,
      systemPrompt,
      tools,
      temperature,
    });
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
  ): Promise<string> {
    const { systemOverride = null, skillNames = null } = options ?? {};
    if (systemOverride != null) this.engine.setSystemPrompt(systemOverride);
    else if (skillNames != null)
      this.engine.setSystemPrompt(this.promptBuilder.buildSystemPrompt(skillNames));
    return this.engine.prompt(userMessage);
  }

  listSkills(): string[] {
    return this.registry.listSkills();
  }
}
