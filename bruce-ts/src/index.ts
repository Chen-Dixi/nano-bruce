/**
 * @nano-bruce/agent — TypeScript client-side agent with skills support.
 * Python (bruce/) is used for backend services; agent runs in TS for minimal surface, local data, user-owned.
 */

export { Agent, type AgentOptions } from "./agent.js";
export { createLLM, chatCompletion, type LLMOptions } from "./llm.js";
export { PromptBuilder } from "./prompt-builder.js";
export { SkillRegistry, type SkillProperties } from "./skill-registry.js";
export { getDefaultTools } from "./tools.js";
export { runSkillScript } from "./run-script.js";
