"""
Codex OAuth text provider — uses the ChatGPT Responses API.

Endpoint: POST https://chatgpt.com/backend-api/codex/responses
Auth:     Bearer <oauth_access_token>

This provider converts prompts into the Responses API format (not Chat
Completions) and supports both streaming and non-streaming generation.
"""
import json
import logging
from typing import Generator

import requests as http_requests

from .base import TextProvider, strip_think_tags

logger = logging.getLogger(__name__)

_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
_RESPONSES_ENDPOINT = f"{_CODEX_BASE_URL}/responses"

# Default timeout for HTTP requests (seconds)
_DEFAULT_TIMEOUT = 120


class CodexTextProvider(TextProvider):
    """Text generation via the ChatGPT Codex Responses API (OAuth)."""

    def __init__(self, api_key: str, model: str = "gpt-4.1-mini"):
        """
        Args:
            api_key: OAuth access token obtained via PKCE flow.
            model:   Model name (e.g. gpt-4.1, gpt-4.1-mini, o4-mini).
        """
        self.api_key = api_key
        self.model = model

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, prompt: str) -> dict:
        """Build a Responses API request body. Stream is always true (required by Codex)."""
        return {
            "model": self.model,
            "instructions": "You are a helpful assistant.",
            "input": [{"role": "user", "content": prompt}],
            "store": False,
            "stream": True,
        }

    # ------------------------------------------------------------------
    # Non-streaming
    # ------------------------------------------------------------------

    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """Generate text via the Responses API (always streaming, collected into full result)."""
        payload = self._build_payload(prompt)
        logger.debug("Codex text request: model=%s", self.model)

        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=_DEFAULT_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()

        collected = []
        for chunk in self._iter_sse_text(resp):
            collected.append(chunk)
        return strip_think_tags("".join(collected))

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text via the Responses API (SSE)."""
        payload = self._build_payload(prompt)
        logger.debug("Codex text request (stream): model=%s", self.model)

        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=_DEFAULT_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()

        yield from self._iter_sse_text(resp)

    # ------------------------------------------------------------------
    # SSE parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _iter_sse_text(resp) -> Generator[str, None, None]:
        """Parse SSE stream and yield text deltas."""
        for raw_line in resp.iter_lines():
            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
            if not line or not line.startswith("data: "):
                continue
            raw = line[len("data: "):]
            if raw.strip() == "[DONE]":
                break
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if event.get("type") == "response.output_text.delta":
                delta = event.get("delta", "")
                if delta:
                    yield delta
