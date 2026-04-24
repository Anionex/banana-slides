"""
Google GenAI SDK image generation provider.

Operates in two authentication modes selected at construction time:
  * API-key mode  (Google AI Studio or compatible proxy)
  * Vertex AI mode (GCP service-account credentials via GOOGLE_APPLICATION_CREDENTIALS)
"""

import base64
import logging
from io import BytesIO
from typing import Any, List, Optional

from google import genai
from google.genai import types
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential

from config import get_config
from ..genai_client import make_genai_client
from .base import ImageProvider

logger = logging.getLogger(__name__)


class GenAIImageProvider(ImageProvider):
    """Image generation via Google GenAI SDK (AI Studio / Vertex AI)."""

    def __init__(
        self,
        model: str = "gemini-3-pro-image-preview",
        api_key: str = None,
        api_base: str = None,
        vertexai: bool = False,
        project_id: str = None,
        location: str = None,
    ):
        self.client = make_genai_client(
            vertexai=vertexai,
            api_key=api_key,
            api_base=api_base,
            project_id=project_id,
            location=location,
        )
        self.model = model

    @staticmethod
    def _preview_text(value: Any, limit: int = 120) -> str:
        text = str(value or "")
        return text if len(text) <= limit else f"{text[:limit]}..."

    @staticmethod
    def _open_image_from_bytes(data: Any) -> Optional[Image.Image]:
        if not data:
            return None

        raw_bytes = None
        if isinstance(data, (bytes, bytearray)):
            raw_bytes = bytes(data)
        elif isinstance(data, str):
            try:
                raw_bytes = base64.b64decode(data)
            except Exception:
                return None

        if not raw_bytes:
            return None

        image = Image.open(BytesIO(raw_bytes))
        image.load()
        return image

    @classmethod
    def _extract_image_from_payload(cls, payload: Any) -> Optional[Image.Image]:
        if payload is None:
            return None

        if isinstance(payload, Image.Image):
            return payload

        if hasattr(payload, "as_image"):
            try:
                image = payload.as_image()
                if isinstance(image, Image.Image):
                    return image
                if hasattr(image, "image_bytes"):
                    return cls._open_image_from_bytes(getattr(image, "image_bytes", None))
                if hasattr(image, "_pil_image"):
                    pil_image = getattr(image, "_pil_image", None)
                    if pil_image is not None:
                        return pil_image
            except Exception:
                pass

        if isinstance(payload, dict):
            for key in ("inline_data", "file_data", "image", "data"):
                if key in payload:
                    image = cls._extract_image_from_payload(payload[key])
                    if image is not None:
                        return image

        for attr_name in ("inline_data", "file_data", "image", "data"):
            if hasattr(payload, attr_name):
                image = cls._extract_image_from_payload(getattr(payload, attr_name))
                if image is not None:
                    return image

        for attr_name in ("image_bytes", "bytes"):
            if hasattr(payload, attr_name):
                image = cls._open_image_from_bytes(getattr(payload, attr_name))
                if image is not None:
                    return image

        if isinstance(payload, dict):
            for key in ("image_bytes", "bytes"):
                if key in payload:
                    image = cls._open_image_from_bytes(payload[key])
                    if image is not None:
                        return image

        if isinstance(payload, dict) and payload.get("text"):
            logger.debug("GenAI text-only part: %s", cls._preview_text(payload["text"]))
        elif hasattr(payload, "text") and getattr(payload, "text", None):
            logger.debug("GenAI text-only part: %s", cls._preview_text(getattr(payload, "text")))

        return None

    @staticmethod
    def _collect_response_parts(response: Any) -> List[Any]:
        parts: List[Any] = []

        direct_parts = getattr(response, "parts", None)
        if direct_parts:
            parts.extend(list(direct_parts))

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            candidate_parts = getattr(content, "parts", None) if content is not None else None
            if candidate_parts:
                parts.extend(list(candidate_parts))

        return parts

    @classmethod
    def _describe_response(cls, response: Any, parts: List[Any]) -> str:
        text_preview = getattr(response, "text", None)
        if text_preview:
            return f"Response text preview: {cls._preview_text(text_preview)}"

        candidates = getattr(response, "candidates", None) or []
        if candidates:
            finish_reason = getattr(candidates[0], "finish_reason", None)
            if finish_reason:
                return f"finish_reason={finish_reason}"

        if parts:
            return f"Response had {len(parts)} parts but none contained valid images."
        return "Response had no parts."

    @retry(
        stop=stop_after_attempt(get_config().GENAI_MAX_RETRIES + 1),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = True,
        thinking_budget: int = 1024,
    ) -> Optional[Image.Image]:
        """
        Generate image using Google GenAI SDK.

        Args:
            prompt: The image generation prompt
            ref_images: Optional list of reference images
            aspect_ratio: Image aspect ratio
            resolution: Image resolution (supports "1K", "2K", "4K")
            enable_thinking: If True, enable thinking chain mode
            thinking_budget: Thinking budget for the model

        Returns:
            Generated PIL Image object, or None if failed
        """
        try:
            contents: List[Any] = []

            if ref_images:
                contents.extend(ref_images)

            contents.append(prompt)

            logger.debug(
                "Calling GenAI API for image generation with %s reference images...",
                len(ref_images) if ref_images else 0,
            )
            logger.debug(
                "Config - aspect_ratio: %s, resolution: %s, enable_thinking: %s",
                aspect_ratio,
                resolution,
                enable_thinking,
            )

            config_params = {
                "response_modalities": ["TEXT", "IMAGE"],
                "image_config": types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                    image_size=resolution,
                ),
            }

            if enable_thinking:
                config_params["thinking_config"] = types.ThinkingConfig(
                    thinking_budget=thinking_budget,
                    include_thoughts=True,
                )

            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(**config_params),
            )

            logger.debug("GenAI API call completed")

            last_image = None
            parts = self._collect_response_parts(response)
            logger.debug("GenAI response contains %s parts", len(parts))

            for index, part in enumerate(parts):
                try:
                    image = self._extract_image_from_payload(part)
                    if image is not None:
                        last_image = image
                        logger.debug("Successfully extracted image from part %s", index)
                except Exception as exc:
                    logger.warning(
                        "Part %s: Failed to extract image - %s: %s",
                        index,
                        type(exc).__name__,
                        str(exc),
                    )

            if last_image:
                return last_image

            error_msg = f"No image found in API response. {self._describe_response(response, parts)}"
            raise ValueError(error_msg)

        except Exception as e:
            error_detail = f"Error generating image with GenAI: {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e
