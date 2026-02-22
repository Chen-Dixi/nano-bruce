/**
 * Bruce 基于 Pi 的 Agent 封装
 *
 * 使用 @mariozechner/pi-agent-core 的 Agent，配合 Bruce 的 skill 工具（read_file / list_skills / load_skill / run_skill_script）。
 * 从 pi-ai 引入 streamSimple、getModel 时会自动注册内置 provider（含 kimi-coding），无需额外配置。
 */

import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import type { SkillRegistry } from "./skill-registry.js";
import { PromptBuilder } from "./prompt-builder.js";
import { createBruceToolsWithDefaultReadFile } from "./pi-tools.js";

/** 支持的 Pi 提供方（与 pi-ai 的 getModel 第一个参数一致） */
export type BrucePiProvider = "kimi-coding" | "openai" | "anthropic";

/** 常用模型 ID，也可传 pi-ai 支持的其他字符串 */
export type BrucePiModelId =
  | "kimi-k2"
  | "kimi-k2-thinking"
  | "kimi-k2.5"
  | "k2p5"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "claude-sonnet-4-20250514";

/**
 * 创建基于 Pi 的 Bruce Agent
 *
 * 会：1）用 PromptBuilder 生成含 <available_skills> 的系统提示；2）用 pi-ai 的 getModel 取模型；
 * 3）用 createBruceToolsWithDefaultReadFile 生成四个工具；4）实例化 Pi 的 Agent 并返回。
 *
 * @param registry - 已 load 过的 SkillRegistry
 * @param options.provider - 如 "kimi-coding"（需 KIMI_API_KEY）、"openai"（需 OPENAI_API_KEY）
 * @param options.modelId - 如 "kimi-k2"、"gpt-4o-mini"
 * @param options.systemBase - 可选，覆盖默认系统提示前缀
 * @param options.skillNames - 可选，只把指定 skill 纳入 available_skills
 */
export function createBrucePiAgent(
  registry: SkillRegistry,
  options: {
    provider: BrucePiProvider;
    modelId: BrucePiModelId | string;
    systemBase?: string;
    skillNames?: string[] | null;
  }
): Agent {
  const { provider, modelId, systemBase, skillNames } = options;

  const promptBuilder = new PromptBuilder(registry, systemBase);
  const systemPrompt = promptBuilder.buildSystemPrompt(skillNames);

  // getModel 类型较严格，用类型断言兼容不同 provider/modelId 组合
  const model = (getModel as (p: string, m: string) => unknown)(provider, modelId);
  const tools = createBruceToolsWithDefaultReadFile(registry);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: model as Parameters<InstanceType<typeof Agent>["setModel"]>[0],
      tools,
      messages: [],
    },
    streamFn: streamSimple,
  });

  return agent;
}

/**
 * 发一条用户消息并等待 Agent 跑完，返回最后一条助手回复的纯文本
 *
 * 适用于 CLI 或简单一问一答：内部会 agent.prompt(userMessage) -> waitForIdle()，
 * 再从 state.messages 里倒序找到最后一条 role=assistant 的 content 并拼接成字符串。
 */
export async function runBrucePiPrompt(
  agent: Agent,
  userMessage: string
): Promise<string> {
  await agent.prompt(userMessage);
  await agent.waitForIdle();

  const messages = agent.state.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && typeof m === "object" && "role" in m && m.role === "assistant" && "content" in m) {
      const c = (m as { content: unknown }).content;
      if (Array.isArray(c)) {
        const text = c
          .filter((x): x is { type: "text"; text: string } => x && typeof x === "object" && (x as { type?: string }).type === "text")
          .map((x) => x.text)
          .join("");
        if (text) return text;
      }
      if (typeof c === "string") return c;
    }
  }
  return "";
}
