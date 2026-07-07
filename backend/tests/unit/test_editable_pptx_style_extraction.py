from pathlib import Path

from PIL import Image

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


def _make_real_slide_image(tmp_path):
    image_path = Path(tmp_path) / "slide.png"
    Image.new("RGB", (320, 180), color=(255, 255, 255)).save(image_path)
    return str(image_path)


def test_editable_export_fails_fast_on_layout_analysis_error(monkeypatch, tmp_path):
    import services.image_editability as image_editability

    class FailingImageEditabilityService:
        def __init__(self, config):
            pass

        def make_image_editable(self, image_path):
            raise RuntimeError("版面分析失败: MinerU结果目录不存在: C:\\uploads\\mineru_files\\abc")

    monkeypatch.setattr(image_editability.ServiceConfig, "from_defaults", staticmethod(lambda **kwargs: object()))
    monkeypatch.setattr(image_editability, "ImageEditabilityService", FailingImageEditabilityService)

    image_path = _make_real_slide_image(tmp_path)

    try:
        ExportService.create_editable_pptx_with_recursive_analysis(
            image_paths=[image_path],
            output_file=str(Path(tmp_path) / "should-not-exist.pptx"),
            slide_width_pixels=320,
            slide_height_pixels=180,
            text_attribute_extractor=None,
            fail_fast=True,
        )
        assert False, "expected ExportError"
    except ExportError as exc:
        assert exc.error_type == "layout_analysis"
        assert "第 1 页" in exc.message
        assert "MinerU结果目录不存在" in exc.message
        assert "返回半成品" in exc.help_text


def test_editable_export_uses_original_image_when_layout_analysis_fails_with_partial_enabled(monkeypatch, tmp_path):
    import services.image_editability as image_editability

    class FailingImageEditabilityService:
        def __init__(self, config):
            pass

        def make_image_editable(self, image_path):
            raise RuntimeError("版面分析失败: MinerU结果目录不存在: /uploads/mineru_files/abc")

    monkeypatch.setattr(image_editability.ServiceConfig, "from_defaults", staticmethod(lambda **kwargs: object()))
    monkeypatch.setattr(image_editability, "ImageEditabilityService", FailingImageEditabilityService)

    image_path = _make_real_slide_image(tmp_path)
    output_path = Path(tmp_path) / "partial.pptx"

    _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
        image_paths=[image_path],
        output_file=str(output_path),
        slide_width_pixels=320,
        slide_height_pixels=180,
        text_attribute_extractor=None,
        fail_fast=False,
    )

    assert output_path.exists()
    assert output_path.stat().st_size > 0
    assert warnings.has_warnings()
    assert "第 1 页版面分析失败" in warnings.other_warnings[0]


def test_editable_export_partial_fallback_uses_slide_size_when_image_cannot_be_opened(monkeypatch, tmp_path):
    import services.image_editability as image_editability

    class FailingImageEditabilityService:
        def __init__(self, config):
            pass

        def make_image_editable(self, image_path):
            raise RuntimeError("版面分析失败: MinerU结果目录不存在: /uploads/mineru_files/abc")

    monkeypatch.setattr(image_editability.ServiceConfig, "from_defaults", staticmethod(lambda **kwargs: object()))
    monkeypatch.setattr(image_editability, "ImageEditabilityService", FailingImageEditabilityService)

    image_path = Path(tmp_path) / "corrupt.png"
    image_path.write_bytes(b"not an image")
    output_path = Path(tmp_path) / "partial-corrupt.pptx"

    _, warnings = ExportService.create_editable_pptx_with_recursive_analysis(
        image_paths=[str(image_path)],
        output_file=str(output_path),
        slide_width_pixels=320,
        slide_height_pixels=180,
        text_attribute_extractor=None,
        fail_fast=False,
    )

    assert output_path.exists()
    assert warnings.has_warnings()
    assert "第 1 页版面分析失败" in warnings.other_warnings[0]
