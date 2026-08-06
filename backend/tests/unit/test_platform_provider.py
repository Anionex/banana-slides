import io

import pytest
from PIL import Image

from services.ai_providers.platform_provider import (
    KcdPlatformImageProvider,
    KcdPlatformTextProvider,
    PlatformExecution,
    PlatformInvocationClient,
    PlatformInvocationError,
)


def execution():
    return PlatformExecution.from_request(
        {
            "provider": "KCD_PLATFORM",
            "project_id": 7,
            "job_id": 9,
            "idempotency_key": "ppt:7:9",
            "gateway_base_url": "http://backend:8080",
            "execution_token": "short-lived-task-token",
        }
    )


def test_execution_context_redacts_token_and_rejects_provider_keys():
    context = execution()

    assert context.redacted()["execution_token"] == "***"
    assert not hasattr(context, "api_key")
    with pytest.raises(ValueError):
        PlatformExecution.from_request(
            {
                "provider": "OPENAI",
                "project_id": 7,
                "job_id": 9,
                "idempotency_key": "ppt:7:9",
                "gateway_base_url": "http://backend:8080",
                "execution_token": "token",
            }
        )


def test_client_polls_until_platform_succeeded(monkeypatch):
    context = execution()
    client = PlatformInvocationClient(context)
    responses = iter(
        [
            {"data": {"invocationId": 12, "status": "RUNNING"}},
            {"data": {"invocationId": 12, "status": "SUCCEEDED", "result": {"text": "完成"}}},
        ]
    )
    captured = []

    def fake_request(method, url, **kwargs):
        captured.append((method, url, kwargs))
        payload = next(responses)
        return type(
            "Response",
            (),
            {
                "status_code": 200,
                "json": lambda self: payload,
            },
        )()

    monkeypatch.setattr("services.ai_providers.platform_provider.requests.request", fake_request)
    monkeypatch.setattr("services.ai_providers.platform_provider.time.sleep", lambda _: None)

    assert client.invoke("TEXT_GENERATION", {"messages": []}) == {"text": "完成"}
    assert captured[0][2]["headers"]["Authorization"] == "Bearer short-lived-task-token"
    assert "short-lived-task-token" not in str(captured[0][2]["json"])


def test_client_returns_standardized_failure_without_echoing_token(monkeypatch):
    client = PlatformInvocationClient(execution())

    def fake_request(method, url, **kwargs):
        return type(
            "Response",
            (),
            {
                "status_code": 200,
                "json": lambda self: {
                    "data": {
                        "invocationId": 12,
                        "status": "FAILED",
                        "errorCode": "MODEL_RATE_LIMITED",
                        "errorMessage": "请稍后重试",
                    }
                },
            },
        )()

    monkeypatch.setattr("services.ai_providers.platform_provider.requests.request", fake_request)

    with pytest.raises(PlatformInvocationError, match="MODEL_RATE_LIMITED") as raised:
        client.invoke("IMAGE_GENERATION", {"prompt": "test"})
    assert "short-lived-task-token" not in str(raised.value)


def test_invocation_key_is_stable_across_clients_and_payload_order():
    first = PlatformInvocationClient(execution())
    second = PlatformInvocationClient(execution())

    first_key = first._next_key("TEXT_GENERATION", {"b": 2, "a": 1})
    second_key = second._next_key("TEXT_GENERATION", {"a": 1, "b": 2})

    assert first_key == second_key
    assert "short-lived-task-token" not in first_key


def test_text_provider_uses_platform_prompt_contract():
    class FakeClient:
        def invoke(self, capability, payload):
            assert capability == "TEXT_GENERATION"
            assert payload == {"prompt": "build an outline"}
            return {"text": "outline"}

    assert KcdPlatformTextProvider(FakeClient()).generate_text("build an outline") == "outline"


def test_text_provider_sends_contact_sheet_through_vision_capability(tmp_path):
    image_path = tmp_path / "contact-sheet.png"
    Image.new("RGB", (4, 4), "cyan").save(image_path)

    class FakeClient:
        def invoke(self, capability, payload):
            assert capability == "VISION_ANALYSIS"
            assert payload["prompt"] == "review deck"
            assert payload["referenceImages"][0].startswith("data:image/")
            assert ";base64," in payload["referenceImages"][0]
            return {"text": '{"outlierPages":[]}'}

    result = KcdPlatformTextProvider(FakeClient()).generate_with_image(
        "review deck", str(image_path))

    assert result == '{"outlierPages":[]}'


def test_image_provider_accepts_platform_image_result(monkeypatch):
    image = Image.new("RGB", (4, 4), "cyan")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image.close()

    class FakeClient:
        execution = execution()

        def invoke(self, capability, payload):
            assert capability == "IMAGE_GENERATION"
            assert payload["_pptOperation"] == "consistency-repair"
            return {"images": [{"url": "https://assets.example/generated.png"}]}

    class FakeResponse:
        content = buffer.getvalue()

        def raise_for_status(self):
            return None

    monkeypatch.setattr(
        "services.ai_providers.platform_provider.requests.get",
        lambda *args, **kwargs: FakeResponse(),
    )

    generated = KcdPlatformImageProvider(FakeClient()).generate_image(
        "test", invocation_operation="consistency-repair")
    assert generated.size == (4, 4)
    generated.close()
