/**
 * Build system prompts with <available_skills> block (Builder pattern).
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
