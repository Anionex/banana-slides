"""Task-scoped 科创点AI platform provider.

No provider credential is accepted here. Every call is delegated to the
platform model gateway with a short-lived PPT execution token.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Optional, List
from urllib.parse import urljoin

import requests
from PIL import Image

from .text.base import TextProvider
from .image.base import ImageProvider

logger = logging.getLogger(__name__)


class PlatformInvocationError(RuntimeError):
    pass


@dataclass(frozen=True)
class PlatformExecution:
    project_id: int
    job_id: int
    idempotency_key: str
    gateway_base_url: str
    execution_token: str
    supports_reference_images: bool = False

    @classmethod
    def from_request(cls, value: Any) -> "PlatformExecution":
        if not isinstance(value, dict) or value.get("provider") != "KCD_PLATFORM":
            raise ValueError("platform_execution.provider must be KCD_PLATFORM")
        required = (
            "project_id", "job_id", "idempotency_key",
            "gateway_base_url", "execution_token",
        )
        missing = [key for key in required if not value.get(key)]
        if missing:
            raise ValueError(f"platform_execution missing fields: {', '.join(missing)}")
        base_url = str(value["gateway_base_url"]).strip().rstrip("/")
        if not base_url.startswith(("http://", "https://")):
            raise ValueError("platform_execution.gateway_base_url must be http(s)")
        return cls(
            project_id=int(value["project_id"]),
            job_id=int(value["job_id"]),
            idempotency_key=str(value["idempotency_key"]),
            gateway_base_url=base_url,
            execution_token=str(value["execution_token"]),
            supports_reference_images=bool(value.get("supports_reference_images", False)),
        )

    def redacted(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "job_id": self.job_id,
            "idempotency_key": self.idempotency_key,
            "gateway_base_url": self.gateway_base_url,
            "execution_token": "***",
            "supports_reference_images": self.supports_reference_images,
        }


class PlatformInvocationClient:
    def __init__(self, execution: PlatformExecution, timeout_seconds: int = 900):
        self.execution = execution
        self.timeout_seconds = max(30, timeout_seconds)

    def invoke(self, capability: str, input_payload: dict[str, Any]) -> Any:
        invocation_key = self._next_key(capability, input_payload)
        body = {
            "projectId": self.execution.project_id,
            "pptJobId": self.execution.job_id,
            "capability": capability,
            "idempotencyKey": invocation_key,
            "input": input_payload,
        }
        created = self._request(
            "POST", "/api/internal/v1/ppt/model-invocations", json=body
        )
        invocation = self._data(created)
        invocation_id = invocation.get("invocationId")
        if not invocation_id:
            raise PlatformInvocationError("platform did not return invocationId")
        deadline = time.monotonic() + self.timeout_seconds
        while True:
            status = str(invocation.get("status") or "").upper()
            if status in {"SUCCESS", "SUCCEEDED"}:
                return invocation.get("result")
            if status in {"FAILED", "CANCELLED", "TIMEOUT"}:
                code = invocation.get("errorCode") or "PLATFORM_MODEL_FAILED"
                message = invocation.get("errorMessage") or invocation.get("progressMessage") or status
                raise PlatformInvocationError(f"{code}: {message}")
            if time.monotonic() >= deadline:
                raise PlatformInvocationError("PLATFORM_MODEL_TIMEOUT: invocation polling timed out")
            time.sleep(1.5)
            polled = self._request(
                "GET", f"/api/internal/v1/ppt/model-invocations/{invocation_id}"
            )
            invocation = self._data(polled)

    def _next_key(self, capability: str, payload: dict[str, Any]) -> str:
        canonical = json.dumps(
            payload,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
            default=str,
        )
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:24]
        return f"{self.execution.idempotency_key}:{capability.lower()}:{digest}"

    def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        url = urljoin(self.execution.gateway_base_url + "/", path.lstrip("/"))
        response = requests.request(
            method,
            url,
            headers={
                "Authorization": f"Bearer {self.execution.execution_token}",
                "Accept": "application/json",
            },
            timeout=(5, 30),
            **kwargs,
        )
        if response.status_code >= 400:
            raise PlatformInvocationError(
                f"PLATFORM_GATEWAY_HTTP_{response.status_code}: request rejected"
            )
        try:
            return response.json()
        except ValueError as exc:
            raise PlatformInvocationError("PLATFORM_GATEWAY_INVALID_JSON") from exc

    @staticmethod
    def _data(envelope: dict[str, Any]) -> dict[str, Any]:
        data = envelope.get("data")
        if not isinstance(data, dict):
            raise PlatformInvocationError("platform response missing data")
        return data


class KcdPlatformTextProvider(TextProvider):
    def __init__(self, client: PlatformInvocationClient):
        self.client = client

    def generate_text(self, prompt: str, thinking_budget: int = 1000) -> str:
        result = self.client.invoke(
            "TEXT_GENERATION",
            {"prompt": prompt},
        )
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            value = result.get("text") or result.get("content")
            if value is not None:
                return str(value)
        raise PlatformInvocationError("platform text result is empty")

    def generate_with_image(self, prompt: str, image_path: str, **_: Any) -> str:
        with Image.open(image_path) as image:
            data_url = KcdPlatformImageProvider._data_url(image)
        result = self.client.invoke(
            "VISION_ANALYSIS",
            {"prompt": prompt, "referenceImages": [data_url]},
        )
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            value = result.get("text") or result.get("content")
            if value is not None:
                return str(value)
        raise PlatformInvocationError("platform vision result is empty")


class KcdPlatformImageProvider(ImageProvider):
    supports_invocation_operation = True

    def __init__(self, client: PlatformInvocationClient):
        self.client = client

    def generate_image(
        self,
        prompt: str,
        ref_images: Optional[List[Image.Image]] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K",
        enable_thinking: bool = False,
        thinking_budget: int = 0,
        invocation_operation: Optional[str] = None,
    ) -> Optional[Image.Image]:
        payload: dict[str, Any] = {
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "resolution": resolution,
            "count": 1,
        }
        if invocation_operation:
            payload["_pptOperation"] = str(invocation_operation).strip()[:64]
        if ref_images:
            payload["referenceImages"] = [self._data_url(image) for image in ref_images]
        result = self.client.invoke("IMAGE_GENERATION", payload)
        url = self._first_image_url(result)
        if not url:
            raise PlatformInvocationError("platform image result has no URL")
        if url.startswith("/"):
            url = urljoin(self.client.execution.gateway_base_url + "/", url.lstrip("/"))
        response = requests.get(url, timeout=(5, 120))
        response.raise_for_status()
        image = Image.open(io.BytesIO(response.content))
        image.load()
        return image

    @staticmethod
    def _data_url(image: Image.Image) -> str:
        buffer = io.BytesIO()
        converted = image.convert("RGB") if image.mode not in ("RGB", "L") else image
        converted.save(buffer, format="JPEG", quality=90)
        if converted is not image:
            converted.close()
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    @classmethod
    def _first_image_url(cls, value: Any) -> Optional[str]:
        if isinstance(value, str):
            return value if value.startswith(("http://", "https://", "/")) else None
        if isinstance(value, list):
            for item in value:
                found = cls._first_image_url(item)
                if found:
                    return found
        if isinstance(value, dict):
            for key in ("url", "imageUrl", "image_url", "resourceUrl", "contentText"):
                found = cls._first_image_url(value.get(key))
                if found:
                    return found
            for key in ("urls", "images", "resources", "data"):
                found = cls._first_image_url(value.get(key))
                if found:
                    return found
        return None


def create_platform_ai_service(value: Any):
    # Import lazily to avoid an ai_service -> providers -> ai_service cycle.
    from services.ai_service import AIService

    execution = PlatformExecution.from_request(value)
    logger.info("Creating KCD_PLATFORM service context=%s", execution.redacted())
    client = PlatformInvocationClient(execution)
    text = KcdPlatformTextProvider(client)
    image = KcdPlatformImageProvider(client)
    service = AIService(text_provider=text, image_provider=image, caption_provider=text)
    service.supports_reference_images = execution.supports_reference_images
    return service
