"""Bruce - 具备技能调用能力的 Agent 入口。

提供 create_agent 工厂函数和 main 演示入口。
"""

from pathlib import Path

from ai.agent import Agent, PromptBuilder, SkillRegistry
from ai.provider import DeepSeekProvider, MoonshotProvider


def create_agent(
    provider_name: str = "moonshot",
    skills_dir: Path | None = None,
) -> Agent:
    """创建带 skills 的 Agent 实例。

    Args:
        provider_name: "moonshot" | "deepseek"
        skills_dir: skills 目录路径，默认 bruce/skills
    """
    skills_dir = skills_dir or (Path(__file__).parent / "skills")

    registry = SkillRegistry(skills_dir)
    registry.load()

    if provider_name == "moonshot":
        provider = MoonshotProvider()
    elif provider_name == "deepseek":
        provider = DeepSeekProvider()
    else:
        raise ValueError(f"Unknown provider: {provider_name}")

    builder = PromptBuilder(registry)
    return Agent(
        provider=provider,
        skill_registry=registry,
        prompt_builder=builder,
        tools_enabled=True,
    )


def main():
    """Run agent with skills."""
    agent = create_agent(provider_name="deepseek")

    print("Loaded skills:", agent._registry.list_skills())
    print()

    # Demo: single turn
    response = agent.chat(
        "我想写一份内部通讯的周报，应该用哪个 skill？请简要说明。"
    )
    print(response)


if __name__ == "__main__":
    main()
