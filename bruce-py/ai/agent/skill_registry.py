"""Skill registry - discovers and manages skills from directory (Registry pattern).

Registry 模式：从 skills 目录发现、校验、缓存 skill 元数据，
为 PromptBuilder 和 Agent 提供 <available_skills> XML 及 skill 详情。
依赖 skills_ref 库完成 SKILL.md 解析与校验。
"""

from pathlib import Path
from typing import Optional

from skills_ref import read_properties, to_prompt, validate
from skills_ref.models import SkillProperties


class SkillRegistry:
    """Skill 注册表：从目录发现并管理 Agent Skills。

    职责：
    - 扫描 skills_dir 下含 SKILL.md 的子目录
    - 可选校验（validate）确保符合 Anthropic Skills 规范
    - 缓存 name -> (path, SkillProperties)，供 prompt 和 tools 使用
    """

    def __init__(self, skills_dir: Path | str, validate_on_load: bool = True):
        """Initialize registry.

        Args:
            skills_dir: Path to directory containing skill subdirectories.
            validate_on_load: Whether to validate skills when loading.
        """
        self._skills_dir = Path(skills_dir).resolve()
        self._validate_on_load = validate_on_load
        self._skills: dict[str, tuple[Path, SkillProperties]] = {}

    @property
    def skills_dir(self) -> Path:
        """Path to skills directory."""
        return self._skills_dir

    def load(self) -> list[str]:
        """从目录发现并加载所有 skill。

        遍历 skills_dir 下每个子目录，若存在 SKILL.md/skill.md 则解析并缓存。
        校验失败或解析异常的 skill 会被跳过。

        Returns:
            成功加载的 skill 名称列表。
        """
        self._skills.clear()
        if not self._skills_dir.exists() or not self._skills_dir.is_dir():
            return []

        loaded: list[str] = []
        for subdir in sorted(self._skills_dir.iterdir()):
            if not subdir.is_dir():
                continue
            skill_md = subdir / "SKILL.md"
            if not skill_md.exists() and not (subdir / "skill.md").exists():
                continue

            # 可选：按 Anthropic 规范校验，无效 skill 不加载
            if self._validate_on_load:
                errors = validate(subdir)
                if errors:
                    continue  # Skip invalid skills

            try:
                props = read_properties(subdir)
                self._skills[props.name] = (subdir, props)
                loaded.append(props.name)
            except Exception:
                continue

        return loaded

    def get_available_skills_xml(self, skill_names: Optional[list[str]] = None) -> str:
        """Generate <available_skills> XML block for agent prompts.

        Args:
            skill_names: Optional list to filter skills. If None, uses all loaded.

        Returns:
            XML string per Anthropic skills protocol.
        """
        if not self._skills:
            self.load()

        if skill_names is not None:
            paths = [
                self._skills[name][0]
                for name in skill_names
                if name in self._skills
            ]
        else:
            paths = [path for path, _ in self._skills.values()]

        return to_prompt(paths)

    def get_skill_properties(self, name: str) -> Optional[SkillProperties]:
        """Get properties for a skill by name."""
        if name in self._skills:
            return self._skills[name][1]
        return None

    def get_skill_dir(self, name: str) -> Optional[Path]:
        """Get directory path for a skill by name."""
        if name in self._skills:
            return self._skills[name][0]
        return None

    def list_skills(self) -> list[str]:
        """Return list of loaded skill names."""
        if not self._skills:
            self.load()
        return list(self._skills.keys())
