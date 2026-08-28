import base64
from io import BytesIO
from unittest.mock import patch

from flask import Flask
from PIL import Image

from services import ai_providers
from services.ai_providers.image.apimart_provider import APIMartImageProvider
from services.ai_providers.text.apimart_provider import APIMartTextProvider


class FakeResponse:
    def __init__(self, payload=None, status_code=200, content=b""):
        self._payload = payload
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.content = content
        self.text = "" if payload is None else str(payload)

    def json(self):
        return self._payload

    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeTextSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class FakeImageSession:
    def __init__(self, task_responses, image_bytes):
        self.task_responses = iter(task_responses)
        self.image_bytes = image_bytes
        self.requests = []
        self.downloads = []

    def request(self, method, url, **kwargs):
        self.requests.append((method, url, kwargs))
        return next(self.task_responses)

    def get(self, url, **kwargs):
        self.downloads.append((url, kwargs))
        return FakeResponse(status_code=200, content=self.image_bytes)


def _png_bytes(color="red"):
    buffer = BytesIO()
    Image.new("RGB", (8, 6), color).save(buffer, format="PNG")
    return buffer.getvalue()


def test_apimart_text_provider_unwraps_chat_completion():
    session = FakeTextSession(FakeResponse({
        "code": 200,
        "data": {
            "choices": [{"message": {"content": "<think>hidden</think>Visible answer"}}],
        },
    }))
    provider = APIMartTextProvider("key", model="gpt-5", session=session)

    assert provider.generate_text("Hello") == "Visible answer"
    url, kwargs = session.calls[0]
    assert url == "https://api.apimart.ai/v1/chat/completions"
    assert kwargs["json"] == {
        "model": "gpt-5",
        "messages": [{"role": "user", "content": "Hello"}],
    }


def test_apimart_text_provider_sends_image_as_data_uri(tmp_path):
    image_path = tmp_path / "reference.png"
    image_path.write_bytes(_png_bytes())
    session = FakeTextSession(FakeResponse({
        "code": 200,
        "data": {"choices": [{"message": {"content": "A red rectangle"}}]},
    }))
    provider = APIMartTextProvider("key", model="gpt-4o", session=session)

    assert provider.generate_with_image("Describe", str(image_path)) == "A red rectangle"
    content = session.calls[0][1]["json"]["messages"][0]["content"]
    assert content[0] == {"type": "text", "text": "Describe"}
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_apimart_text_provider_preserves_jpeg_media_type(tmp_path):
    image_path = tmp_path / "reference.jpg"
    Image.new("RGB", (8, 6), "red").save(image_path, format="JPEG")
    session = FakeTextSession(FakeResponse({
        "code": 200,
        "data": {"choices": [{"message": {"content": "A red rectangle"}}]},
    }))
    provider = APIMartTextProvider("key", model="gpt-4o", session=session)

    provider.generate_with_image("Describe", str(image_path))

    image_url = session.calls[0][1]["json"]["messages"][0]["content"][1]["image_url"]["url"]
    assert image_url.startswith("data:image/jpeg;base64,")


def test_apimart_image_provider_submits_polls_and_downloads():
    image_bytes = _png_bytes("blue")
    session = FakeImageSession([
        FakeResponse({
            "code": 200,
            "data": [{"status": "submitted", "task_id": "task-123"}],
        }),
        FakeResponse({
            "code": 200,
            "data": {"id": "task-123", "status": "processing", "progress": 50},
        }),
        FakeResponse({
            "code": 200,
            "data": {
                "id": "task-123",
                "status": "completed",
                "result": {"images": [{"url": ["https://upload.apimart.ai/result.png"]}]},
            },
        }),
    ], image_bytes)
    provider = APIMartImageProvider("key", model="gpt-image-2", session=session)
    provider.POLL_INTERVAL_SECONDS = 0

    result = provider.generate_image(
        "A blue rectangle",
        ref_images=[Image.new("RGB", (4, 4), "white")],
        aspect_ratio="16:9",
        resolution="2K",
    )

    assert result.size == (8, 6)
    submit = session.requests[0]
    assert submit[0:2] == (
        "POST",
        "https://api.apimart.ai/v1/images/generations",
    )
    payload = submit[2]["json"]
    assert payload["model"] == "gpt-image-2"
    assert payload["size"] == "16:9"
    assert payload["resolution"] == "2k"
    assert len(payload["image_urls"]) == 1
    encoded = payload["image_urls"][0].split(",", 1)[1]
    assert base64.b64decode(encoded).startswith(b"\x89PNG")
    assert session.requests[1][1].endswith("/tasks/task-123")
    assert session.downloads[0][0] == "https://upload.apimart.ai/result.png"


def test_apimart_factory_uses_dedicated_wrapped_response_providers():
    app = Flask(__name__)
    app.config.update(
        AI_PROVIDER_FORMAT="apimart",
        APIMART_API_KEY="apimart-key",
        APIMART_API_BASE="https://api.apimart.ai/v1",
    )

    with app.app_context():
        with patch("services.ai_providers.APIMartTextProvider") as text_cls:
            text_provider = ai_providers.get_text_provider(model="gpt-5")
        with patch("services.ai_providers.APIMartImageProvider") as image_cls:
            image_provider = ai_providers.get_image_provider(model="gpt-image-2")

    assert text_provider == text_cls.return_value
    text_cls.assert_called_once_with(
        api_key="apimart-key",
        api_base="https://api.apimart.ai/v1",
        model="gpt-5",
    )
    assert image_provider == image_cls.return_value
    image_cls.assert_called_once_with(
        api_key="apimart-key",
        api_base="https://api.apimart.ai/v1",
        model="gpt-image-2",
    )
