"""APIMart asynchronous image generation provider."""

import base64
import logging
import time
from io import BytesIO
from typing import Any, Dict, List, Optional

import requests
from PIL import Image

from config import get_config
from .base import ImageProvider


logger = logging.getLogger(__name__)


class APIMartRequestError(RuntimeError):
    """APIMart HTTP/API error with a status code when one is available."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class APIMartImageProvider(ImageProvider):
    """Generate images through APIMart and poll its unified task endpoint."""

    POLL_INTERVAL_SECONDS = 2.0

    def __init__(
        self,
        api_key: str,
        api_base: str = "https://api.apimart.ai/v1",
        model: str = "gpt-image-2",
        session: requests.Session = None,
    ):
        config = get_config()
        self.api_key = api_key
        self.api_base = (api_base or "https://api.apimart.ai/v1").rstrip("/")
        self.model = model
        self.session = session or requests.Session()
        self.request_timeout_seconds = config.OPENAI_TIMEOUT

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _error_message(payload: Any) -> Optional[str]:
        if not isinstance(payload, dict):
            return None
        error = payload.get("error")
        if isinstance(error, dict):
            return error.get("message")
        return str(error) if error else None

    def _request_json(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        response = self.session.request(
            method,
            f"{self.api_base}{path}",
            headers=self._headers(),
            timeout=self.request_timeout_seconds,
            **kwargs,
        )
        try:
            payload = response.json()
        except ValueError as exc:
            raise APIMartRequestError(
                f"APIMart returned a non-JSON response ({response.status_code})",
                response.status_code,
            ) from exc

        if not response.ok:
            raise APIMartRequestError(
                f"APIMart request failed ({response.status_code}): "
                f"{self._error_message(payload) or response.text[:300]}",
                response.status_code,
            )
        code = payload.get("code")
        if code not in (None, 200):
            try:
                status_code = int(code)
            except (TypeError, ValueError):
                status_code = None
            raise APIMartRequestError(
                f"APIMart API error: {self._error_message(payload) or code}",
                status_code,
            )
        return payload

    @staticmethod
    def _encode_reference_image(image: Image.Image) -> str:
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"

    @staticmethod
    def _task_id(payload: Dict[str, Any]) -> str:
        data = payload.get("data")
        if isinstance(data, list) and data:
            task_id = data[0].get("task_id") if isinstance(data[0], dict) else None
        elif isinstance(data, dict):
            task_id = data.get("task_id") or data.get("id")
        else:
            task_id = None
        if not task_id:
            raise RuntimeError("APIMart submission response is missing task_id")
        return str(task_id)

    @staticmethod
    def _result_url(task_data: Dict[str, Any]) -> str:
        images = (task_data.get("result") or {}).get("images") or []
        if not images or not isinstance(images[0], dict):
            raise RuntimeError("APIMart completed task does not contain an image result")
        urls = images[0].get("url")
        if isinstance(urls, str):
            return urls
        if isinstance(urls, list) and urls:
            return urls[0]
        raise RuntimeError("APIMart completed task does not contain an image URL")

    def _wait_for_result(self, task_id: str) -> str:
        deadline = time.monotonic() + self.request_timeout_seconds
        while time.monotonic() < deadline:
            try:
                payload = self._request_json("GET", f"/tasks/{task_id}", params={"language": "en"})
            except requests.RequestException as exc:
                logger.warning("APIMart task %s poll failed transiently: %s", task_id, exc)
                time.sleep(self.POLL_INTERVAL_SECONDS)
                continue
            except APIMartRequestError as exc:
                retryable = exc.status_code == 429 or (
                    exc.status_code is not None and 500 <= exc.status_code < 600
                )
                if not retryable:
                    raise
                logger.warning("APIMart task %s poll failed transiently: %s", task_id, exc)
                time.sleep(self.POLL_INTERVAL_SECONDS)
                continue
            task_data = payload.get("data") or {}
            status = str(task_data.get("status") or "").lower()
            if status == "completed":
                return self._result_url(task_data)
            if status in {"failed", "cancelled"}:
                error = task_data.get("error") or {}
                message = error.get("message") if isinstance(error, dict) else str(error)
                raise RuntimeError(f"APIMart image task {status}: {message or task_id}")
            if status not in {"submitted", "pending", "processing"}:
                logger.warning("APIMart task %s returned unknown status %r", task_id, status)
            time.sleep(self.POLL_INTERVAL_SECONDS)
        raise TimeoutError(f"APIMart image task timed out after {self.request_timeout_seconds:g}s")

    def _download_image(self, image_url: str) -> Image.Image:
        response = self.session.get(image_url, timeout=min(self.request_timeout_seconds, 120))
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        image.load()
        return image

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0,
    ) -> Optional[Image.Image]:
        payload: Dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": aspect_ratio,
            "resolution": resolution.lower(),
        }
        if ref_images:
            payload["image_urls"] = [
                self._encode_reference_image(image) for image in ref_images[:16]
            ]

        submission = self._request_json("POST", "/images/generations", json=payload)
        task_id = self._task_id(submission)
        logger.info("APIMart image task submitted: %s", task_id)
        return self._download_image(self._wait_for_result(task_id))
