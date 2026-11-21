"""HTTP client wrapper for Banana Slides backend."""

from __future__ import annotations

import time
from dataclasses import asdict
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import httpx

from .config import CLIConfig
from .errors import HTTPError, IOErrorCLI


class APIClient:
    """Simple API client with unified response handling and retries."""

    def __init__(self, config: CLIConfig):
        self.config = config

    def _build_url(self, path_or_url: str) -> str:
        if path_or_url.startswith(("http://", "https://")):
            return path_or_url
        return urljoin(self.config.base_url + "/", path_or_url.lstrip("/"))

    def _headers(self, path_or_url: str, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers: dict[str, str] = {}
        maybe_api = "/api/" in path_or_url or path_or_url.startswith("/api/")
        if maybe_api and self.config.access_code:
            headers["X-Access-Code"] = self.config.access_code
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        path_or_url: str,
        *,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        form_data: dict[str, Any] | None = None,
        files: Any = None,
        headers: dict[str, str] | None = None,
        timeout: int | None = None,
        raw: bool = False,
    ) -> Any:
        """Perform HTTP request and parse standard backend response."""
        url = self._build_url(path_or_url)
        req_headers = self._headers(path_or_url, headers)
        timeout_sec = timeout or self.config.request_timeout

        retries = 3 if method.upper() == "GET" else 1
        backoff = 1.0
        last_exc: Exception | None = None

        for attempt in range(1, retries + 1):
            try:
                with httpx.Client(timeout=timeout_sec) as client:
                    response = client.request(
                        method=method.upper(),
                        url=url,
                        params=params,
                        json=json_data,
                        data=form_data,
                        files=files,
                        headers=req_headers,
                    )

                if method.upper() == "GET" and response.status_code >= 500 and attempt < retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue

                if raw:
                    if not response.is_success:
                        raise self._http_error(response, url)
                    return response

                payload: dict[str, Any] | None = None
                text_body = response.text
                if text_body:
                    try:
                        payload = response.json()
                    except Exception:  # noqa: BLE001
                        payload = None

                if not response.is_success:
                    raise self._http_error(response, url, payload)

                if isinstance(payload, dict):
                    if payload.get("success") is False:
                        err = payload.get("error", {}) or {}
                        raise HTTPError(
                            err.get("message", "Request failed"),
                            details={
                                "error_code": err.get("code"),
                                "url": url,
                                "status_code": response.status_code,
                                "response": payload,
                            },
                        )
                    return payload

                return {"success": True, "data": text_body}
            except httpx.TransportError as exc:
                last_exc = exc
                if attempt >= retries:
                    raise HTTPError(
                        f"Network error calling {url}: {exc}",
                        details={"url": url, "config": asdict(self.config)},
                    ) from exc
                time.sleep(backoff)
                backoff *= 2

        if last_exc:
            raise HTTPError(str(last_exc))
        raise HTTPError(f"Request failed: {method} {url}")

    @staticmethod
    def _http_error(response: httpx.Response, url: str, payload: dict[str, Any] | None = None) -> HTTPError:
        if payload and isinstance(payload, dict):
            err = payload.get("error") or {}
            if isinstance(err, dict) and err.get("message"):
                message = str(err.get("message"))
                code = err.get("code")
                return HTTPError(
                    message,
                    details={
                        "url": url,
                        "status_code": response.status_code,
                        "error_code": code,
                        "response": payload,
                    },
                )
        message = response.text.strip() or f"HTTP {response.status_code}"
        return HTTPError(
            f"HTTP {response.status_code}: {message}",
            details={"url": url, "status_code": response.status_code},
        )

    def get(self, path_or_url: str, **kwargs: Any) -> Any:
        return self.request("GET", path_or_url, **kwargs)

    def post(self, path_or_url: str, **kwargs: Any) -> Any:
        return self.request("POST", path_or_url, **kwargs)

    def put(self, path_or_url: str, **kwargs: Any) -> Any:
        return self.request("PUT", path_or_url, **kwargs)

    def delete(self, path_or_url: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path_or_url, **kwargs)

    def download(self, path_or_url: str, output_path: str | Path) -> dict[str, Any]:
        """Download a binary response to local file."""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        response = self.request("GET", path_or_url, raw=True)

        try:
            output.write_bytes(response.content)
        except Exception as exc:  # noqa: BLE001
            raise IOErrorCLI(f"Failed to write file: {output}", details=str(exc)) from exc

        return {
            "success": True,
            "data": {
                "output_path": str(output.resolve()),
                "size_bytes": len(response.content),
                "source_url": self._build_url(path_or_url),
            },
        }
