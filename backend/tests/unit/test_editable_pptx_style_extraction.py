from pathlib import Path

from services.export_service import ExportError, ExportService
from services.image_editability.text_attribute_extractors import TextStyleResult


class FailingExtractor:
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        raise RuntimeError("caption_provider 不支持图片输入")

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(confidence=0.0, metadata={"error": "caption_provider 不支持图片输入"})


class EmptyGlobalExtractor:
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        return {}

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(font_color_rgb=(255, 0, 0), confidence=0.9)


class EditableImageStub:
    class BBox:
        def __init__(self):
            self.x0 = 0
            self.y0 = 0
            self.x1 = 100
            self.y1 = 40

    class Element:
        def __init__(self, image_path: str):
            self.element_type = "text"
            self.element_id = "text_0"
            self.content = "hello"
            self.image_path = image_path
            self.bbox = EditableImageStub.BBox()
            self.bbox_global = self.bbox
            self.children = []

    def __init__(self, image_path: str):
        self.image_path = image_path
        self.elements = [EditableImageStub.Element(image_path)]


def _make_editable_images(tmp_path):
    image_path = Path(tmp_path) / "text.png"
    image_path.write_bytes(b"png")
    return [EditableImageStub(str(image_path))]


def test_hybrid_style_extraction_fails_fast_when_provider_has_no_image_input(tmp_path):
    editable_images = _make_editable_images(tmp_path)

    try:
        ExportService._batch_extract_text_styles_hybrid(
            editable_images=editable_images,
            text_attribute_extractor=FailingExtractor(),
            max_workers=2,
            fail_fast=True,
        )
        assert False, "expected ExportError"
    except ExportError as exc:
        assert exc.error_type == "style_extraction"
        assert "不支持图片输入" in exc.message
        assert "image caption" in exc.help_text


def test_hybrid_style_extraction_reports_missing_global_results_when_not_fail_fast(tmp_path):
    editable_images = _make_editable_images(tmp_path)

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=EmptyGlobalExtractor(),
        max_workers=2,
        fail_fast=False,
    )

    assert "text_0" in results
    assert failures == [("text_0", "全局识别未返回完整结果")]
