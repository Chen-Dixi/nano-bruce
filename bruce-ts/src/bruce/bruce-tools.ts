/**
 * 将 Bruce 的 read_file / list_skills / load_skill / run_skill_script 转为 agent 层的 AgentTool[]
 */

import fs from "node:fs";
import path from "node:path";
import type { AgentTool } from "../agent/types.js";
import type { SkillRegistry } from "./skill-registry.js";
import { runSkillScript } from "./run-script.js";

export interface BruceToolsOptions {
  registry: SkillRegistry;
  /** 读文件时的根路径（仅允许该路径下），默认 registry.skillsDir */
  basePath?: string;
  /** 自定义 read_file 实现，默认在 basePath 下读文件 */
  readFile?: (filePath: string) => string;
}

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
 * 返回 Bruce 默认四个工具（AgentTool 形态），供 agent 引擎执行
 */
export function getBruceAgentTools(options: BruceToolsOptions): AgentTool[] {
  const { registry } = options;
  const basePath = options.basePath ?? registry.skillsDir;
  const readFile = options.readFile ?? ((p: string) => defaultReadFile(p, basePath));

  return [
    {
      name: "read_file",
      description:
        "Read the contents of a file. Use this to load full skill instructions from SKILL.md or example files from skill directories.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute path to the file to read." } },
        required: ["path"],
      },
      async execute(_, args) {
        const content = readFile(String(args.path ?? ""));
        return { content };
      },
    },
    {
      name: "list_skills",
      description: "List all available skill names and their descriptions.",
      parameters: { type: "object", properties: {} },
      async execute() {
        const skills = registry.listSkills();
        const lines = skills.map((s) => {
          const props = registry.getSkillProperties(s);
          return props ? `- ${s}: ${props.description.slice(0, 80)}...` : `- ${s}`;
        });
        return { content: lines.length ? lines.join("\n") : "No skills loaded." };
      },
    },
    {
      name: "load_skill",
      description:
        "Load a skill by name. Returns the full SKILL.md content. Use read_file with the skill directory for examples.",
      parameters: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "Skill name in kebab-case." },
        },
        required: ["skill_name"],
      },
      async execute(_, args) {
        const skillName = String(args.skill_name ?? "").trim();
        if (!skillName) return { content: "Error: skill_name is required.", isError: true };
        const skillDir = registry.getSkillDir(skillName);
        if (!skillDir)
          return { content: `Error: skill not found: ${skillName}. Use list_skills to see available skills.`, isError: true };
        const skillMd = path.join(skillDir, "SKILL.md");
        const skillMdLower = path.join(skillDir, "skill.md");
        const filePath = fs.existsSync(skillMd) ? skillMd : skillMdLower;
        if (!fs.existsSync(filePath))
          return { content: `Error: SKILL.md not found in ${skillDir}.`, isError: true };
        const content = fs.readFileSync(filePath, "utf-8");
        return {
          content:
            `[Skill: ${skillName}]\nSkill directory: ${skillDir}\nUse read_file with paths under this directory to load examples.\n\n--- SKILL.md content ---\n` +
            content,
        };
      },
    },
    {
      name: "run_skill_script",
      description: "Run an executable script from a skill's scripts/ directory. Supported: .py, .sh, .js. Scripts run with a timeout.",
      parameters: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "Skill name in kebab-case." },
          script_name: { type: "string", description: "Script filename under scripts/." },
          args: { type: "array", items: { type: "string" }, description: "Optional arguments." },
        },
        required: ["skill_name", "script_name"],
      },
      async execute(_, args) {
        const skillName = String(args.skill_name ?? "").trim();
        const scriptName = String(args.script_name ?? "").trim();
        if (!skillName || !scriptName)
          return { content: "Error: skill_name and script_name are required.", isError: true };
        const skillDir = registry.getSkillDir(skillName);
        if (!skillDir)
          return { content: `Error: skill not found: ${skillName}.`, isError: true };
        const scriptsDir = path.join(skillDir, "scripts");
        const rawArgs = Array.isArray(args.args) ? args.args.slice(0, 32).map(String) : [];
        const r = await runSkillScript(scriptsDir, scriptName, rawArgs);
        if (r.error) return { content: `Error: ${r.error}`, isError: true };
        if (r.code !== 0)
          return {
            content: `Exit code ${r.code}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
            isError: true,
          };
        return { content: r.stdout || "(no output)" };
      },
    },
  ];
}
