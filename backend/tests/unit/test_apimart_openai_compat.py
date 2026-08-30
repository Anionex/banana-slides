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


def _run_image_service_test(model: str, image_path):
    from flask import Flask
    from controllers.settings_controller import _test_image_model
    from models import Settings

    app = Flask(__name__)
    app.config.update(IMAGE_MODEL=model)
    service = MagicMock()
    service.generate_image.return_value = SimpleNamespace(size=(16, 16))
    settings = SimpleNamespace(image_aspect_ratio="16:9", image_resolution="2K")

    with app.app_context():
        with patch.object(Settings, "get_settings", return_value=settings), patch(
            "controllers.settings_controller.AIService", return_value=service
        ), patch("controllers.settings_controller._get_test_image_path", return_value=image_path):
            _test_image_model()

    return service.generate_image.call_args.kwargs["ref_image_path"]


def test_image_service_avoids_gpt_image_edit_endpoint(tmp_path):
    image_path = tmp_path / "test.png"
    Image.new("RGB", (16, 16), color="white").save(image_path)

    assert _run_image_service_test("gpt-image-2", image_path) is None


def test_image_service_keeps_reference_for_non_gpt_model(tmp_path):
    image_path = tmp_path / "test.png"
    Image.new("RGB", (16, 16), color="white").save(image_path)

    assert _run_image_service_test("gemini-3-pro-image-preview", image_path) == str(image_path)


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
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["model"] == "gpt-image-2"
    assert request["size"] == "16:9"
    assert request["extra_body"] == {"resolution": "2k"}
    assert get.call_args.args[0] == "https://api.apimart.ai/v1/tasks/task_123"
    assert get.call_args.kwargs["headers"] == {"Authorization": "Bearer apimart-secret"}
    assert get.call_count == 2
    sleep.assert_called_once_with(5.0)


def test_non_apimart_images_request_keeps_concrete_size_without_resolution():
    client = MagicMock()
    image_bytes = BytesIO()
    Image.new("RGB", (8, 8), color="white").save(image_bytes, format="PNG")
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"b64_json": base64.b64encode(image_bytes.getvalue()).decode()}]}
    )
    with patch("services.ai_providers.image.openai_provider.OpenAI"):
        provider = OpenAIImageProvider(
            api_key="test",
            api_base="https://other.example/v1",
            model="gpt-image-2",
            image_api_protocol="images",
        )
    provider.client = client

    result = provider.generate_image(
        prompt="a cat",
        aspect_ratio="16:9",
        resolution="2K",
    )

    assert isinstance(result, Image.Image)
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["size"] == "2048x1152"
    assert "extra_body" not in request


@pytest.mark.parametrize(
    ("resolution", "expected_tier"),
    [("1K", "1k"), ("2K", "2k"), ("4K", "4k")],
)
def test_apimart_image_request_maps_resolution_tier(resolution, expected_tier):
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"url": _png_data_url(Image.new("RGB", (8, 8), color="purple"))}]}
    )
    provider = _image_provider(client)

    result = provider.generate_image(
        "a cat",
        aspect_ratio="16:9",
        resolution=resolution,
    )

    assert isinstance(result, Image.Image)
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["size"] == "16:9"
    assert request["extra_body"] == {"resolution": expected_tier}
    assert "quality" not in request


def test_legacy_openai_raw_response_reads_http_response_json():
    provider = _image_provider()
    assert provider._raw_response_payload(_legacy_raw_response({"data": []})) == {"data": []}


def test_apimart_async_image_generate_with_references_polls_until_completed():
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
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
            aspect_ratio="4:3",
            resolution="4K",
        )

    assert isinstance(result, Image.Image)
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["size"] == "4:3"
    assert request["extra_body"]["resolution"] == "4k"
    assert len(request["extra_body"]["image_urls"]) == 1
    assert request["extra_body"]["image_urls"][0].startswith("data:image/jpeg;base64,")
    client.images.with_raw_response.edit.assert_not_called()


@pytest.mark.parametrize(
    ("model", "expected_size"),
    [("dall-e-2", "1024x1024"), ("dall-e-3", "1792x1024")],
)
def test_apimart_dalle_keeps_concrete_model_size(model, expected_size):
    client = MagicMock()
    client.images.with_raw_response.generate.return_value = _raw_response(
        {"data": [{"url": _png_data_url(Image.new("RGB", (8, 8), color="green"))}]}
    )
    provider = _image_provider(client, model=model)

    result = provider.generate_image(
        "a cat",
        aspect_ratio="16:9",
        resolution="2K",
    )

    assert isinstance(result, Image.Image)
    request = client.images.with_raw_response.generate.call_args.kwargs
    assert request["size"] == expected_size
    assert "extra_body" not in request
    assert "resolution" not in request


def test_apimart_image_limit_rejected_before_request():
    client = MagicMock()
    provider = _image_provider(client)

    with pytest.raises(ValueError, match="supports at most 16 reference images, got 17"):
        provider.generate_image(
            "edit it",
            ref_images=[Image.new("RGB", (8, 8), color="white") for _ in range(17)],
        )

    client.images.with_raw_response.generate.assert_not_called()
    client.images.with_raw_response.edit.assert_not_called()
    client.chat.completions.create.assert_not_called()


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
