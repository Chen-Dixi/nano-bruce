"""Build system prompts with skills block (Builder pattern).

Builder 模式：组装系统提示，包含基础说明 + <available_skills> XML 块。
格式遵循 Anthropic Agent Skills 协议，便于大模型识别可用 skill 及 location。
"""

from .skill_registry import SkillRegistry


class PromptBuilder:
    """系统提示构建器：生成含 available_skills 的完整 system prompt。

    输出结构：基础说明 + <available_skills><skill>...</skill></available_skills>
    每个 skill 包含 name、description、location（SKILL.md 路径）。
    """

    DEFAULT_SYSTEM = (
        "You are a helpful AI assistant with access to skills. "
        "When a task matches a skill's description, use that skill by reading its "
        "full instructions from the location provided. Follow the skill's "
        "guidelines to complete the task."
    )

    def __init__(
        self,
        skill_registry: SkillRegistry,
        system_base: str | None = None,
    ):
        """Initialize prompt builder.

        Args:
            skill_registry: Registry to get available skills XML.
            system_base: Base system message. Uses default if None.
        """
        self._registry = skill_registry
        self._system_base = system_base or self.DEFAULT_SYSTEM

    def build_system_prompt(
        self,
        skill_names: list[str] | None = None,
        extra_blocks: list[str] | None = None,
    ) -> str:
        """Build system prompt with <available_skills> block.

        Args:
            skill_names: Optional filter for which skills to include.
            extra_blocks: Optional additional XML/text blocks to append.

        Returns:
            Full system prompt string.
        """
        parts = [self._system_base]

        skills_xml = self._registry.get_available_skills_xml(skill_names)
        if skills_xml.strip() != "<available_skills>\n</available_skills>":
            parts.append("")
            parts.append(skills_xml)

        if extra_blocks:
            parts.append("")
            parts.extend(extra_blocks)

        return "\n".join(parts)
