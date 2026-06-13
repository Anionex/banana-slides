"""
Unit tests for FileParserService provider-specific behavior.
"""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests
from PIL import Image

from services.file_parser_service import (
    FileParserService,
    MINERU_AUTH_ERROR_MESSAGE,
    _extract_response_error_text,
    _looks_like_mineru_auth_error,
)


def _create_temp_image() -> str:
    with tempfile.NamedTemporaryFile(prefix='caption_test_', suffix='.png', delete=False) as tmp:
        Image.new('RGB', (20, 20), color='green').save(tmp.name)
        return tmp.name


def test_generate_single_caption_uses_provider_factory():
    """Caption generation should delegate to the provider factory's generate_with_image."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gpt-4.1-mini',
            provider_format='openai',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '示例描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '示例描述'
        mock_provider.generate_with_image.assert_called_once()
        call_args = mock_provider.generate_with_image.call_args
        assert '描述' in call_args[0][0]
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)


def test_can_generate_captions_returns_false_when_factory_fails():
    """_can_generate_captions should return False when the provider factory raises."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='lazyllm',
    )
    with patch(
        'services.file_parser_service.FileParserService._get_caption_provider',
        side_effect=ValueError("no key"),
    ):
        assert service._can_generate_captions() is False


def test_can_generate_captions_returns_true_when_factory_succeeds():
    """_can_generate_captions should return True when the provider factory returns a provider."""
    service = FileParserService(
        mineru_token='test-token',
        provider_format='openai',
    )
    mock_provider = MagicMock()
    with patch.object(service, '_get_caption_provider', return_value=mock_provider):
        assert service._can_generate_captions() is True


def test_get_upload_url_maps_http_auth_failure_to_actionable_message():
    """Expired/invalid MinerU credentials should not surface as a generic network error."""
    service = FileParserService(mineru_token='expired-token')
    response = MagicMock()
    response.status_code = 401
    response.json.return_value = {'msg': 'token expired'}
    http_error = requests.exceptions.HTTPError("401 Client Error: Unauthorized")
    http_error.response = response
    response.raise_for_status.side_effect = http_error

    with patch('services.file_parser_service.requests.post', return_value=response):
        batch_id, upload_url, error = service._get_upload_url('demo.pdf')

    assert batch_id is None
    assert upload_url is None
    assert MINERU_AUTH_ERROR_MESSAGE in error
    assert "token expired" in error


def test_get_upload_url_keeps_network_error_without_response_generic():
    """Network-level exceptions should not be misclassified by keyword matching alone."""
    service = FileParserService(mineru_token='test-token')
    network_error = requests.exceptions.ConnectionError(
        "auth-proxy.example connection failed"
    )

    with patch('services.file_parser_service.requests.post', side_effect=network_error):
        batch_id, upload_url, error = service._get_upload_url('demo.pdf')

    assert batch_id is None
    assert upload_url is None
    assert error.startswith("Network error while requesting upload URL:")
    assert MINERU_AUTH_ERROR_MESSAGE not in error


def test_get_upload_url_maps_mineru_business_auth_failure_to_actionable_message():
    """MinerU may report credential failures with HTTP 200 and a non-zero code."""
    service = FileParserService(mineru_token='expired-token')
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {'code': 10001, 'msg': 'invalid token'}

    with patch('services.file_parser_service.requests.post', return_value=response):
        batch_id, upload_url, error = service._get_upload_url('demo.pdf')

    assert batch_id is None
    assert upload_url is None
    assert MINERU_AUTH_ERROR_MESSAGE in error
    assert "invalid token" in error


def test_get_upload_url_keeps_non_auth_business_error_shape():
    """Non-auth MinerU errors should keep the existing parse error wording."""
    service = FileParserService(mineru_token='test-token')
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {'code': 10002, 'msg': 'file count exceeds limit'}

    with patch('services.file_parser_service.requests.post', return_value=response):
        batch_id, upload_url, error = service._get_upload_url('demo.pdf')

    assert batch_id is None
    assert upload_url is None
    assert error == "Failed to get upload URL: file count exceeds limit"


def test_extract_response_error_text_handles_response_without_json_method():
    """Error extraction should not crash if a response-like object lacks json()."""
    response = MagicMock()
    del response.json
    response.status_code = 401
    response.text = 12345

    assert _extract_response_error_text(response) == "HTTP 401 12345"


