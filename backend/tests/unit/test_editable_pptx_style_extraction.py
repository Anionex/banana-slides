from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import services.export_service as export_service_module
from services.export_service import ExportError, ExportService
from services.image_editability.extractors import MinerUElementExtractor
from services.image_editability.text_attribute_extractors import TextStyleResult


@pytest.fixture(autouse=True)
def no_retry_delay(monkeypatch):
    monkeypatch.setattr(export_service_module.time, "sleep", lambda _seconds: None)


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


class NullResultGlobalExtractor(EmptyGlobalExtractor):
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        return {"text_0": None}


class NonDictGlobalExtractor(EmptyGlobalExtractor):
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        return []


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


class EmptyThenFailGlobalExtractor(PartialGlobalExtractor):
    def extract_batch_with_full_image(self, full_image, text_elements, **kwargs):
        self.calls += 1
        if self.calls == 1:
            return {}
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
        assert exc.error_code == "EXPORT_STYLE_MODEL_UNSUPPORTED"
        assert exc.details["reason"] == "unsupported_model"
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


def test_hybrid_style_extraction_filters_null_global_results(tmp_path):
    editable_images = _make_editable_images(tmp_path)
    extractor = NullResultGlobalExtractor()

    results, failures = ExportService._batch_extract_text_styles_hybrid(
        editable_images=editable_images,
        text_attribute_extractor=extractor,
        max_workers=2,
        fail_fast=False,
    )

    assert extractor.calls == 3
    assert "text_0" in results
    assert failures == [("text_0", "全局识别未返回完整结果")]


def test_hybrid_style_extraction_retries_non_dict_global_results(tmp_path):
    editable_images = _make_editable_images(tmp_path)
    extractor = NonDictGlobalExtractor()

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
        assert exc.error_code == "EXPORT_STYLE_INVALID_RESPONSE"
        assert "Expected dict or None" in exc.details["technical_message"]


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


def test_hybrid_style_extraction_keeps_last_error_when_no_global_results(tmp_path):
    editable_images = _make_editable_images(tmp_path)
    extractor = EmptyThenFailGlobalExtractor()

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
        assert exc.error_code == "EXPORT_STYLE_TIMEOUT"
        assert exc.details["reason"] == "timeout"
        assert "upstream timeout" in exc.details["technical_message"]


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
        assert exc.error_code == "EXPORT_STYLE_INCOMPLETE_RESPONSE"
        assert "全局识别未返回完整结果" in exc.details["technical_message"]


def test_style_extraction_error_includes_safe_provider_context():
    provider = type(
        "CodexTextProvider",
        (),
        {"model": "gpt-5.4", "request_timeout_seconds": 120, "max_attempts": 5},
    )()
    ai_service = type(
        "AIServiceStub",
        (),
        {"caption_model": "gpt-5.4", "caption_provider": provider},
    )()
    extractor = type("ExtractorStub", (), {"ai_service": ai_service})()

    error = ExportService._build_style_extraction_error(
        "upstream timed out with access_token=secret-value, Authorization: Bearer sk-super-secret-token",
        page_idx=2,
        text_attribute_extractor=extractor,
        operation="global_page_style",
    )

    assert error.error_code == "EXPORT_STYLE_TIMEOUT"
    assert error.stage == "style_extraction"
    assert error.details["page"] == 3
    assert error.details["operation"] == "global_page_style"
    assert error.details["model"] == "gpt-5.4"
    assert error.details["provider"] == "CodexTextProvider"
    assert error.details["request_timeout_seconds"] == 120
    assert error.details["max_attempts"] == 5
    assert "secret-value" not in error.details["technical_message"]
    assert "sk-super-secret-token" not in error.details["technical_message"]
    assert "Bearer ***" not in error.details["technical_message"]


def test_unexpected_export_error_preserves_stage_and_classifies_rate_limit():
    error = ExportService._build_unexpected_export_error(
        "HTTP 429 Too Many Requests",
        "背景修复",
    )

    assert error.error_code == "EXPORT_RATE_LIMIT"
    assert error.error_type == "service"
    assert error.stage == "背景修复"
    assert error.details["reason"] == "rate_limit"
    assert error.details["retryable"] is True


def test_unexpected_export_error_classifies_missing_provider_configuration():
    error = ExportService._build_unexpected_export_error(
        "GOOGLE_API_KEY (from database settings or environment) is required",
        "准备",
    )

    assert error.error_code == "EXPORT_CONFIGURATION_MISSING"
    assert error.error_type == "service"
    assert error.details["reason"] == "configuration_missing"
    assert error.details["retryable"] is False
    assert "image caption provider" in error.help_text


def test_text_render_error_is_structured_and_redacts_credentials():
    error = ExportService._build_text_render_error(
        "font lookup failed with api_key=secret-value",
        text="hello",
        bbox=[1, 2, 3, 4],
        element_kind="文本元素",
    )

    assert error.error_code == "EXPORT_TEXT_RENDER_FAILED"
    assert error.stage == "text_render"
    assert error.details["element_kind"] == "文本元素"
    assert error.details["bbox"] == [1, 2, 3, 4]
    assert error.details["retryable"] is False
    assert "secret-value" not in error.details["technical_message"]


def test_mineru_extractor_finds_results_under_configured_upload_folder(tmp_path):
    """Editable export must look for MinerU artifacts in the desktop UPLOAD_FOLDER root."""
    desktop_uploads = tmp_path / "banana-slides-desktop" / "uploads"
    extract_id = "f58159a1"
    result_dir = desktop_uploads / "mineru_files" / extract_id
    result_dir.mkdir(parents=True)

    image_path = tmp_path / "slide.png"
    image_path.write_bytes(b"fake image")

    parser_service = MagicMock()
    parser_service.parse_file.return_value = (None, "markdown", extract_id, None, 0)
    extractor = MinerUElementExtractor(parser_service, desktop_uploads)

    with patch("services.export_service.ExportService.create_pdf_from_images", return_value=None):
        found_dir, error = extractor._parse_image(str(image_path), depth=0)

    assert error is None
    assert Path(found_dir) == result_dir.resolve()
