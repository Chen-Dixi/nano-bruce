"""Agent orchestrator - coordinates LLM and skills (Facade/Orchestrator).

Facade 模式：Agent 作为统一入口，协调 LLM provider、SkillRegistry、PromptBuilder、
以及 tool 执行，封装完整对话流程（含 tool call 循环）。
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

from ..provider.base import BaseLLMProvider
from .prompt_builder import PromptBuilder
from .skill_registry import SkillRegistry
from .tools import get_default_tools

# 仅允许执行 scripts/ 下这些扩展名的脚本，避免任意命令执行
ALLOWED_SCRIPT_EXTENSIONS = (".py", ".sh", ".bash", ".js", ".mjs")
SCRIPT_TIMEOUT_SECONDS = 60
MAX_SCRIPT_ARGS = 32


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

    def _run_skill_script(
        self,
        skill_name: str,
        script_name: str,
        args: list[str] | None = None,
    ) -> str:
        """安全执行 skill 的 scripts/ 目录下脚本：路径与扩展名白名单、超时、无 shell。"""
        skill_dir = self._registry.get_skill_dir(skill_name)
        if skill_dir is None:
            return f"Error: skill not found: {skill_name}. Use list_skills to see available skills."
        scripts_dir = skill_dir / "scripts"
        if not scripts_dir.is_dir():
            return f"Error: skill has no scripts/ directory: {skill_name}"

        # 解析路径，禁止跳出 scripts/
        try:
            script_path = (scripts_dir / script_name.strip()).resolve()
            scripts_dir_resolved = scripts_dir.resolve()
            script_path.relative_to(scripts_dir_resolved)
        except (ValueError, OSError):
            return "Error: script path must be under the skill's scripts/ directory."

        if not script_path.is_file():
            return f"Error: script not found: {script_path.name}"

        if script_path.suffix not in ALLOWED_SCRIPT_EXTENSIONS:
            return (
                f"Error: script extension not allowed. Allowed: {', '.join(ALLOWED_SCRIPT_EXTENSIONS)}"
            )

        cmd_args = args if isinstance(args, list) else []
        if len(cmd_args) > MAX_SCRIPT_ARGS:
            return f"Error: too many arguments (max {MAX_SCRIPT_ARGS})"

        if script_path.suffix == ".py":
            command = [sys.executable, str(script_path)] + cmd_args
        elif script_path.suffix in (".sh", ".bash"):
            command = ["bash", str(script_path)] + cmd_args
        elif script_path.suffix in (".js", ".mjs"):
            command = ["node", str(script_path)] + cmd_args
        else:
            return f"Error: unsupported extension {script_path.suffix}"

        try:
            result = subprocess.run(
                command,
                cwd=str(scripts_dir),
                timeout=SCRIPT_TIMEOUT_SECONDS,
                capture_output=True,
                text=True,
                env={**os.environ},
            )
            out = (result.stdout or "").strip()
            err = (result.stderr or "").strip()
            if result.returncode != 0:
                return f"Exit code {result.returncode}\nstdout:\n{out}\nstderr:\n{err}"
            return out if out else "(no output)"
        except subprocess.TimeoutExpired:
            return f"Error: script timed out after {SCRIPT_TIMEOUT_SECONDS}s"
        except FileNotFoundError as e:
            return f"Error: interpreter not found: {e}"
        except Exception as e:
            return f"Error running script: {e}"

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
        if name == "load_skill":
            # 选择 Skill 后在系统中执行：按名称加载 SKILL.md 完整内容，供模型按说明执行
            skill_name = (arguments.get("skill_name") or "").strip()
            if not skill_name:
                return "Error: skill_name is required."
            skill_dir = self._registry.get_skill_dir(skill_name)
            if skill_dir is None:
                return f"Error: skill not found: {skill_name}. Use list_skills to see available skills."
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                skill_md = skill_dir / "skill.md"
            if not skill_md.exists():
                return f"Error: SKILL.md not found in {skill_dir}."
            content = skill_md.read_text(encoding="utf-8", errors="replace")
            skill_dir_str = str(skill_dir)
            return (
                f"[Skill: {skill_name}]\n"
                f"Skill directory: {skill_dir_str}\n"
                "Use read_file with paths under this directory to load examples (e.g. examples/3p-updates.md).\n\n"
                "--- SKILL.md content ---\n"
                f"{content}"
            )
        if name == "run_skill_script":
            skill_name = (arguments.get("skill_name") or "").strip()
            script_name = (arguments.get("script_name") or "").strip()
            if not skill_name or not script_name:
                return "Error: skill_name and script_name are required."
            args = arguments.get("args")
            if isinstance(args, list):
                args = [str(a) for a in args[:MAX_SCRIPT_ARGS]]
            else:
                args = []
            return self._run_skill_script(skill_name, script_name, args)
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