def test_extract_response_error_text_handles_non_callable_json_attribute():
    """Error extraction should fall back to text if response.json is not callable."""
    response = MagicMock()
    response.json = None
    response.status_code = 403
    response.text = "forbidden"

    assert _extract_response_error_text(response) == "HTTP 403 forbidden"


def test_extract_response_error_text_handles_text_attribute_failure():
    """Fallback extraction should not raise if response.text itself is broken."""
    class BrokenTextResponse:
        status_code = 500

        def json(self):
            raise ValueError("not json")

        @property
        def text(self):
            raise UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid")

    assert _extract_response_error_text(BrokenTextResponse()) == "HTTP 500"


def test_extract_response_error_text_truncates_large_text_fallback():
    """Large HTML fallback bodies should not leak wholesale into user-facing errors."""
    response = MagicMock()
    response.status_code = 502
    response.text = "x" * 600
    response.json.side_effect = ValueError("not json")

    assert _extract_response_error_text(response) == f"HTTP 502 {'x' * 500}..."


def test_extract_response_error_text_reads_list_detail_messages():
    """List-style detail payloads should contribute useful nested messages."""
    response = MagicMock()
    response.status_code = 400
    response.json.return_value = {
        "detail": [
            {"msg": "token expired"},
            {"message": "auth failed"},
        ]
    }

    assert _extract_response_error_text(response) == "HTTP 400 token expired auth failed"


def test_looks_like_mineru_auth_error_handles_non_string_text():
    """MinerU error detection should tolerate non-string response messages."""
    assert _looks_like_mineru_auth_error(["invalid token"]) is True


def test_looks_like_mineru_auth_error_detects_auth_failed_text():
    """Common MinerU auth failure wording should map to the actionable credential error."""
    assert _looks_like_mineru_auth_error("auth failed") is True


def test_looks_like_mineru_auth_error_uses_word_boundaries():
    """Substring matches such as 'tokenize' should not be treated as a token auth error."""
    assert _looks_like_mineru_auth_error("text tokenization service failed") is False
    assert _looks_like_mineru_auth_error("authentic tokenization failed") is False


def test_poll_result_maps_http_auth_failure_without_retrying():
    """Polling should fail immediately with a specific MinerU credential message."""
    service = FileParserService(mineru_token='expired-token')
    response = MagicMock()
    response.status_code = 403
    response.json.return_value = {'message': 'forbidden: token invalid'}
    http_error = requests.exceptions.HTTPError("403 Client Error: Forbidden")
    http_error.response = response
    response.raise_for_status.side_effect = http_error

    with patch('services.file_parser_service.requests.get', return_value=response):
        markdown, extract_id, error = service._poll_result('batch-1', max_wait_time=10)

    assert markdown is None
    assert extract_id is None
    assert MINERU_AUTH_ERROR_MESSAGE in error
    assert "token invalid" in error


def test_poll_result_keeps_network_error_without_response_retrying():
    """Polling should retry pure network errors instead of surfacing auth text."""
    service = FileParserService(mineru_token='test-token')
    network_error = requests.exceptions.ConnectionError(
        "auth gateway failed"
    )
    done_response = MagicMock()
    done_response.json.return_value = {
        "code": 0,
        "data": {
            "extract_result": [
                {
                    "state": "done",
                    "full_zip_url": "https://example.com/result.zip",
                }
            ]
        },
    }

    with (
        patch('services.file_parser_service.requests.get', side_effect=[network_error, done_response]) as mock_get,
        patch.object(service, '_download_markdown', return_value=("markdown", "extract-1", None)),
        patch('services.file_parser_service.time.sleep'),
    ):
        markdown, extract_id, error = service._poll_result('batch-1', max_wait_time=10)

    assert mock_get.call_count == 2
    assert markdown == "markdown"
    assert extract_id == "extract-1"
    assert error is None


def test_generate_single_caption_vertex_uses_provider_factory():
    """Vertex provider should also go through the factory (the original bug)."""
    image_path = _create_temp_image()
    try:
        service = FileParserService(
            mineru_token='test-token',
            image_caption_model='gemini-2.0-flash',
            provider_format='vertex',
        )

        mock_provider = MagicMock()
        mock_provider.generate_with_image.return_value = '顶点描述'

        with patch('utils.path_utils.find_mineru_file_with_prefix', return_value=Path(image_path)):
            with patch.object(service, '_get_caption_provider', return_value=mock_provider):
                caption = service._generate_single_caption('/files/mineru/demo.png')

        assert caption == '顶点描述'
        mock_provider.generate_with_image.assert_called_once()
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
