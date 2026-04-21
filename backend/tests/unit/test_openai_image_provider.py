import base64
import importlib.util
import io
import sys
import types
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from PIL import Image


def _png_b64() -> str:
    img = Image.new("RGB", (64, 48), color="green")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _load_provider_module():
    # Stub config module used by the provider
    config_mod = types.ModuleType("config")
    config_mod.get_config = lambda: SimpleNamespace(
        OPENAI_TIMEOUT=30, OPENAI_MAX_RETRIES=1
    )
    sys.modules["config"] = config_mod

    # Provide package placeholders for relative imports
    services_pkg = sys.modules.setdefault("services", types.ModuleType("services"))
    ai_pkg = sys.modules.setdefault(
        "services.ai_providers", types.ModuleType("services.ai_providers")
    )
    image_pkg = sys.modules.setdefault(
        "services.ai_providers.image", types.ModuleType("services.ai_providers.image")
    )
    services_pkg.ai_providers = ai_pkg
    ai_pkg.image = image_pkg

    # Load base module first so relative import works
    base_path = (
        Path(__file__).resolve().parents[2]
        / "services"
        / "ai_providers"
        / "image"
        / "base.py"
    )
    base_spec = importlib.util.spec_from_file_location(
        "services.ai_providers.image.base", base_path
    )
    base_module = importlib.util.module_from_spec(base_spec)
    sys.modules["services.ai_providers.image.base"] = base_module
    assert base_spec.loader is not None
    base_spec.loader.exec_module(base_module)

    module_path = (
        Path(__file__).resolve().parents[2]
        / "services"
        / "ai_providers"
        / "image"
        / "openai_provider.py"
    )
    spec = importlib.util.spec_from_file_location(
        "services.ai_providers.image.openai_provider", module_path
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["services.ai_providers.image.openai_provider"] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_openai_provider_prefers_images_generate_without_refs():
    module = _load_provider_module()
    client = MagicMock()
    client.images.generate.return_value = SimpleNamespace(
        data=[SimpleNamespace(b64_json=_png_b64())]
    )

    with patch.object(module, "OpenAI", return_value=client):
        provider = module.OpenAIImageProvider(
            api_key="test-key", api_base="https://example.com/v1", model="gpt-image-1"
        )
        result = provider.generate_image(prompt="draw a banana")

    assert result is not None
    assert isinstance(result, Image.Image)
    client.images.generate.assert_called_once()
    client.chat.completions.create.assert_not_called()


def test_openai_provider_uses_chat_completions_with_reference_images():
    module = _load_provider_module()
    client = MagicMock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    multi_mod_content=[{"inline_data": {"data": _png_b64()}}]
                )
            )
        ]
    )

    with patch.object(module, "OpenAI", return_value=client):
        provider = module.OpenAIImageProvider(
            api_key="test-key", api_base="https://example.com/v1", model="gpt-image-1"
        )
        ref = Image.new("RGB", (16, 16), color="blue")
        result = provider.generate_image(prompt="draw a banana", ref_images=[ref])

    assert result is not None
    client.chat.completions.create.assert_called_once()
    client.images.generate.assert_not_called()
