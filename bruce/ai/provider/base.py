"""Abstract base for LLM providers (Strategy pattern).

Strategy 模式：将 LLM 调用抽象为统一接口，便于切换不同 API（Moonshot、DeepSeek 等）。
所有 provider 均兼容 OpenAI API 格式，便于复用 openai 客户端。
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseLLMProvider(ABC):
    """LLM 提供方抽象基类。

    定义 chat_completion 接口，各具体 provider（Moonshot、DeepSeek）
    实现该接口后即可被 Agent 统一调用。
    """

    @abstractmethod
    def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        stream: bool = False,
        tools: list[dict[str, Any]] | None = None,
    ) -> Any:
        """Create a chat completion.

        Args:
            messages: List of message dicts with 'role' and 'content'.
            model: Model name override (uses provider default if None).
            temperature: Sampling temperature.
            stream: Whether to stream the response.
            tools: Optional list of tool definitions for function calling.

        Returns:
            Completion response (object with choices, etc.).
        """
        pass
