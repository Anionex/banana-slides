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
from io import BytesIO
from typing import Optional, List

import requests as http_requests
from PIL import Image

from .base import ImageProvider
from .openai_provider import _compute_gpt_image_size

logger = logging.getLogger(__name__)

_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
_RESPONSES_ENDPOINT = f"{_CODEX_BASE_URL}/responses"

_DEFAULT_TIMEOUT = 180  # image generation can be slow


class CodexImageProvider(ImageProvider):
    """Image generation via the ChatGPT Codex Responses API (OAuth)."""

    def __init__(self, api_key: str, model: str = "gpt-image-1", resolution: str = "2K"):
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

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, prompt: str, aspect_ratio: str, ref_images: Optional[List[Image.Image]] = None, quality: str = "high") -> dict:
        """Build a Responses API request with image_generation tool."""
        size = _compute_gpt_image_size(aspect_ratio, self.resolution)

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
            "model": "gpt-5.4",
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
            payload = self._build_payload(prompt, aspect_ratio, ref_images=ref_images)
            logger.debug(
                "Codex image request: image_model=%s, aspect=%s, ref_images=%d",
                self.image_model, aspect_ratio, len(ref_images) if ref_images else 0,
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
                f"(image_model={self.image_model}): "
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
