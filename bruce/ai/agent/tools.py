"""Tool definitions for agent (enables model to use skills).

将技能能力暴露为 OpenAI Function Calling 格式的 tool，
让大模型在需要时主动调用 read_file、list_skills 等。
"""

from pathlib import Path
from typing import Any


def read_file_tool(allowed_base: Path | None = None) -> dict[str, Any]:
    """read_file 工具定义：供模型读取 SKILL.md 或 skill 目录下示例文件。

    allowed_base 在 Agent 侧用于限制可读路径（仅 skills 目录内），
    此处仅用于序列化，实际校验在 Agent._execute_tool 中完成。
    """
    return {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": (
                "Read the contents of a file. Use this to load full skill instructions "
                "from SKILL.md when you decide to use a skill, or to read example files "
                "from skill directories (e.g. examples/*.md)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute path to the file to read.",
                    },
                },
                "required": ["path"],
            },
        },
    }


def list_skills_tool() -> dict[str, Any]:
    """list_skills 工具定义：供模型查询当前已加载的 skill 列表及描述。"""
    return {
        "type": "function",
        "function": {
            "name": "list_skills",
            "description": (
                "List all available skill names and their descriptions. "
                "Use when you need to recall what skills are available."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    }


def load_skill_tool() -> dict[str, Any]:
    """load_skill 工具定义：按名称加载并返回完整 skill 说明，用于「选择后执行」流程。"""
    return {
        "type": "function",
        "function": {
            "name": "load_skill",
            "description": (
                "Load and execute a skill by name. Call this after you have decided which skill to use. "
                "Returns the full SKILL.md content (instructions, workflow, examples). Use the returned "
                "skill_dir path with read_file to load files under that skill (e.g. examples/*.md)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "description": "Skill name in kebab-case (e.g. internal-comms, doc-coauthoring).",
                    },
                },
                "required": ["skill_name"],
            },
        },
    }


def run_skill_script_tool() -> dict[str, Any]:
    """run_skill_script 工具定义：安全执行 skill 内 scripts/ 目录下的可执行脚本。"""
    return {
        "type": "function",
        "function": {
            "name": "run_skill_script",
            "description": (
                "Run an executable script from a skill's scripts/ directory. "
                "Use when the skill instructs you to run a script (e.g. init_skill.py, package_skill.py). "
                "Scripts run in the skill's scripts/ folder with a timeout. "
                "Supported: .py (Python), .sh (Bash), .js (Node)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "description": "Skill name in kebab-case (e.g. skill-creator).",
                    },
                    "script_name": {
                        "type": "string",
                        "description": (
                            "Script filename or relative path under scripts/ "
                            "(e.g. init_skill.py, package_skill.py)."
                        ),
                    },
                    "args": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of arguments to pass to the script (e.g. [\"my-skill\", \"--path\", \"skills/public\"]).",
                    },
                },
                "required": ["skill_name", "script_name"],
            },
        },
    }


def get_default_tools(skills_base: Path | None = None) -> list[dict[str, Any]]:
    """返回技能型 agent 的默认 tool 列表：read_file + list_skills + load_skill + run_skill_script。"""
    return [
        read_file_tool(skills_base),
        list_skills_tool(),
        load_skill_tool(),
        run_skill_script_tool(),
    ]
