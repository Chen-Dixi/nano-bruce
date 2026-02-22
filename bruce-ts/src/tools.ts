/**
 * Agent 工具定义（OpenAI Function Calling 格式）
 *
 * 供 legacy Agent（非 Pi）使用；Pi 版工具在 pi-tools.ts 里以 AgentTool 形式定义。
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions.js";

/** 返回默认四个工具：read_file, list_skills, load_skill, run_skill_script */
export function getDefaultTools(): ChatCompletionTool[] {
  return [
    readFileTool(),
    listSkillsTool(),
    loadSkillTool(),
    runSkillScriptTool(),
  ];
}

function readFileTool(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file. Use this to load full skill instructions " +
        "from SKILL.md when you decide to use a skill, or to read example files " +
        "from skill directories (e.g. examples/*.md).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to the file to read." },
        },
        required: ["path"],
      },
    },
  };
}

function listSkillsTool(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "list_skills",
      description:
        "List all available skill names and their descriptions. " +
        "Use when you need to recall what skills are available.",
      parameters: { type: "object", properties: {} },
    },
  };
}

function loadSkillTool(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "load_skill",
      description:
        "Load and execute a skill by name. Call this after you have decided which skill to use. " +
        "Returns the full SKILL.md content. Use the returned skill_dir path with read_file for examples.",
      parameters: {
        type: "object",
        properties: {
          skill_name: {
            type: "string",
            description: "Skill name in kebab-case (e.g. internal-comms, doc-coauthoring).",
          },
        },
        required: ["skill_name"],
      },
    },
  };
}

function runSkillScriptTool(): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: "run_skill_script",
      description:
        "Run an executable script from a skill's scripts/ directory. " +
        "Supported: .py (Python), .sh (Bash), .js (Node). Scripts run with a timeout.",
      parameters: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "Skill name in kebab-case (e.g. skill-creator)." },
          script_name: {
            type: "string",
            description: "Script filename under scripts/ (e.g. init_skill.py, package_skill.py).",
          },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Optional list of arguments to pass to the script.",
          },
        },
        required: ["skill_name", "script_name"],
      },
    },
  };
}
