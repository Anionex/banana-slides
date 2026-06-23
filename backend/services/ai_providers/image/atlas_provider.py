"""
Atlas Cloud image provider — uses the Atlas Cloud asynchronous Media API.

Atlas Cloud image models (e.g. the nano-banana family) are NOT exposed through
an OpenAI-compatible ``images.generate`` / chat-completions endpoint, so they
cannot be driven by ``OpenAIImageProvider``. Instead they use a submit-then-poll
async API:

    POST https://api.atlascloud.ai/api/v1/model/generateImage   -> {"data": {"id": ...}}
    GET  https://api.atlascloud.ai/api/v1/model/prediction/{id}  -> {"data": {"status": ..., "outputs": [...]}}

Auth: ``Authorization: Bearer <ATLASCLOUD_API_KEY>``.

This provider implements the same ``ImageProvider.generate_image`` contract as
the other backends: text-to-image when no reference image is given, and
image-to-image (the ``edit`` model variant) when reference images are supplied.
"""
import base64
import logging
import time
from io import BytesIO
from typing import Optional, List

import requests
from PIL import Image
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

from .base import ImageProvider

logger = logging.getLogger(__name__)

_DEFAULT_API_BASE = "https://api.atlascloud.ai/api/v1/model"
_DEFAULT_MODEL = "google/nano-banana/text-to-image"

# Long edge (px) per resolution tier, used to derive the Atlas ``W*H`` size.
_RESOLUTION_LONG_EDGE = {
    "1K": 1024,
    "2K": 2048,
    "4K": 3840,
}

_POLL_INTERVAL_SECONDS = 3.0
_USER_AGENT = "banana-slides/atlas-image-provider"


def _is_retryable_http_error(exc: BaseException) -> bool:
    """Return True for transient HTTP/network errors worth retrying."""
    if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
        return exc.response.status_code in (429, 500, 502, 503, 504)
    if isinstance(exc, (
        requests.exceptions.SSLError,
        requests.exceptions.ConnectionError,
        requests.exceptions.Timeout,
        requests.exceptions.ChunkedEncodingError,
    )):
        return True
    return False


def _log_retry(retry_state):
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    status = getattr(getattr(exc, "response", None), "status_code", "?")
    exc_type = type(exc).__name__ if exc else "UnknownError"
    logger.warning(
        "Atlas image request failed (%s, HTTP %s), retrying %d/3: %s",
        exc_type, status, retry_state.attempt_number, exc,
    )


def _compute_atlas_size(aspect_ratio: str, resolution: str = "2K") -> str:
    """Map aspect ratio + resolution tier to an Atlas ``W*H`` size string.

    Atlas expects ``宽*高`` (width*height), e.g. ``1920*1080`` — note the ``*``
    separator, not ``x``. Both edges are kept reasonable and the long edge is
    driven by the resolution tier.
    """
    long_edge = _RESOLUTION_LONG_EDGE.get(resolution.upper(), 2048)
    parts = aspect_ratio.split(":")
    if len(parts) != 2:
        return f"{long_edge}*{long_edge}"
    try:
        aw, ah = int(parts[0]), int(parts[1])
    except ValueError:
        return f"{long_edge}*{long_edge}"
    if aw <= 0 or ah <= 0:
        return f"{long_edge}*{long_edge}"

    if aw >= ah:
        w = long_edge
        h = round(w * ah / aw)
    else:
        h = long_edge
        w = round(h * aw / ah)
    return f"{max(64, w)}*{max(64, h)}"


