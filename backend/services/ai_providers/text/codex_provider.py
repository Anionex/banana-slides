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

    def _build_payload(self, prompt: str, *, stream: bool = False) -> dict:
        """Build a Responses API request body."""
        return {
            "model": self.model,
            "input": [{"role": "user", "content": prompt}],
            "stream": stream,
        }

    # ------------------------------------------------------------------
    # Non-streaming
    # ------------------------------------------------------------------

    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """Generate text (non-streaming) via the Responses API."""
        payload = self._build_payload(prompt, stream=False)
        logger.debug("Codex text request (non-stream): model=%s", self.model)

        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=_DEFAULT_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        return strip_think_tags(self._extract_text(data))

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text via the Responses API (SSE)."""
        payload = self._build_payload(prompt, stream=True)
        logger.debug("Codex text request (stream): model=%s", self.model)

        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=_DEFAULT_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()

        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.startswith("data: "):
                continue
            raw = line[len("data: "):]
            if raw.strip() == "[DONE]":
                break
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # Responses API emits several event types.  We care about:
            #   response.output_text.delta  — incremental text chunk
            #   response.completed          — final full response (fallback)
            event_type = event.get("type", "")

            if event_type == "response.output_text.delta":
                delta = event.get("delta", "")
                if delta:
                    yield delta

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_text(data: dict) -> str:
        """Extract the final text from a non-streaming Responses API result.

        The response structure looks like:
        {
          "output": [
            {"type": "message", "content": [{"type": "output_text", "text": "..."}]}
          ]
        }
        """
        for item in data.get("output", []):
            if item.get("type") == "message":
                for part in item.get("content", []):
                    if part.get("type") == "output_text":
                        return part.get("text", "")
        # Fallback: some responses put text directly
        if "output_text" in data:
            return data["output_text"]
        logger.warning("Could not extract text from Codex response: %s", str(data)[:500])
        return ""
