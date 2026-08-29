"""Tests for APIMart's OpenAI-compatible provider behavior."""

import base64
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from services.ai_providers.image.openai_provider import OpenAIImageProvider
from services.ai_providers.image.anthropic_provider import AnthropicImageProvider
from services.ai_providers.text.openai_provider import OpenAITextProvider


def _png_data_url(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def _chat_response(content: str, image_url: str = None):
    message_content = [{"type": "image_url", "image_url": {"url": image_url}}] if image_url else content
    message = SimpleNamespace(content=message_content)
    return SimpleNamespace(choices=[SimpleNamespace(message=message)])


def _raw_response(payload):
    raw = MagicMock()
    raw.json.return_value = payload
    return raw


def _legacy_raw_response(payload):
    http_response = MagicMock()
    http_response.json.return_value = payload
    return SimpleNamespace(http_response=http_response)


def _image_provider(client=None, model: str = "gpt-image-2"):
    with patch("services.ai_providers.image.openai_provider.OpenAI"):
        provider = OpenAIImageProvider(
            api_key="apimart-secret",
            api_base="https://api.apimart.ai/v1/",
            model=model,
            image_api_protocol="images",
        )
    if client is not None:
        provider.client = client
    return provider


def test_openai_text_generation_explicitly_requests_non_stream():
    client = MagicMock()
    client.chat.completions.create.return_value = _chat_response("ok")
    provider = OpenAITextProvider.__new__(OpenAITextProvider)
    provider.client = client
    provider.model = "gpt-5.6-sol"

    assert provider.generate_text("hello") == "ok"
    assert client.chat.completions.create.call_args.kwargs["stream"] is False


def test_openai_text_with_image_explicitly_requests_non_stream(tmp_path):
    image_path = tmp_path / "input.png"
    Image.new("RGB", (8, 8), color="red").save(image_path)
    client = MagicMock()
    client.chat.completions.create.return_value = _chat_response("a red square")
    provider = OpenAITextProvider.__new__(OpenAITextProvider)
    provider.client = client
    provider.model = "gpt-5.6-luna"

    assert provider.generate_with_image("describe", str(image_path)) == "a red square"
    assert client.chat.completions.create.call_args.kwargs["stream"] is False


def test_openai_image_chat_path_explicitly_requests_non_stream():
    client = MagicMock()
    client.chat.completions.create.return_value = _chat_response(
        "", image_url=_png_data_url(Image.new("RGB", (8, 8), color="blue"))
    )
    provider = _image_provider(client, model="gemini-3-pro-image-preview")
    provider.image_api_protocol = "chat"

    result = provider.generate_image("hello")

    assert isinstance(result, Image.Image)
    assert client.chat.completions.create.call_args.kwargs["stream"] is False


def test_anthropic_chat_path_explicitly_requests_non_stream():
    client = MagicMock()
    client.chat.completions.create.return_value = _chat_response(
        "", image_url=_png_data_url(Image.new("RGB", (8, 8), color="green"))
    )
    provider = AnthropicImageProvider.__new__(AnthropicImageProvider)
    provider.api_key = "apimart-secret"
    provider.api_base = "https://api.apimart.ai/v1"
    provider.model = "gpt-5.6-sol"
    provider.timeout = 30
    provider.max_retries = 1

    with patch("openai.OpenAI", return_value=client):
        result = provider._try_openai_compatible_format(
            content=[{"type": "text", "text": "hello"}],
            prompt="hello",
            aspect_ratio="16:9",
            resolution="2K",
            ref_images=None,
        )

    assert isinstance(result, Image.Image)
    assert client.chat.completions.create.call_args.kwargs["stream"] is False


def test_material_caption_endpoint_explicitly_requests_non_stream(tmp_path):
    from flask import Flask
    from controllers.material_controller import _generate_image_caption

    image_path = tmp_path / "input.png"
    Image.new("RGB", (8, 8), color="white").save(image_path)
    client = MagicMock()
    client.chat.completions.create.return_value = _chat_response("desc")
    app = Flask(__name__)
    app.config.update(
        OUTPUT_LANGUAGE="zh",
        AI_PROVIDER_FORMAT="openai",
        OPENAI_API_KEY="apimart-secret",
        OPENAI_API_BASE="https://api.apimart.ai/v1",
        IMAGE_CAPTION_MODEL="gpt-5.6-luna",
        IMAGE_CAPTION_MODEL_SOURCE="",
    )

    with app.app_context(), patch("openai.OpenAI", return_value=client):
        assert _generate_image_caption(str(image_path)) == "desc"

    assert client.chat.completions.create.call_args.kwargs["stream"] is False


def test_apimart_async_image_generate_polls_until_completed():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_123"}]}
    )
    provider = _image_provider(client)

    processing = MagicMock()
    processing.json.return_value = {"code": 200, "data": {"status": "processing"}}
    completed = MagicMock()
    completed.json.return_value = {
        "code": 200,
        "data": {
            "status": "completed",
            "progress": 100,
            "result": {"images": [{"url": [_png_data_url(Image.new("RGB", (8, 8), color="purple"))]}]},
        },
    }

    with patch("services.ai_providers.image.openai_provider.requests.get", side_effect=[processing, completed]) as get:
        with patch("services.ai_providers.image.openai_provider.time.sleep") as sleep:
            result = provider.generate_image("a cat")

    assert isinstance(result, Image.Image)
    assert client.images.with_raw_response.generate.call_args.kwargs["model"] == "gpt-image-2"
    assert get.call_args.args[0] == "https://api.apimart.ai/v1/tasks/task_123"
    assert get.call_args.kwargs["headers"] == {"Authorization": "Bearer apimart-secret"}
    assert get.call_count == 2
    sleep.assert_called_once_with(5.0)


def test_legacy_openai_raw_response_reads_http_response_json():
    provider = _image_provider()
    assert provider._raw_response_payload(_legacy_raw_response({"data": []})) == {"data": []}


def test_apimart_async_image_edit_polls_until_completed():
    client = MagicMock()
    client.images.with_raw_response.edit.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_edit"}]}
    )
    provider = _image_provider(client)
    completed = MagicMock()
    completed.json.return_value = {
        "code": 200,
        "data": {
            "status": "completed",
            "result": {"images": [{"url": [_png_data_url(Image.new("RGB", (8, 8), color="orange"))]}]},
        },
    }

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=completed), patch(
        "services.ai_providers.image.openai_provider.time.sleep"
    ):
        result = provider.generate_image(
            "edit it",
            ref_images=[Image.new("RGB", (8, 8), color="white")],
        )

    assert isinstance(result, Image.Image)
    client.images.with_raw_response.edit.assert_called_once()
    client.images.with_raw_response.generate.assert_not_called()


def test_apimart_async_image_failure_raises_provider_error():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"code": 200, "data": [{"status": "submitted", "task_id": "task_fail"}]}
    )
    provider = _image_provider(client)
    failed = MagicMock()
    failed.json.return_value = {"code": 200, "data": {"status": "failed", "message": "model rejected prompt"}}

    with patch("services.ai_providers.image.openai_provider.requests.get", return_value=failed):
        with pytest.raises(Exception, match="apimart image task failed.*model rejected prompt"):
            provider.generate_image("bad prompt")
