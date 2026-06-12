"""
Codex OAuth image provider — uses the ChatGPT Responses API with image_generation tool.

Endpoint: POST https://chatgpt.com/backend-api/codex/responses
Auth:     Bearer <oauth_access_token>

Image generation is done by sending a Responses API request with
tools=[{"type": "image_generation", ...}] and tool_choice={"type": "image_generation"}.
The result contains a base64-encoded image in the output.
"""
import base64
import io
import json
import logging
import os
from io import BytesIO
from typing import Callable, Optional, List

import requests as http_requests
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from .base import ImageProvider
from .openai_provider import _compute_gpt_image_size

logger = logging.getLogger(__name__)

_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
_RESPONSES_ENDPOINT = f"{_CODEX_BASE_URL}/responses"

_CONNECT_TIMEOUT = int(os.getenv("CODEX_IMAGE_CONNECT_TIMEOUT_SECONDS", "30"))
_DEFAULT_TIMEOUT = int(os.getenv("CODEX_IMAGE_TIMEOUT_SECONDS", "600"))
_DEFAULT_RESPONSE_MODEL = os.getenv("CODEX_IMAGE_RESPONSE_MODEL", "gpt-5.4")
_MAX_TEXT_FRAGMENT_CHARS = int(os.getenv("CODEX_IMAGE_MAX_TEXT_FRAGMENT_CHARS", "12000"))
_MAX_NON_IMAGE_EVENT_BYTES = int(os.getenv("CODEX_IMAGE_MAX_NON_IMAGE_EVENT_BYTES", str(1024 * 1024)))
_MAX_EVENT_BYTES = int(os.getenv("CODEX_IMAGE_MAX_EVENT_BYTES", str(64 * 1024 * 1024)))


class CodexImageNoResultError(RuntimeError):
    """Raised when a Codex image stream ends without a final image result."""


class CodexImageRetryableError(RuntimeError):
    """Raised for retryable Codex image failures reported inside the SSE stream."""


def _is_retryable_http_error(exc: BaseException) -> bool:
    """Return True for transient HTTP/network errors worth retrying."""
    if isinstance(exc, http_requests.exceptions.HTTPError) and exc.response is not None:
        return exc.response.status_code in (429, 500, 502, 503, 504)
    if isinstance(exc, CodexImageNoResultError):
        return True
    if isinstance(exc, CodexImageRetryableError):
        return True
    if isinstance(exc, (
        http_requests.exceptions.SSLError,
        http_requests.exceptions.ConnectionError,
        http_requests.exceptions.Timeout,
        http_requests.exceptions.ChunkedEncodingError,
    )):
        return True
    return False


def _log_codex_retry(retry_state):
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    status = getattr(getattr(exc, 'response', None), 'status_code', '?')
    exc_type = type(exc).__name__ if exc else 'UnknownError'
    logger.warning(
        "Codex image request failed (%s, HTTP %s), retrying %d/%d: %s",
        exc_type, status, retry_state.attempt_number, 5, exc,
    )


