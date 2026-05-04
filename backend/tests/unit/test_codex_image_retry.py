"""
Unit tests for Codex image provider retry logic.

Verifies that generate_image retries on 429/5xx and raises immediately
on non-retryable errors (400, 401).
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
import requests


# ---------------------------------------------------------------------------
# Direct-import the codex image provider module
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).resolve().parent.parent.parent

def _load_module(rel_path: str, module_name: str):
    path = _BACKEND / rel_path
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod

# Load base first
_img_base = _load_module(
    "services/ai_providers/image/base.py",
    "services.ai_providers.image.base",
)

# openai_provider exports _compute_gpt_image_size used by codex_provider
_openai_img = _load_module(
    "services/ai_providers/image/openai_provider.py",
    "services.ai_providers.image.openai_provider",
)

_codex_img = _load_module(
    "services/ai_providers/image/codex_provider.py",
    "services.ai_providers.image.codex_provider",
)

CodexImageProvider = _codex_img.CodexImageProvider
_is_retryable_http_error = _codex_img._is_retryable_http_error


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ok_sse_response():
    """Simulate a successful SSE response with a base64 image."""
    import base64
    from io import BytesIO
    from PIL import Image

    img = Image.new("RGB", (100, 100), "blue")
    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()

    event = {
        "type": "response.output_item.done",
        "item": {
            "type": "image_generation_call",
            "result": b64,
        },
    }
    import json
    event_line = f"data: {json.dumps(event)}".encode()

    resp = MagicMock(spec=requests.Response)
    resp.status_code = 200
    resp.raise_for_status = MagicMock()
    resp.iter_lines.return_value = [
        event_line,
        b"data: [DONE]",
    ]
    return resp


def _make_error_response(status):
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status
    http_err = requests.exceptions.HTTPError(response=resp)
    resp.raise_for_status = MagicMock(side_effect=http_err)
    return resp


def _provider():
    return CodexImageProvider(api_key="test-token", model="gpt-image-1")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestImageRetryableErrors:

    @pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
    def test_retryable_status_codes(self, status):
        resp = MagicMock()
        resp.status_code = status
        exc = requests.exceptions.HTTPError(response=resp)
        assert _is_retryable_http_error(exc) is True

    @pytest.mark.parametrize("status", [400, 401, 403, 404])
    def test_non_retryable_status_codes(self, status):
        resp = MagicMock()
        resp.status_code = status
        exc = requests.exceptions.HTTPError(response=resp)
        assert _is_retryable_http_error(exc) is False


class TestGenerateImageRetry:

    def test_success_on_first_try(self):
        ok = _make_ok_sse_response()
        with patch.object(_codex_img.http_requests, "post", return_value=ok) as mock_post:
            result = _provider().generate_image("a blue square")
            assert result is not None
            assert mock_post.call_count == 1

    def test_retries_on_429_then_succeeds(self):
        err = _make_error_response(429)
        ok = _make_ok_sse_response()
        with patch.object(_codex_img.http_requests, "post", side_effect=[err, err, ok]) as mock_post:
            result = _provider().generate_image("a blue square")
            assert result is not None
            assert mock_post.call_count == 3

    def test_retries_on_503_then_succeeds(self):
        err = _make_error_response(503)
        ok = _make_ok_sse_response()
        with patch.object(_codex_img.http_requests, "post", side_effect=[err, ok]) as mock_post:
            result = _provider().generate_image("a blue square")
            assert result is not None
            assert mock_post.call_count == 2

    def test_raises_immediately_on_401(self):
        err = _make_error_response(401)
        with patch.object(_codex_img.http_requests, "post", return_value=err) as mock_post:
            with pytest.raises(requests.exceptions.HTTPError):
                _provider().generate_image("a blue square")
            assert mock_post.call_count == 1

    def test_exhausts_retries_on_persistent_429(self):
        err = _make_error_response(429)
        with patch.object(_codex_img.http_requests, "post", return_value=err) as mock_post:
            with pytest.raises(requests.exceptions.HTTPError):
                _provider().generate_image("a blue square")
            assert mock_post.call_count == 5
