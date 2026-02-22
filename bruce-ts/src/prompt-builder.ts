/**
 * 系统提示构建器（Builder 模式）：组装「基础说明 + <available_skills> XML」
 *
 * 输出格式符合 Anthropic Agent Skills 协议，便于模型识别可用 skill 及 location（SKILL.md 路径）。
 */

import type { SkillRegistry } from "./skill-registry.js";

const DEFAULT_SYSTEM =
  "You are a helpful AI assistant with access to skills. " +
  "When a task matches a skill's description, use that skill by reading its " +
  "full instructions from the location provided. Follow the skill's " +
  "guidelines to complete the task.";

export class PromptBuilder {
  private registry: SkillRegistry;
  private systemBase: string;

  constructor(registry: SkillRegistry, systemBase?: string) {
    this.registry = registry;
    this.systemBase = systemBase ?? DEFAULT_SYSTEM;
  }

  /** 生成完整 system prompt：systemBase + 可选的 <available_skills> + 可选的 extraBlocks */
  buildSystemPrompt(skillNames?: string[] | null, extraBlocks?: string[] | null): string {
    const parts: string[] = [this.systemBase];
    const skillsXml = this.registry.getAvailableSkillsXml(skillNames);
    if (skillsXml.trim() !== "<available_skills>\n</available_skills>") {
      parts.push("");
      parts.push(skillsXml);
    }
    if (extraBlocks?.length) {
      parts.push("");
      parts.push(...extraBlocks);
    }
    return parts.join("\n");
  }
}
