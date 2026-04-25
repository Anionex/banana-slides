"""
Codex OAuth image provider — uses the ChatGPT Responses API with image_generation tool.

Endpoint: POST https://chatgpt.com/backend-api/codex/responses
Auth:     Bearer <oauth_access_token>

Image generation is done by sending a Responses API request with
tools=[{"type": "image_generation", ...}] and tool_choice={"type": "image_generation"}.
The result contains a base64-encoded image in the output.
"""
import base64
import json
import logging
from io import BytesIO
from typing import Optional, List

import requests as http_requests
from PIL import Image

from .base import ImageProvider

logger = logging.getLogger(__name__)

_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
_RESPONSES_ENDPOINT = f"{_CODEX_BASE_URL}/responses"

_DEFAULT_TIMEOUT = 180  # image generation can be slow

# Aspect-ratio → size mapping for the image_generation tool
_SIZE_MAP = {
    "16:9": "1536x1024",
    "9:16": "1024x1536",
    "1:1":  "1024x1024",
    "3:2":  "1536x1024",
    "2:3":  "1024x1536",
    "4:3":  "1536x1024",
    "3:4":  "1024x1536",
}


class CodexImageProvider(ImageProvider):
    """Image generation via the ChatGPT Codex Responses API (OAuth)."""

    def __init__(self, api_key: str, model: str = "gpt-4.1"):
        """
        Args:
            api_key: OAuth access token.
            model:   The *text* model that orchestrates the tool call
                     (e.g. gpt-4.1). The actual image model is specified
                     inside the tool definition.
        """
        self.api_key = api_key
        self.model = model
        # The image model used inside the tool definition
        self.image_model = "gpt-image-1"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, prompt: str, aspect_ratio: str, quality: str = "high") -> dict:
        """Build a Responses API request with image_generation tool."""
        size = _SIZE_MAP.get(aspect_ratio, "1024x1024")
        return {
            "model": self.model,
            "input": [
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": prompt}],
                }
            ],
            "tools": [
                {
                    "type": "image_generation",
                    "model": self.image_model,
                    "size": size,
                    "quality": quality,
                }
            ],
            "tool_choice": {"type": "image_generation"},
            "stream": True,
        }

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0,
    ) -> Optional[Image.Image]:
        """Generate an image via the Codex Responses API.

        ref_images, resolution, enable_thinking, thinking_budget are accepted
        for interface compatibility but ignored — the Codex image_generation
        tool does not support these features.
        """
        try:
            payload = self._build_payload(prompt, aspect_ratio)
            logger.debug(
                "Codex image request: model=%s, image_model=%s, aspect=%s",
                self.model, self.image_model, aspect_ratio,
            )

            resp = http_requests.post(
                _RESPONSES_ENDPOINT,
                headers=self._headers(),
                json=payload,
                timeout=_DEFAULT_TIMEOUT,
                stream=True,
            )
            resp.raise_for_status()

            return self._parse_sse_for_image(resp)

        except Exception as e:
            error_detail = (
                f"Error generating image with Codex "
                f"(model={self.model}, image_model={self.image_model}): "
                f"{type(e).__name__}: {e}"
            )
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e

    # ------------------------------------------------------------------
    # SSE parsing
    # ------------------------------------------------------------------

    def _parse_sse_for_image(self, resp) -> Optional[Image.Image]:
        """Parse SSE stream and extract the generated image.

        The image appears in an output item of type ``image_generation_call``
        with a ``result`` field containing base64-encoded image data.
        We also handle the ``response.completed`` event which carries the
        full response object as a fallback.
        """
        completed_data = None

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

            event_type = event.get("type", "")

            # Direct image result in a delta or output item event
            if event_type in (
                "response.output_item.done",
                "response.image_generation_call.done",
            ):
                item = event.get("item", event)
                img = self._try_extract_image(item)
                if img:
                    return img

            # Final completed event — contains the full response
            if event_type == "response.completed":
                completed_data = event.get("response", event)

        # Fallback: parse the completed response
        if completed_data:
            return self._extract_image_from_response(completed_data)

        raise ValueError("No image found in Codex Responses API stream")

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
        raise ValueError(
            "No image_generation_call found in Codex response output: "
            + str(data)[:500]
        )

    @staticmethod
    def _decode_base64_image(b64: str) -> Image.Image:
        """Decode a base64 string into a PIL Image."""
        # Strip data-URL prefix if present
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        image_data = base64.b64decode(b64)
        return Image.open(BytesIO(image_data))
