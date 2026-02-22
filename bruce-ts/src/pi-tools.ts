/**
 * 将 Bruce 的四个技能能力封装成 Pi 的 AgentTool 数组
 *
 * Pi 的 AgentTool 要求：name + description + parameters（TypeBox  schema）+ label + execute(toolCallId, params) 返回 { content, details }。
 * 这里用 Type 从 pi-ai 来定义参数结构，execute 内将结果包成 Pi 需要的 TextContent 数组。
 */

import path from "node:path";
import fs from "node:fs";
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { SkillRegistry } from "./skill-registry.js";
import { runSkillScript as runScript } from "./run-script.js";

const skillsBaseDoc = "Absolute path to the file to read (must be under the skill's directory).";

/** 把一段字符串包装成 Pi AgentTool 要求的返回格式：content 为一段 text，details 不用 */
function textResult(text: string): { content: [{ type: "text"; text: string }]; details: undefined } {
  return { content: [{ type: "text", text }], details: undefined };
}

/**
 * 创建 Bruce 的四个 AgentTool，供 Pi Agent 使用
 *
 * @param registry - 技能注册表，用于 list_skills / get_skill_dir / get_skill_properties
 * @param readFileImpl - 读文件实现，通常限制在 skills 目录下（沙箱）
 * @returns 四个 AgentTool：read_file, list_skills, load_skill, run_skill_script
 */
export function createBruceTools(
  registry: SkillRegistry,
  readFileImpl: (filePath: string) => string
): AgentTool[] {
  const skillsBase = path.resolve(registry.skillsDir);

  const readFile: AgentTool = {
    name: "read_file",
    description:
      "Read the contents of a file. Use to load SKILL.md or example files (e.g. examples/*.md) from a skill directory.",
    parameters: Type.Object({
      path: Type.String({ description: skillsBaseDoc }),
    }),
    label: "Read file",
    execute: async (_toolCallId, params) => {
      const p = params as { path: string };
      const result = readFileImpl(p.path);
      return textResult(result);
    },
  };

  /** 列出当前已加载的 skill 名称与描述（前 80 字） */
  const listSkills: AgentTool = {
    name: "list_skills",
    description: "List all available skill names and their descriptions.",
    parameters: Type.Object({}),
    label: "List skills",
    execute: async () => {
      const skills = registry.listSkills();
      const lines = skills.map((s) => {
        const props = registry.getSkillProperties(s);
        return props ? `- ${s}: ${props.description.slice(0, 80)}...` : `- ${s}`;
      });
      return textResult(lines.length ? lines.join("\n") : "No skills loaded.");
    },
  };

  /** 按名称加载 skill：读 SKILL.md 全文并返回，附带 skill 目录路径说明 */
  const loadSkill: AgentTool = {
    name: "load_skill",
    description:
      "Load a skill by name. Returns full SKILL.md content. Use read_file with the returned skill_dir for examples.",
    parameters: Type.Object({
      skill_name: Type.String({ description: "Skill name in kebab-case (e.g. internal-comms, doc-coauthoring)." }),
    }),
    label: "Load skill",
    execute: async (_, params) => {
      const p = params as { skill_name: string };
      const skillName = p.skill_name.trim();
      if (!skillName) return textResult("Error: skill_name is required.");
      const skillDir = registry.getSkillDir(skillName);
      if (!skillDir)
        return textResult(`Error: skill not found: ${skillName}. Use list_skills to see available skills.`);
      const skillMd = path.join(skillDir, "SKILL.md");
      const skillMdLower = path.join(skillDir, "skill.md");
      const filePath = fs.existsSync(skillMd) ? skillMd : skillMdLower;
      if (!fs.existsSync(filePath)) return textResult(`Error: SKILL.md not found in ${skillDir}.`);
      const content = fs.readFileSync(filePath, "utf-8");
      const out =
        `[Skill: ${skillName}]\n` +
        `Skill directory: ${skillDir}\n` +
        "Use read_file with paths under this directory to load examples (e.g. examples/3p-updates.md).\n\n" +
        "--- SKILL.md content ---\n" +
        content;
      return textResult(out);
    },
  };

  /** 在 skill 的 scripts/ 目录下安全执行脚本（.py / .sh / .js），带超时与参数上限 */
  const runSkillScriptTool: AgentTool = {
    name: "run_skill_script",
    description:
      "Run an executable script from a skill's scripts/ directory. Supported: .py, .sh, .js. Scripts run with a timeout.",
    parameters: Type.Object({
      skill_name: Type.String({ description: "Skill name in kebab-case (e.g. skill-creator)." }),
      script_name: Type.String({
        description: "Script filename under scripts/ (e.g. init_skill.py, package_skill.py).",
      }),
      args: Type.Optional(Type.Array(Type.String(), { description: "Optional arguments to pass to the script." })),
    }),
    label: "Run skill script",
    execute: async (_, params) => {
      const p = params as { skill_name: string; script_name: string; args?: string[] };
      const skillName = p.skill_name.trim();
      const scriptName = p.script_name.trim();
      if (!skillName || !scriptName) return textResult("Error: skill_name and script_name are required.");
      const skillDir = registry.getSkillDir(skillName);
      if (!skillDir)
        return textResult(`Error: skill not found: ${skillName}. Use list_skills to see available skills.`);
      const scriptsDir = path.join(skillDir, "scripts");
      const rawArgs = Array.isArray(p.args) ? p.args.slice(0, 32).map(String) : [];
      const r = await runScript(scriptsDir, scriptName, rawArgs);
      if (r.error) return textResult(`Error: ${r.error}`);
      if (r.code !== 0)
        return textResult(`Exit code ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
      return textResult(r.stdout || "(no output)");
    },
  };

  return [readFile, listSkills, loadSkill, runSkillScriptTool];
}

/**
 * 默认读文件实现：仅允许读取 base 及其子路径下的文件，避免越权
 */
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

/**
 * 使用默认沙箱 read_file（仅允许 skills 目录下）创建 Bruce 工具数组，常用于 createBrucePiAgent
 */
export function createBruceToolsWithDefaultReadFile(registry: SkillRegistry): AgentTool[] {
  const base = path.resolve(registry.skillsDir);
  return createBruceTools(registry, (p) => defaultReadFile(p, base));
}
