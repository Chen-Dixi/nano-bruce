"""Agent orchestrator - coordinates LLM and skills (Facade/Orchestrator).

Facade 模式：Agent 作为统一入口，协调 LLM provider、SkillRegistry、PromptBuilder、
以及 tool 执行，封装完整对话流程（含 tool call 循环）。
"""

import json
from pathlib import Path
from typing import Any, Callable

from ..provider.base import BaseLLMProvider
from .prompt_builder import PromptBuilder
from .skill_registry import SkillRegistry
from .tools import get_default_tools


def default_read_file(path: str, base: Path | None) -> str:
    """默认 read_file 实现：读取文件，可选限制在 base 路径下（安全沙箱）。"""
    p = Path(path).resolve()
    if base is not None:
        base_resolved = base.resolve()
        base_str = str(base_resolved)
        if str(p) != base_str and not str(p).startswith(base_str + "/"):
            return f"Error: path must be under {base}"
    if not p.exists():
        return f"Error: file not found: {path}"
    if not p.is_file():
        return f"Error: not a file: {path}"
    return p.read_text(encoding="utf-8", errors="replace")


class Agent:
    """Agent that orchestrates LLM calls with skills support.

    Uses Anthropic-style <available_skills> in system prompt and provides
    tools (read_file, list_skills) so the model can use skills.
    """

    def __init__(
        self,
        provider: BaseLLMProvider,
        skill_registry: SkillRegistry,
        prompt_builder: PromptBuilder | None = None,
        tools_enabled: bool = True,
        read_file_handler: Callable[[str], str] | None = None,
    ):
        """Initialize agent.

        Args:
            provider: LLM provider for chat completions.
            skill_registry: Registry for loading skills.
            prompt_builder: Optional. Created from registry if None.
            tools_enabled: Whether to pass tools to the model.
            read_file_handler: Optional custom handler for read_file tool.
        """
        self._provider = provider
        self._registry = skill_registry
        self._prompt_builder = prompt_builder or PromptBuilder(skill_registry)
        self._tools_enabled = tools_enabled
        self._skills_base = skill_registry.skills_dir
        self._read_file = read_file_handler or (
            lambda path: default_read_file(path, self._skills_base)
        )

    def _get_tools(self) -> list[dict[str, Any]]:
        """返回传给 LLM 的 tool 定义（OpenAI Function Calling 格式）。"""
        if not self._tools_enabled:
            return []
        return get_default_tools(self._skills_base)

    def _execute_tool(self, name: str, arguments: dict[str, Any]) -> str:
        """执行 tool 调用，将结果返回给 LLM。"""
        if name == "read_file":
            return self._read_file(arguments.get("path", ""))
        if name == "list_skills":
            skills = self._registry.list_skills()
            lines = []
            for s in skills:
                props = self._registry.get_skill_properties(s)
                if props:
                    lines.append(f"- {s}: {props.description[:80]}...")
                else:
                    lines.append(f"- {s}")
            return "\n".join(lines) if lines else "No skills loaded."
        return f"Unknown tool: {name}"

    def chat(
        self,
        user_message: str,
        *,
        system_override: str | None = None,
        skill_names: list[str] | None = None,
        temperature: float = 0.7,
    ) -> str:
        """Single-turn chat with optional tool use.

        Args:
            user_message: User input.
            system_override: Override system prompt (skips prompt builder).
            skill_names: Filter skills to include. None = all.
            temperature: Sampling temperature.

        Returns:
            Assistant response text.
        """
        system = (
            system_override
            if system_override is not None
            else self._prompt_builder.build_system_prompt(skill_names)
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]
        tools = self._get_tools()
        kwargs: dict[str, Any] = {
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools

        response = self._provider.chat_completion(**kwargs)
        choice = response.choices[0] if response.choices else None
        if not choice:
            return ""

        msg = choice.message
        # Tool call 循环：若模型返回 tool_calls，则执行并再次请求，直到返回纯文本
        while getattr(msg, "tool_calls", None):
            all_tool_calls = msg.tool_calls
            messages.append(
                {"role": "assistant", "content": msg.content or "", "tool_calls": all_tool_calls}
            )
            for tc in all_tool_calls:
                fn = tc.function if hasattr(tc, "function") else tc.get("function", {})
                name = fn.name if hasattr(fn, "name") else fn.get("name", "")
                args_raw = fn.arguments if hasattr(fn, "arguments") else fn.get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
                result = self._execute_tool(name, args)
                tid = tc.id if hasattr(tc, "id") else tc.get("id", "")
                messages.append({"role": "tool", "tool_call_id": tid, "content": result})
            response = self._provider.chat_completion(
                messages=messages, temperature=temperature, tools=tools
            )
            choice = response.choices[0] if response.choices else None
            msg = choice.message if choice else None
            if not msg:
                break

        return msg.content if msg and msg.content else ""

    def chat_with_history(
        self,
        messages: list[dict[str, str]],
        *,
        system_override: str | None = None,
        skill_names: list[str] | None = None,
        temperature: float = 0.7,
    ) -> str:
        """Multi-turn chat with message history."""
        system = (
            system_override
            if system_override is not None
            else self._prompt_builder.build_system_prompt(skill_names)
        )
        full = [{"role": "system", "content": system}] + messages
        tools = self._get_tools()
        kwargs: dict[str, Any] = {
            "messages": full,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
        response = self._provider.chat_completion(**kwargs)
        choice = response.choices[0] if response.choices else None
        return choice.message.content if choice and choice.message else ""