class AtlasImageProvider(ImageProvider):
    """Image generation via the Atlas Cloud async Media API."""

    def __init__(
        self,
        api_key: str,
        api_base: Optional[str] = None,
        model: str = _DEFAULT_MODEL,
        timeout: float = 300.0,
        edit_model: Optional[str] = None,
    ):
        """
        Args:
            api_key:   Atlas Cloud API key.
            api_base:  Media API base URL (defaults to the official endpoint).
            model:     Text-to-image model id (e.g. ``google/nano-banana/text-to-image``).
            timeout:   Max seconds to wait for an async prediction to complete.
            edit_model: Image-to-image model id used when reference images are
                        supplied. Defaults to swapping a ``/text-to-image``
                        suffix for ``/edit`` on ``model``.
        """
        self.api_key = api_key
        self.api_base = (api_base or _DEFAULT_API_BASE).rstrip("/")
        self.model = model or _DEFAULT_MODEL
        self.timeout = timeout
        self.edit_model = edit_model or self._derive_edit_model(self.model)

    @staticmethod
    def _derive_edit_model(model: str) -> str:
        """Derive the image-to-image (edit) model id from the t2i model id."""
        if model.endswith("/text-to-image"):
            return model[: -len("/text-to-image")] + "/edit"
        if "/edit" in model:
            return model
        return model

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
        }

    @staticmethod
    def _image_to_data_url(image: Image.Image) -> str:
        """Encode a PIL image as a base64 PNG data URL accepted by the edit API."""
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGB")
        buf = BytesIO()
        image.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        retry=retry_if_exception(_is_retryable_http_error),
        reraise=True,
        before_sleep=_log_retry,
    )
    def _submit(self, payload: dict) -> str:
        """Submit a generation task and return the prediction id."""
        resp = requests.post(
            f"{self.api_base}/generateImage",
            headers=self._headers(),
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json().get("data") or {}
        prediction_id = data.get("id")
        if not prediction_id:
            raise ValueError(f"Atlas generateImage returned no prediction id: {resp.text[:300]}")
        return prediction_id

    def _poll(self, prediction_id: str) -> str:
        """Poll until the prediction completes; return the first output URL."""
        deadline = time.monotonic() + self.timeout
        get_url = f"{self.api_base}/prediction/{prediction_id}"
        while True:
            resp = requests.get(get_url, headers=self._headers(), timeout=30)
            resp.raise_for_status()
            data = resp.json().get("data") or {}
            status = (data.get("status") or "").lower()

            if status in ("completed", "succeeded"):
                outputs = data.get("outputs") or []
                if not outputs:
                    raise ValueError("Atlas prediction completed but returned no outputs")
                return outputs[0]
            if status in ("failed", "error", "canceled", "cancelled"):
                raise ValueError(f"Atlas prediction failed: {data.get('error') or status}")

            if time.monotonic() >= deadline:
                raise TimeoutError(
                    f"Atlas prediction {prediction_id} did not complete within {self.timeout}s "
                    f"(last status: {status or 'unknown'})"
                )
            time.sleep(_POLL_INTERVAL_SECONDS)

    @staticmethod
    def _download_image(url: str) -> Image.Image:
        with requests.get(url, timeout=120, stream=True) as resp:
            resp.raise_for_status()
            return Image.open(BytesIO(resp.content))

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0,
    ) -> Optional[Image.Image]:
        """Generate an image via the Atlas Cloud async Media API.

        Note: ``enable_thinking`` and ``thinking_budget`` are ignored — the Atlas
        Media API does not expose a thinking mode for image models.
        """
        size = _compute_atlas_size(aspect_ratio, resolution)

        if ref_images:
            payload = {
                "model": self.edit_model,
                "prompt": prompt,
                # Atlas expects multiple images newline-separated, not comma-separated.
                "images": "\n".join(self._image_to_data_url(img) for img in ref_images),
                "size": size,
            }
            logger.info("Atlas image: edit model=%s, size=%s, refs=%d", self.edit_model, size, len(ref_images))
        else:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "size": size,
            }
            logger.info("Atlas image: text-to-image model=%s, size=%s", self.model, size)

        prediction_id = self._submit(payload)
        output_url = self._poll(prediction_id)
        logger.debug("Atlas image output URL: %s", output_url)
        return self._download_image(output_url)
