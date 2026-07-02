from pathlib import Path

from services.export_service import ExportError, ExportService
from services.image_editability.text_attribute_extractors import TextStyleResult


class FailingExtractor:
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        raise RuntimeError("caption_provider 不支持图片输入")

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(confidence=0.0, metadata={"error": "caption_provider 不支持图片输入"})


class EmptyGlobalExtractor:
    def __init__(self):
        self.calls = 0

    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        return {}

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(font_color_rgb=(255, 0, 0), confidence=0.9)


class FlakyGlobalExtractor:
    def __init__(self):
        self.calls = 0

    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        if self.calls < 3:
            return {}
        return {
            element["element_id"]: TextStyleResult(
                is_bold=True,
                text_alignment="center",
                confidence=0.9,
            )
            for element in text_elements
        }

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(font_color_rgb=(255, 0, 0), confidence=0.9)


class PartialGlobalExtractor:
    def __init__(self):
        self.calls = 0

    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        return {
            "text_0": TextStyleResult(is_bold=True, confidence=0.9),
        }

    def extract(self, image, text_content=None, **kwargs):
        return TextStyleResult(font_color_rgb=(255, 0, 0), confidence=0.9)


class PartialThenFailGlobalExtractor(PartialGlobalExtractor):
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return {
                "text_0": TextStyleResult(is_bold=True, confidence=0.9),
            }
        raise RuntimeError("upstream timeout")


class ComplementaryPartialGlobalExtractor(PartialGlobalExtractor):
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return {
                "text_0": TextStyleResult(is_bold=True, confidence=0.9),
            }
        return {
            "text_1": TextStyleResult(text_alignment="center", confidence=0.9),
        }


class EditableImageStub:
    class BBox:
        def __init__(self):
            self.x0 = 0
            self.y0 = 0
            self.x1 = 100
            self.y1 = 40

    class Element:
        def __init__(self, image_path: str, element_id: str = "text_0", content: str = "hello"):
            self.element_type = "text"
            self.element_id = element_id
            self.content = content
            self.image_path = image_path
            self.bbox = EditableImageStub.BBox()
            self.bbox_global = self.bbox
            self.children = []

    def __init__(self, image_path: str, element_ids=None):
        self.image_path = image_path
        self.elements = [
            EditableImageStub.Element(image_path, element_id, f"hello {element_id}")
            for element_id in (element_ids or ["text_0"])
        ]


def _make_editable_images(tmp_path, element_ids=None):
    image_path = Path(tmp_path) / "text.png"
    image_path.write_bytes(b"png")
    return [EditableImageStub(str(image_path), element_ids)]


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


def test_hybrid_style_extraction_reports_only_missing_global_results(tmp_path):
    editable_images = _make_editable_images(tmp_path, ["text_0", "text_1"])
    extractor = PartialGlobalExtractor()

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=extractor,
        max_workers=2,
        fail_fast=False,
    )

    assert extractor.calls == 3
    assert "text_0" in results
    assert "text_1" in results
    assert failures == [("text_1", "全局识别未返回完整结果")]


def test_hybrid_style_extraction_preserves_best_partial_global_results_after_later_errors(tmp_path):
    editable_images = _make_editable_images(tmp_path, ["text_0", "text_1"])
    extractor = PartialThenFailGlobalExtractor()

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=extractor,
        max_workers=2,
        fail_fast=False,
    )

    assert extractor.calls == 3
    assert results["text_0"].is_bold is True
    assert "text_1" in results
    assert failures == [("text_1", "全局识别未返回完整结果")]


def test_hybrid_style_extraction_merges_partial_global_results_across_retries(tmp_path):
    editable_images = _make_editable_images(tmp_path, ["text_0", "text_1"])
    extractor = ComplementaryPartialGlobalExtractor()

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=extractor,
        max_workers=2,
        fail_fast=True,
    )

    assert extractor.calls == 2
    assert results["text_0"].is_bold is True
    assert results["text_1"].text_alignment == "center"
    assert failures == []


def test_hybrid_style_extraction_retries_missing_global_results_before_success(tmp_path):
    editable_images = _make_editable_images(tmp_path)
    extractor = FlakyGlobalExtractor()

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=extractor,
        max_workers=2,
        fail_fast=True,
    )

    assert extractor.calls == 3
    assert "text_0" in results
    assert results["text_0"].is_bold is True
    assert results["text_0"].text_alignment == "center"
    assert failures == []


def test_hybrid_style_extraction_fails_after_global_result_retries_are_exhausted(tmp_path):
    editable_images = _make_editable_images(tmp_path)
    extractor = EmptyGlobalExtractor()

    try:
        ExportService._batch_extract_text_styles_hybrid(
            editable_images=editable_images,
            text_attribute_extractor=extractor,
            max_workers=2,
            fail_fast=True,
        )
        assert False, "expected ExportError"
    except ExportError as exc:
        assert extractor.calls == 3
        assert exc.error_type == "style_extraction"
        assert "全局识别未返回完整结果" in exc.message
