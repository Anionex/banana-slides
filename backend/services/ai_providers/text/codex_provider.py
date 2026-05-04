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
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from .base import TextProvider, strip_think_tags

logger = logging.getLogger(__name__)

_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
_RESPONSES_ENDPOINT = f"{_CODEX_BASE_URL}/responses"

# Default timeout for HTTP requests (seconds)
_DEFAULT_TIMEOUT = 120


def _is_retryable_http_error(exc: BaseException) -> bool:
    """Return True for transient HTTP errors worth retrying (429, 5xx)."""
    if isinstance(exc, http_requests.exceptions.HTTPError) and exc.response is not None:
        return exc.response.status_code in (429, 500, 502, 503, 504)
    return False


def _log_codex_retry(retry_state):
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    status = getattr(getattr(exc, 'response', None), 'status_code', '?')
    logger.warning(
        "Codex request failed (HTTP %s), retrying %d/%d: %s",
        status, retry_state.attempt_number, 5, exc,
    )


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

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        retry=retry_if_exception(_is_retryable_http_error),
        reraise=True,
        before_sleep=_log_codex_retry,
    )
    def _post_with_retry(self, payload: dict) -> http_requests.Response:
        """POST to the Codex endpoint with exponential-backoff retry on 429/5xx."""
        logger.debug("Codex request: model=%s", self.model)
        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=_DEFAULT_TIMEOUT,
            stream=True,
        )
        resp.raise_for_status()
        return resp

    # ------------------------------------------------------------------
    # Non-streaming
    # ------------------------------------------------------------------

    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        """Generate text via the Responses API (always streaming, collected into full result)."""
        resp = self._post_with_retry(self._build_payload(prompt))
        collected = []
        for chunk in self._iter_sse_text(resp):
            collected.append(chunk)
        return strip_think_tags("".join(collected))

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    def generate_text_stream(self, prompt: str, thinking_budget: int = 0) -> Generator[str, None, None]:
        """Stream text via the Responses API (SSE)."""
        resp = self._post_with_retry(self._build_payload(prompt))
        yield from self._iter_sse_text(resp)

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        """Generate text from a prompt + image (multimodal) via Responses API."""
        import base64
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        ext = image_path.rsplit(".", 1)[-1].lower()
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif"}.get(ext, "image/png")

        payload = {
            "model": self.model,
            "instructions": "You are a helpful assistant.",
            "input": [
                {
                    "role": "user",
                    "content": [
                        {"type": "input_image", "image_url": f"data:{mime};base64,{b64}"},
                        {"type": "input_text", "text": prompt},
                    ],
                }
            ],
            "store": False,
            "stream": True,
        }

        resp = self._post_with_retry(payload)
        collected = []
        for chunk in self._iter_sse_text(resp):
            collected.append(chunk)
        return strip_think_tags("".join(collected))

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
