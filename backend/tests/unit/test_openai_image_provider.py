import base64
import importlib.util
import sys
import types as module_types
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

from PIL import Image


def _load_openai_provider_module():
    backend_dir = Path(__file__).resolve().parents[2]
    image_provider_dir = backend_dir / "services" / "ai_providers" / "image"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    if "openai" not in sys.modules:
        try:
            __import__("openai")
        except ImportError:
            fake_openai = module_types.ModuleType("openai")
            fake_openai.OpenAI = object
            sys.modules["openai"] = fake_openai

    package_name = "_openai_image_provider_test_pkg"
    package = module_types.ModuleType(package_name)
    package.__path__ = [str(image_provider_dir)]
    sys.modules[package_name] = package

    base_spec = importlib.util.spec_from_file_location(
        f"{package_name}.base",
        image_provider_dir / "base.py",
    )
    base_module = importlib.util.module_from_spec(base_spec)
    sys.modules[f"{package_name}.base"] = base_module
    base_spec.loader.exec_module(base_module)

    provider_spec = importlib.util.spec_from_file_location(
        f"{package_name}.openai_provider",
        image_provider_dir / "openai_provider.py",
    )
    provider_module = importlib.util.module_from_spec(provider_spec)
    sys.modules[f"{package_name}.openai_provider"] = provider_module
    provider_spec.loader.exec_module(provider_module)
    return provider_module


openai_provider = _load_openai_provider_module()
OpenAIImageProvider = openai_provider.OpenAIImageProvider


def _png_b64(color="red"):
    image = Image.new("RGB", (4, 3), color=color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class _FakeImages:
    def __init__(self):
        self.generate_kwargs = None
        self.edit_kwargs = None
        self.edit_image_names = None

    def generate(self, **kwargs):
        self.generate_kwargs = kwargs
        return SimpleNamespace(data=[SimpleNamespace(b64_json=_png_b64("blue"))])

    def edit(self, **kwargs):
        self.edit_kwargs = kwargs
        image_payload = kwargs.get("image")
        if isinstance(image_payload, list):
            self.edit_image_names = [getattr(item, "name", None) for item in image_payload]
        else:
            self.edit_image_names = [getattr(image_payload, "name", None)]
        return SimpleNamespace(data=[SimpleNamespace(b64_json=_png_b64("green"))])


class _FakeChatCompletions:
    def __init__(self):
        self.create_kwargs = None

    def create(self, **kwargs):
        self.create_kwargs = kwargs
        message = SimpleNamespace(
            multi_mod_content=[
                {"inline_data": {"data": _png_b64("yellow")}},
            ],
            content=None,
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


class _FakeClient:
    def __init__(self):
        self.images = _FakeImages()
        self.chat = SimpleNamespace(completions=_FakeChatCompletions())


def _provider_with_fake_client(monkeypatch, model):
    fake_client = _FakeClient()
    monkeypatch.setattr(openai_provider, "OpenAI", lambda **kwargs: fake_client)
    provider = OpenAIImageProvider(api_key="test-key", api_base="https://api.openai.com/v1", model=model)
    return provider, fake_client


def test_gpt_image_model_uses_images_generate_without_references(monkeypatch):
    provider, fake_client = _provider_with_fake_client(monkeypatch, "gpt-image-2")

    result = provider.generate_image("make a slide background", aspect_ratio="16:9", resolution="2K")

    assert result.size == (4, 3)
    assert fake_client.images.generate_kwargs["model"] == "gpt-image-2"
    assert fake_client.images.generate_kwargs["size"] == "1536x1024"
    assert fake_client.chat.completions.create_kwargs is None


def test_gpt_image_model_uses_images_edit_with_references(monkeypatch):
    provider, fake_client = _provider_with_fake_client(monkeypatch, "gpt-image-2")
    ref_image = Image.new("RGB", (8, 8), color="white")

    result = provider.generate_image(
        "adapt this template into a slide background",
        ref_images=[ref_image],
        aspect_ratio="9:16",
        resolution="2K",
    )

    assert result.size == (4, 3)
    assert fake_client.images.edit_kwargs["model"] == "gpt-image-2"
    assert fake_client.images.edit_kwargs["size"] == "1024x1536"
    assert fake_client.images.edit_image_names == ["reference_0.png"]
    assert fake_client.images.generate_kwargs is None


def test_openai_compatible_non_image_model_keeps_chat_completion_path(monkeypatch):
    provider, fake_client = _provider_with_fake_client(monkeypatch, "gemini-3-pro-image-preview")

    result = provider.generate_image("make a slide background", aspect_ratio="4:3", resolution="2K")

    assert result.size == (4, 3)
    assert fake_client.chat.completions.create_kwargs["model"] == "gemini-3-pro-image-preview"
    assert fake_client.images.generate_kwargs is None
    assert fake_client.images.edit_kwargs is None
