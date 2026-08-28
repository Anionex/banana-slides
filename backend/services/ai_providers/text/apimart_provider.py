"""APIMart text provider.

APIMart exposes an OpenAI-compatible request shape but wraps successful
responses in ``{"code": 200, "data": ...}``, so the stock OpenAI SDK cannot
consume the response directly.
"""

import base64
import logging
from io import BytesIO
from typing import Any, Dict, List

import requests
from PIL import Image

from config import get_config
from .base import TextProvider, strip_think_tags


logger = logging.getLogger(__name__)


class APIMartTextProvider(TextProvider):
    """Text and vision requests through APIMart's chat completions API."""

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.apimart.ai/v1",
        model: str = "gpt-5",
        session: requests.Session = None,
    ):
        config = get_config()
        self.api_key = api_key
        self.api_base = (api_base or "https://api.apimart.ai/v1").rstrip("/")
        self.model = model
        self.session = session or requests.Session()
        self.request_timeout_seconds = config.OPENAI_TIMEOUT
        self.max_attempts = 1

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _unwrap_response(payload: Any) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            raise RuntimeError("APIMart returned an invalid response payload")

        error = payload.get("error")
        if error:
            message = error.get("message") if isinstance(error, dict) else str(error)
            raise RuntimeError(f"APIMart API error: {message}")

        code = payload.get("code")
        if code is not None and code != 200:
            raise RuntimeError(f"APIMart API error: unexpected response code {code}")

        data = payload.get("data", payload)
        if not isinstance(data, dict):
            raise RuntimeError("APIMart response is missing the data object")
        return data

    def _complete(self, messages: List[Dict[str, Any]]) -> str:
        response = self.session.post(
            f"{self.api_base}/chat/completions",
            headers=self._headers(),
            json={"model": self.model, "messages": messages},
            timeout=self.request_timeout_seconds,
        )
        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message")
            except (ValueError, AttributeError):
                detail = None
            raise RuntimeError(
                f"APIMart request failed ({response.status_code}): "
                f"{detail or response.text[:300]}"
            )

        data = self._unwrap_response(response.json())
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("APIMart response does not contain any choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return strip_think_tags(content)

        parts = []
        for item in content or []:
            text = item.get("text") if isinstance(item, dict) else None
            if text:
                parts.append(text)
        if not parts:
            raise RuntimeError("APIMart response does not contain text content")
        return strip_think_tags("\n".join(parts))

    def generate_text(self, prompt: str, thinking_budget: int = 0) -> str:
        return self._complete([{"role": "user", "content": prompt}])

    def generate_with_image(self, prompt: str, image_path: str, thinking_budget: int = 0) -> str:
        with open(image_path, "rb") as image_file:
            image_bytes = image_file.read()
        with Image.open(BytesIO(image_bytes)) as image:
            image_format = (image.format or "png").lower()
        media_type = {
            "jpeg": "image/jpeg",
            "jpg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif",
        }.get(image_format, f"image/{image_format}")
        encoded = base64.b64encode(image_bytes).decode("ascii")

        return self._complete([
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{encoded}"},
                    },
                ],
            }
        ])