class CodexImageProvider(ImageProvider):
    """Image generation via the ChatGPT Codex Responses API (OAuth)."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-image-1",
        resolution: str = "2K",
        response_model: str = _DEFAULT_RESPONSE_MODEL,
    ):
        """
        Args:
            api_key: OAuth access token.
            model:   The image model (e.g. gpt-image-1, gpt-image-2).
                     Used inside the image_generation tool definition.
            resolution: Target resolution (1K/2K/4K) for dynamic size calculation.
        """
        self.api_key = api_key
        self.image_model = model
        self.resolution = resolution
        self.response_model = response_model

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, prompt: str, aspect_ratio: str, ref_images: Optional[List[Image.Image]] = None, quality: str = "high", resolution: Optional[str] = None) -> dict:
        """Build a Responses API request with image_generation tool."""
        size = _compute_gpt_image_size(aspect_ratio, resolution or self.resolution)

        content = []
        if ref_images:
            for img in ref_images:
                buffered = io.BytesIO()
                if img.mode in ('RGBA', 'LA', 'P'):
                    bg = Image.new('RGB', img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = bg
                img.save(buffered, format="PNG")
                b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                content.append({"type": "input_image", "image_url": f"data:image/png;base64,{b64}"})
        content.append({"type": "input_text", "text": prompt})

        return {
            "model": self.response_model,
            "instructions": "You are a helpful assistant that generates images.",
            "input": [{"role": "user", "content": content}],
            "tools": [
                {
                    "type": "image_generation",
                    "model": self.image_model,
                    "size": size,
                    "quality": quality,
                }
            ],
            "tool_choice": {"type": "image_generation"},
            "store": False,
            "stream": True,
        }

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=4, max=60),
        retry=retry_if_exception(_is_retryable_http_error),
        reraise=True,
        before_sleep=_log_codex_retry,
    )
    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> Optional[Image.Image]:
        """Generate an image via the Codex Responses API."""
        if cancel_check and cancel_check():
            raise RuntimeError("Image generation cancelled before Codex request")
        payload = self._build_payload(prompt, aspect_ratio, ref_images=ref_images, resolution=resolution)
        logger.debug(
            "Codex image request: response_model=%s, image_model=%s, aspect=%s, resolution=%s, ref_images=%d",
            self.response_model, self.image_model, aspect_ratio, resolution, len(ref_images) if ref_images else 0,
        )

        resp = http_requests.post(
            _RESPONSES_ENDPOINT,
            headers=self._headers(),
            json=payload,
            timeout=(_CONNECT_TIMEOUT, _DEFAULT_TIMEOUT),
            stream=True,
        )
        resp.raise_for_status()

        try:
            return self._parse_sse_for_image(resp, cancel_check=cancel_check)
        finally:
            resp.close()

    # ------------------------------------------------------------------
    # SSE parsing
    # ------------------------------------------------------------------

    def _parse_sse_for_image(
        self,
        resp,
        cancel_check: Optional[Callable[[], bool]] = None,
    ) -> Optional[Image.Image]:
        """Parse SSE stream and extract the generated image.

        The image appears in an output item of type ``image_generation_call``
        with a ``result`` field containing base64-encoded image data.
        We also handle the ``response.completed`` event which carries the
        full response object as a fallback.
        """
        completed_data = None
        failure_detail = None
        last_partial_image = None
        text_fragments = []
        text_chars = 0
        recent_events = []

        for raw_line in resp.iter_lines():
            if cancel_check and cancel_check():
                resp.close()
                raise RuntimeError("Image generation cancelled while reading Codex stream")
            line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
            if not line or not line.startswith("data: "):
                continue
            raw = line[len("data: "):]
            if len(raw) > _MAX_EVENT_BYTES:
                raise ValueError("Codex image stream event exceeded maximum allowed size")
            if raw.strip() == "[DONE]":
                break
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                if len(raw) > _MAX_NON_IMAGE_EVENT_BYTES:
                    raise ValueError("Codex image stream returned an oversized invalid event")
                continue

            event_type = event.get("type", "")
            if len(raw) > _MAX_NON_IMAGE_EVENT_BYTES and not self._event_contains_image_result(event):
                event_detail = self._extract_error_detail(event)
                if event_detail:
                    failure_detail = failure_detail or event_detail
                summary = self._summarize_event(event)
                summary["oversized_non_image_bytes"] = len(raw)
                recent_events.append(summary)
                recent_events = recent_events[-8:]
                logger.warning(
                    "Skipping oversized Codex non-image SSE event: type=%s, bytes=%d",
                    event_type or "?",
                    len(raw),
                )
                continue

            recent_events.append(self._summarize_event(event))
            recent_events = recent_events[-8:]

            if event.get("error") or event_type in (
                "response.failed",
                "response.incomplete",
            ):
                failure_detail = self._extract_error_detail(event)

            if event_type == "response.output_text.delta":
                delta = event.get("delta")
                if delta:
                    text_chars += len(delta)
                    if text_chars > _MAX_TEXT_FRAGMENT_CHARS:
                        raise ValueError("Codex image stream returned too much text without an image")
                    text_fragments.append(delta)

            if event_type == "response.image_generation_call.partial_image":
                partial_b64 = event.get("partial_image_b64")
                if partial_b64:
                    last_partial_image = self._decode_base64_image(partial_b64)

            if event_type == "image_generation.completed":
                completed_b64 = event.get("b64_json")
                if completed_b64:
                    return self._decode_base64_image(completed_b64)

            # Direct image result in a delta or output item event
            if event_type in (
                "response.output_item.done",
                "response.image_generation_call.done",
                "response.image_generation_call.completed",
            ):
                item = event.get("item", event)
                text = self._extract_text_from_item(item)
                if text:
                    text_chars += len(text)
                    if text_chars > _MAX_TEXT_FRAGMENT_CHARS:
                        raise ValueError("Codex image stream returned too much text without an image")
                    text_fragments.append(text)
                img = self._try_extract_image(item)
                if img:
                    return img

            # Final completed event — contains the full response
            if event_type == "response.completed":
                completed_data = event.get("response", event)
                failure_detail = failure_detail or self._extract_error_detail(completed_data)

        # Fallback: parse the completed response
        if completed_data:
            img = self._extract_image_from_response(completed_data)
            if img:
                return img
            text = self._extract_text_from_response(completed_data)
            if text:
                text_chars += len(text)
                if text_chars > _MAX_TEXT_FRAGMENT_CHARS:
                    raise ValueError("Codex image stream returned too much text without an image")
                text_fragments.append(text)

        if failure_detail:
            if self._is_retryable_failure(failure_detail):
                raise CodexImageRetryableError(
                    f"Codex image generation failed: {failure_detail}"
                )
            raise ValueError(f"Codex image generation failed: {failure_detail}")

        if last_partial_image:
            return last_partial_image

        text = " ".join(fragment.strip() for fragment in text_fragments if fragment and fragment.strip())
        if text:
            raise ValueError(
                "Codex image generation returned text instead of an image: "
                + text[:500]
            )

        raise CodexImageNoResultError(
            "No image found in Codex Responses API stream. Recent events: "
            + json.dumps(recent_events, ensure_ascii=False)[:1000]
        )

    def _try_extract_image(self, item: dict) -> Optional[Image.Image]:
        """Try to decode an image from a single output item."""
        if item.get("type") == "image_generation_call":
            b64 = item.get("result")
            if b64:
                return self._decode_base64_image(b64)
        return None

    def _extract_image_from_response(self, data: dict) -> Optional[Image.Image]:
        """Extract image from the full response.completed payload."""
        for item in data.get("output", []):
            img = self._try_extract_image(item)
            if img:
                return img
        return None

    def _extract_text_from_response(self, data: dict) -> str:
        """Extract any text response so failures are understandable."""
        parts = []
        for item in data.get("output", []):
            text = self._extract_text_from_item(item)
            if text:
                parts.append(text)
        return "\n".join(parts)

    def _extract_text_from_item(self, item: dict) -> str:
        """Extract text from a response output item without assuming a schema."""
        if not isinstance(item, dict):
            return ""
        parts = []
        for content in item.get("content", []) or []:
            if not isinstance(content, dict):
                continue
            text = content.get("text") or content.get("content")
            if text:
                parts.append(str(text))
        text = item.get("text")
        if text:
            parts.append(str(text))
        return "\n".join(parts)

    def _event_contains_image_result(self, event: dict) -> bool:
        """Return True when a large SSE event carries an image result payload."""
        if not isinstance(event, dict):
            return False

        if self._item_contains_image_result(event):
            return True

        if event.get("partial_image_b64") or event.get("b64_json"):
            return True

        item = event.get("item")
        if self._item_contains_image_result(item):
            return True
        if isinstance(item, dict) and (item.get("partial_image_b64") or item.get("b64_json")):
            return True

        response = event.get("response")
        if isinstance(response, dict):
            for output_item in response.get("output", []) or []:
                if self._item_contains_image_result(output_item):
                    return True
                if isinstance(output_item, dict) and (
                    output_item.get("partial_image_b64") or output_item.get("b64_json")
                ):
                    return True

        return False

    @staticmethod
    def _item_contains_image_result(item: object) -> bool:
        return (
            isinstance(item, dict)
            and item.get("type") == "image_generation_call"
            and bool(item.get("result"))
        )

    def _extract_error_detail(self, data: dict) -> str:
        """Extract a compact error message from Codex stream events."""
        if not isinstance(data, dict):
            return ""

        candidates = []
        for key in ("error", "last_error", "incomplete_details"):
            value = data.get(key)
            if value:
                candidates.append(value)

        response = data.get("response")
        if isinstance(response, dict):
            for key in ("error", "last_error", "incomplete_details"):
                value = response.get(key)
                if value:
                    candidates.append(value)

        details = []
        for value in candidates:
            if isinstance(value, dict):
                message = value.get("message") or value.get("code") or value.get("reason")
                details.append(str(message or value))
            else:
                details.append(str(value))
        return "; ".join(detail for detail in details if detail)

    def _is_retryable_failure(self, detail: str) -> bool:
        """Return True for transient failures reported as successful SSE events."""
        lower = detail.lower()
        return any(
            marker in lower
            for marker in (
                "rate limit",
                "try again",
                "retry your request",
                "processing your request",
                "temporarily",
                "timeout",
                "overloaded",
                "unavailable",
            )
        )

    def _summarize_event(self, event: dict) -> dict:
        """Summarize stream events without keeping image payloads in errors."""
        summary = {"type": event.get("type", "")}
        item = event.get("item")
        if isinstance(item, dict):
            summary["item_type"] = item.get("type", "")
            if item.get("status"):
                summary["item_status"] = item.get("status")
            if item.get("result"):
                summary["has_result"] = True
        response = event.get("response")
        if isinstance(response, dict):
            summary["response_status"] = response.get("status", "")
            output = response.get("output")
            if isinstance(output, list):
                summary["output_types"] = [
                    item.get("type", "") for item in output if isinstance(item, dict)
                ][:8]
        detail = self._extract_error_detail(event)
        if detail:
            summary["error"] = detail[:300]
        return summary

    @staticmethod
    def _decode_base64_image(b64: str) -> Image.Image:
        """Decode a base64 string into a PIL Image."""
        # Strip data-URL prefix if present
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        image_data = base64.b64decode(b64)
        return Image.open(BytesIO(image_data))
