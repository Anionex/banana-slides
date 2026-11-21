import os

from PIL import Image

from config import get_config
from services.ai_service import AIService


class FakeImageProvider:
    def __init__(self):
        self.ref_images = None

    def generate_image(self, **kwargs):
        self.ref_images = kwargs.get("ref_images")
        return Image.new("RGB", (4, 4), color="blue")


def _save_image(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (4, 4), color="red").save(path)


def test_files_reference_blocks_sibling_prefix_traversal(monkeypatch, tmp_path, caplog):
    upload_dir = tmp_path / "uploads"
    allowed_image = upload_dir / "materials" / "ok.png"
    secret_image = tmp_path / "uploads_secret" / "flag.png"
    _save_image(allowed_image)
    _save_image(secret_image)

    monkeypatch.setattr(get_config(), "UPLOAD_FOLDER", str(upload_dir))
    image_provider = FakeImageProvider()
    service = AIService(
        text_provider=object(),
        image_provider=image_provider,
        caption_provider=object(),
    )

    result = service.generate_image(
        "prompt",
        additional_ref_images=[
            "/files/materials/ok.png",
            "/files/../uploads_secret/flag.png",
        ],
    )

    assert result is not None
    assert image_provider.ref_images is not None
    assert len(image_provider.ref_images) == 1
    assert "Path traversal attempt blocked: /files/../uploads_secret/flag.png" in caplog.text


def test_files_reference_blocks_commonpath_value_error(monkeypatch, tmp_path, caplog):
    upload_dir = tmp_path / "uploads"
    _save_image(upload_dir / "materials" / "ok.png")

    def raise_value_error(_paths):
        raise ValueError("Paths don't have the same drive")

    monkeypatch.setattr(get_config(), "UPLOAD_FOLDER", str(upload_dir))
    monkeypatch.setattr("services.ai_service.os.path.commonpath", raise_value_error)
    image_provider = FakeImageProvider()
    service = AIService(
        text_provider=object(),
        image_provider=image_provider,
        caption_provider=object(),
    )

    result = service.generate_image(
        "prompt",
        additional_ref_images=["/files/materials/ok.png"],
    )

    assert result is not None
    assert image_provider.ref_images is None
    assert "Path traversal attempt blocked: /files/materials/ok.png" in caplog.text


def test_files_reference_blocks_symlink_escape(monkeypatch, tmp_path, caplog):
    upload_dir = tmp_path / "uploads"
    outside_image = tmp_path / "outside" / "flag.png"
    symlink_path = upload_dir / "materials" / "linked.png"
    _save_image(outside_image)
    symlink_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        os.symlink(outside_image, symlink_path)
    except (OSError, NotImplementedError):
        return

    monkeypatch.setattr(get_config(), "UPLOAD_FOLDER", str(upload_dir))
    image_provider = FakeImageProvider()
    service = AIService(
        text_provider=object(),
        image_provider=image_provider,
        caption_provider=object(),
    )

    result = service.generate_image(
        "prompt",
        additional_ref_images=["/files/materials/linked.png"],
    )

    assert result is not None
    assert image_provider.ref_images is None
    assert "Path traversal attempt blocked: /files/materials/linked.png" in caplog.text


def test_files_reference_skips_directories(monkeypatch, tmp_path, caplog):
    upload_dir = tmp_path / "uploads"
    (upload_dir / "materials").mkdir(parents=True)

    monkeypatch.setattr(get_config(), "UPLOAD_FOLDER", str(upload_dir))
    image_provider = FakeImageProvider()
    service = AIService(
        text_provider=object(),
        image_provider=image_provider,
        caption_provider=object(),
    )

    result = service.generate_image(
        "prompt",
        additional_ref_images=["/files/materials/"],
    )

    assert result is not None
    assert image_provider.ref_images is None
    assert "Local file not found or not a file:" in caplog.text
