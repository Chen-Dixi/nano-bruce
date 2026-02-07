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


def get_default_tools(skills_base: Path | None = None) -> list[dict[str, Any]]:
    """返回技能型 agent 的默认 tool 列表：read_file + list_skills。"""
    return [
        read_file_tool(skills_base),
        list_skills_tool(),
    ]
