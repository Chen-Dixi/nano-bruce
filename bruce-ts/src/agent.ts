/**
 * 自实现的 Agent（Facade）：不依赖 Pi，直接用 OpenAI 兼容客户端 + 工具循环
 *
 * 流程：组 system prompt（含 available_skills）→ 调 LLM → 若有 tool_calls 则执行并追加 tool 结果 → 再调 LLM，直到无 tool_calls，返回最后一条 content。
 * 用于 moonshot / deepseek 等通过 baseURL 兼容 OpenAI 的场景；kimi-coding / openai 推荐用 Pi 版 createBrucePiAgent。
 */

import fs from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { chatCompletion } from "./llm.js";
import { PromptBuilder } from "./prompt-builder.js";
import type { SkillRegistry } from "./skill-registry.js";
import { runSkillScript } from "./run-script.js";
import { getDefaultTools } from "./tools.js";

export interface AgentOptions {
  client: OpenAI;
  model: string;
  skillRegistry: SkillRegistry;
  promptBuilder?: PromptBuilder;
  toolsEnabled?: boolean;
  readFileHandler?: (filePath: string) => string;
}

export class Agent {
  private client: OpenAI;
  private model: string;
  private registry: SkillRegistry;
  private promptBuilder: PromptBuilder;
  private toolsEnabled: boolean;
  private skillsBase: string;
  private readFile: (filePath: string) => string;

  constructor(options: AgentOptions) {
    this.client = options.client;
    this.model = options.model;
    this.registry = options.skillRegistry;
    this.promptBuilder = options.promptBuilder ?? new PromptBuilder(options.skillRegistry);
    this.toolsEnabled = options.toolsEnabled ?? true;
    this.skillsBase = path.resolve(options.skillRegistry.skillsDir);
    this.readFile =
      options.readFileHandler ??
      ((p) => defaultReadFile(p, this.skillsBase));
  }

  /** 返回要传给 LLM 的 tool 定义列表（OpenAI Function Calling 格式） */
  private getTools(): ReturnType<typeof getDefaultTools> {
    return this.toolsEnabled ? getDefaultTools() : [];
  }

  /** 同步执行单个 tool（read_file / list_skills / load_skill），返回给 LLM 的字符串 */
  private executeTool(name: string, args: Record<string, unknown>): string {
    if (name === "read_file") {
      return this.readFile(String(args.path ?? ""));
    }
    if (name === "list_skills") {
      const skills = this.registry.listSkills();
      const lines = skills.map((s) => {
        const props = this.registry.getSkillProperties(s);
        return props ? `- ${s}: ${props.description.slice(0, 80)}...` : `- ${s}`;
      });
      return lines.length ? lines.join("\n") : "No skills loaded.";
    }
    if (name === "load_skill") {
      const skillName = String(args.skill_name ?? "").trim();
      if (!skillName)
        return "Error: skill_name is required.";
      const skillDir = this.registry.getSkillDir(skillName);
      if (!skillDir)
        return `Error: skill not found: ${skillName}. Use list_skills to see available skills.`;
      const skillMd = path.join(skillDir, "SKILL.md");
      const skillMdLower = path.join(skillDir, "skill.md");
      const filePath = fs.existsSync(skillMd) ? skillMd : skillMdLower;
      if (!fs.existsSync(filePath))
        return `Error: SKILL.md not found in ${skillDir}.`;
      const content = fs.readFileSync(filePath, "utf-8");
      return (
        `[Skill: ${skillName}]\n` +
        `Skill directory: ${skillDir}\n` +
        "Use read_file with paths under this directory to load examples (e.g. examples/3p-updates.md).\n\n" +
        "--- SKILL.md content ---\n" +
        content
      );
    }
    return `Unknown tool: ${name}`;
  }

  /** 异步执行 tool；run_skill_script 需调 runSkillScript，其余走 executeTool */
  private async executeToolAsync(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === "run_skill_script") {
      const skillName = String(args.skill_name ?? "").trim();
      const scriptName = String(args.script_name ?? "").trim();
      if (!skillName || !scriptName) return "Error: skill_name and script_name are required.";
      const skillDir = this.registry.getSkillDir(skillName);
      if (!skillDir) return `Error: skill not found: ${skillName}. Use list_skills to see available skills.`;
      const scriptsDir = path.join(skillDir, "scripts");
      const rawArgs = Array.isArray(args.args) ? args.args.slice(0, 32).map(String) : [];
      const r = await runSkillScript(scriptsDir, scriptName, rawArgs);
      if (r.error) return `Error: ${r.error}`;
      if (r.code !== 0) return `Exit code ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`;
      return r.stdout || "(no output)";
    }
    return Promise.resolve(this.executeTool(name, args));
  }

  /**
   * 单轮对话：发一条用户消息，若有 tool 调用则循环执行直到模型不再返回 tool_calls，最后返回助手文本
   */
  async chat(
    userMessage: string,
    options: {
      systemOverride?: string | null;
      skillNames?: string[] | null;
      temperature?: number;
    } = {}
  ): Promise<string> {
    const { systemOverride = null, skillNames = null, temperature = 0.7 } = options;
    const system =
      systemOverride ??
      this.promptBuilder.buildSystemPrompt(skillNames);
    const tools = this.getTools();

    type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
    const messages: Message[] = [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ];

    let response = await chatCompletion(this.client, messages, {
      model: this.model,
      temperature,
      tools: tools.length ? tools : undefined,
    });

    let choice = response.choices[0];
    if (!choice) return "";

    let msg = choice.message;

    // 若模型返回了 tool_calls，把 assistant 消息和每个 tool 结果追加进 messages，再请求一次，直到没有 tool_calls
    while (msg.tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
      });

      for (const tc of msg.tool_calls) {
        const name = tc.function?.name ?? "";
        const raw = tc.function?.arguments ?? "{}";
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          // ignore
        }
        const result = await this.executeToolAsync(name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id!,
          content: result,
        });
      }

      response = await chatCompletion(this.client, messages, {
        model: this.model,
        temperature,
        tools,
      });
      choice = response.choices[0];
      msg = choice?.message ?? null;
      if (!msg) break;
    }

    return (msg && typeof msg.content === "string" ? msg.content : "") ?? "";
  }

  listSkills(): string[] {
    return this.registry.listSkills();
  }
}

/** 默认读文件：仅允许 base 及其子路径，否则返回错误字符串 */
function defaultReadFile(filePath: string, base: string): string {
  const p = path.resolve(filePath);
  const baseResolved = path.resolve(base);
  if (p !== baseResolved && !p.startsWith(baseResolved + path.sep)) {
    return `Error: path must be under ${base}`;
  }
  try {
    if (!fs.existsSync(p)) return `Error: file not found: ${filePath}`;
    if (!fs.statSync(p).isFile()) return `Error: not a file: ${filePath}`;
    return fs.readFileSync(p, "utf-8");
  } catch (e) {
    return `Error: ${String(e)}`;
  }
}
