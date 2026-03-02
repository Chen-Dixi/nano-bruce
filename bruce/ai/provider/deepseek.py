"""DeepSeek LLM provider.

使用 OpenAI 兼容客户端调用 DeepSeek API，需配置 DEEPSEEK_API_KEY。
"""

import os
from typing import Any

from openai import OpenAI

from .base import BaseLLMProvider


class DeepSeekProvider(BaseLLMProvider):
    """DeepSeek API 提供方。"""

    BASE_URL = "https://api.deepseek.com"
    DEFAULT_MODEL = "deepseek-chat"

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ):
        self._client = OpenAI(
            api_key=api_key or os.getenv("DEEPSEEK_API_KEY"),
            base_url=base_url or self.BASE_URL,
        )
        self._model = model or self.DEFAULT_MODEL

    def chat_completion(
        self,
        messages: list[dict[str, Any]],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        stream: bool = False,
        tools: list[dict[str, Any]] | None = None,
    ) -> Any:
        kwargs: dict[str, Any] = {
            "model": model or self._model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream,
        }
        if tools is not None:
            kwargs["tools"] = tools
        return self._client.chat.completions.create(**kwargs)
