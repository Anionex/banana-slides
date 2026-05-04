"""
Unit tests for Codex text provider retry logic.

Verifies that _post_with_retry retries on 429/5xx and raises immediately
on non-retryable errors (400, 401, 403, 404).

Uses importlib to load the codex_provider module directly, bypassing the
services/__init__.py chain that pulls in google.genai / flask_migrate.
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
import requests


# ---------------------------------------------------------------------------
# Direct-import the codex_provider module without triggering the full
# services package __init__ (which drags in google-genai, flask, etc.)
# ---------------------------------------------------------------------------
_BACKEND = Path(__file__).resolve().parent.parent.parent  # backend/

def _load_module(rel_path: str, module_name: str):
    """Load a single .py file as a standalone module."""
    path = _BACKEND / rel_path
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod

# Load the base module first (TextProvider, strip_think_tags)
_base = _load_module(
    "services/ai_providers/text/base.py",
    "services.ai_providers.text.base",
)
# Now load the codex provider
_codex = _load_module(
    "services/ai_providers/text/codex_provider.py",
    "services.ai_providers.text.codex_provider",
)

CodexTextProvider = _codex.CodexTextProvider
_is_retryable_http_error = _codex._is_retryable_http_error


# ---------------------------------------------------------------------------
# _is_retryable_http_error
# ---------------------------------------------------------------------------

class TestIsRetryableHttpError:

    @pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
    def test_retryable_status_codes(self, status):
        resp = MagicMock()
        resp.status_code = status
        exc = requests.exceptions.HTTPError(response=resp)
        assert _is_retryable_http_error(exc) is True

    @pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
    def test_non_retryable_status_codes(self, status):
        resp = MagicMock()
        resp.status_code = status
        exc = requests.exceptions.HTTPError(response=resp)
        assert _is_retryable_http_error(exc) is False

    def test_non_http_error(self):
        assert _is_retryable_http_error(ValueError("boom")) is False

    def test_http_error_without_response(self):
        exc = requests.exceptions.HTTPError()
        assert _is_retryable_http_error(exc) is False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ok_response(status=200):
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status
    resp.raise_for_status = MagicMock()
    return resp


def _make_error_response(status):
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status
    http_err = requests.exceptions.HTTPError(response=resp)
    resp.raise_for_status = MagicMock(side_effect=http_err)
    return resp


def _provider():
    return CodexTextProvider(api_key="test-token", model="gpt-4.1-mini")


# ---------------------------------------------------------------------------
# _post_with_retry
# ---------------------------------------------------------------------------

class TestPostWithRetry:

    def test_success_on_first_try(self):
        ok = _make_ok_response()
        with patch.object(_codex.http_requests, "post", return_value=ok) as mock_post:
            result = _provider()._post_with_retry({"model": "test"})
            assert result is ok
            assert mock_post.call_count == 1

    def test_retries_on_429_then_succeeds(self):
        err = _make_error_response(429)
        ok = _make_ok_response()
        with patch.object(_codex.http_requests, "post", side_effect=[err, err, ok]) as mock_post:
            result = _provider()._post_with_retry({"model": "test"})
            assert result is ok
            assert mock_post.call_count == 3

    def test_retries_on_502_then_succeeds(self):
        err = _make_error_response(502)
        ok = _make_ok_response()
        with patch.object(_codex.http_requests, "post", side_effect=[err, ok]) as mock_post:
            result = _provider()._post_with_retry({"model": "test"})
            assert result is ok
            assert mock_post.call_count == 2

    def test_raises_immediately_on_401(self):
        err = _make_error_response(401)
        with patch.object(_codex.http_requests, "post", return_value=err) as mock_post:
            with pytest.raises(requests.exceptions.HTTPError):
                _provider()._post_with_retry({"model": "test"})
            assert mock_post.call_count == 1

    def test_raises_immediately_on_400(self):
        err = _make_error_response(400)
        with patch.object(_codex.http_requests, "post", return_value=err) as mock_post:
            with pytest.raises(requests.exceptions.HTTPError):
                _provider()._post_with_retry({"model": "test"})
            assert mock_post.call_count == 1

    def test_exhausts_retries_on_persistent_429(self):
        err = _make_error_response(429)
        with patch.object(_codex.http_requests, "post", return_value=err) as mock_post:
            with pytest.raises(requests.exceptions.HTTPError):
                _provider()._post_with_retry({"model": "test"})
            assert mock_post.call_count == 5


# ---------------------------------------------------------------------------
# generate_text / generate_text_stream use _post_with_retry
# ---------------------------------------------------------------------------

class TestGenerateTextRetry:

    @patch.object(CodexTextProvider, "_post_with_retry")
    def test_generate_text_delegates_to_post_with_retry(self, mock_post):
        resp = MagicMock()
        resp.iter_lines.return_value = [
            b'data: {"type":"response.output_text.delta","delta":"hello"}',
            b'data: [DONE]',
        ]
        mock_post.return_value = resp
        result = _provider().generate_text("prompt")
        assert result == "hello"
        mock_post.assert_called_once()

    @patch.object(CodexTextProvider, "_post_with_retry")
    def test_generate_text_stream_delegates_to_post_with_retry(self, mock_post):
        resp = MagicMock()
        resp.iter_lines.return_value = [
            b'data: {"type":"response.output_text.delta","delta":"chunk1"}',
            b'data: {"type":"response.output_text.delta","delta":"chunk2"}',
            b'data: [DONE]',
        ]
        mock_post.return_value = resp
        chunks = list(_provider().generate_text_stream("prompt"))
        assert chunks == ["chunk1", "chunk2"]
        mock_post.assert_called_once()

    @patch.object(CodexTextProvider, "_post_with_retry")
    def test_generate_with_image_delegates_to_post_with_retry(self, mock_post, tmp_path):
        img_file = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (10, 10)).save(str(img_file))

        resp = MagicMock()
        resp.iter_lines.return_value = [
            b'data: {"type":"response.output_text.delta","delta":"described"}',
            b'data: [DONE]',
        ]
        mock_post.return_value = resp
        result = _provider().generate_with_image("describe", str(img_file))
        assert result == "described"
        mock_post.assert_called_once()
