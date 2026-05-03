"""
单元测试：图标主体提取（is_icon_element 启发式 + Baidu segmentation provider mock）
"""
import base64
import io
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image

from services.image_editability.data_models import BBox, EditableElement
from services.image_editability.helpers import is_icon_element
from services.ai_providers.image.baidu_segmentation_provider import (
    BaiduSegmentationProvider,
    create_baidu_segmentation_provider,
)


def _make_element(element_type: str, x0: float, y0: float, x1: float, y1: float) -> EditableElement:
    bbox = BBox(x0=x0, y0=y0, x1=x1, y1=y1)
    return EditableElement(
        element_id="e1",
        element_type=element_type,
        bbox=bbox,
        bbox_global=bbox,
    )


class TestIsIconElement:
    """is_icon_element 启发式边界测试"""

    PARENT = (1920, 1080)  # 16:9 PPT 尺寸

    def test_typical_icon_passes(self):
        # 80x80 图标，完全合规
        elem = _make_element("image", 100, 100, 180, 180)
        assert is_icon_element(elem, self.PARENT) is True

    def test_figure_type_also_treated_as_icon_candidate(self):
        elem = _make_element("figure", 100, 100, 180, 180)
        assert is_icon_element(elem, self.PARENT) is True

    def test_text_type_rejected(self):
        elem = _make_element("text", 100, 100, 180, 180)
        assert is_icon_element(elem, self.PARENT) is False

    def test_table_type_rejected(self):
        elem = _make_element("table", 100, 100, 180, 180)
        assert is_icon_element(elem, self.PARENT) is False

    def test_short_edge_at_threshold_rejected(self):
        # 短边 = 200，应被拒（严格小于）
        elem = _make_element("image", 0, 0, 250, 200)
        assert is_icon_element(elem, self.PARENT) is False

    def test_short_edge_just_below_threshold_passes(self):
        elem = _make_element("image", 0, 0, 199, 199)
        assert is_icon_element(elem, self.PARENT) is True

    def test_large_image_rejected_by_area_ratio(self):
        # 800x400 = 320000，占 1920x1080=2073600 的 ~15%
        elem = _make_element("image", 0, 0, 800, 400)
        assert is_icon_element(elem, self.PARENT) is False

    def test_long_banner_rejected_by_aspect_ratio(self):
        # 高度小、宽度大；短边 50 < 200，但宽高比 = 8 远超 2.5
        elem = _make_element("image", 0, 0, 400, 50)
        assert is_icon_element(elem, self.PARENT) is False

    def test_tall_skinny_rejected_by_aspect_ratio(self):
        # 宽 30、高 150；短边 30 < 200，宽高比 = 0.2 < 0.4
        elem = _make_element("image", 0, 0, 30, 150)
        assert is_icon_element(elem, self.PARENT) is False

    def test_zero_size_rejected(self):
        elem = _make_element("image", 100, 100, 100, 100)
        assert is_icon_element(elem, self.PARENT) is False

    def test_zero_parent_size_rejected(self):
        elem = _make_element("image", 0, 0, 80, 80)
        assert is_icon_element(elem, (0, 0)) is False


class TestBaiduSegmentationProvider:
    """Baidu segmentation provider mock 测试"""

    def _make_test_image(self, size=(256, 256)) -> Image.Image:
        return Image.new("RGB", size, color=(200, 100, 50))

    def _make_rgba_response_b64(self, size=(256, 256)) -> str:
        rgba = Image.new("RGBA", size, color=(200, 100, 50, 255))
        buf = io.BytesIO()
        rgba.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def test_extract_subject_success_returns_rgba(self):
        provider = BaiduSegmentationProvider(api_key="bce-v3/ALTAK-test/secret")
        mock_response = MagicMock()
        mock_response.json.return_value = {"image": self._make_rgba_response_b64()}
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = provider.extract_subject(self._make_test_image())

        assert result is not None
        assert result.mode == "RGBA"
        # BCEv3 走 Authorization header
        called_kwargs = mock_post.call_args.kwargs
        assert called_kwargs["headers"]["Authorization"] == "Bearer bce-v3/ALTAK-test/secret"
        payload = called_kwargs["data"]
        assert payload["return_form"] == "rgba"
        assert payload["method"] == "auto"

    def test_extract_subject_access_token_uses_query_param(self):
        provider = BaiduSegmentationProvider(api_key="legacy-access-token-xyz")
        mock_response = MagicMock()
        mock_response.json.return_value = {"image": self._make_rgba_response_b64()}
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = provider.extract_subject(self._make_test_image())

        assert result is not None
        url = mock_post.call_args.args[0]
        assert "access_token=legacy-access-token-xyz" in url

    def test_extract_subject_small_image_upscaled_before_api(self):
        # 64x64 短边 < 128px API 下限；新逻辑应放大后调用 API 而不是跳过
        provider = BaiduSegmentationProvider(api_key="test-key")
        mock_response = MagicMock()
        mock_response.json.return_value = {"image": self._make_rgba_response_b64(size=(256, 256))}
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response) as mock_post:
            result = provider.extract_subject(self._make_test_image(size=(64, 64)))

        assert result is not None
        assert result.mode == "RGBA"
        mock_post.assert_called_once()

    def test_extract_subject_api_error_raises(self):
        provider = BaiduSegmentationProvider(api_key="test-key")
        mock_response = MagicMock()
        mock_response.json.return_value = {"error_code": 17, "error_msg": "Open api daily request limit reached"}
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response):
            with pytest.raises(Exception, match="error \\[17\\]"):
                provider.extract_subject(self._make_test_image())

    def test_extract_subject_missing_image_returns_none(self):
        provider = BaiduSegmentationProvider(api_key="test-key")
        mock_response = MagicMock()
        mock_response.json.return_value = {}  # 无 image 字段
        mock_response.raise_for_status.return_value = None

        with patch("requests.post", return_value=mock_response):
            result = provider.extract_subject(self._make_test_image())
        assert result is None

    def test_factory_returns_none_without_api_key(self, monkeypatch):
        # 清空所有可能的 key 来源
        monkeypatch.delenv("BAIDU_API_KEY", raising=False)
        from config import Config
        monkeypatch.setattr(Config, "BAIDU_API_KEY", None, raising=False)

        result = create_baidu_segmentation_provider(api_key=None)
        assert result is None

    def test_factory_uses_explicit_key(self):
        result = create_baidu_segmentation_provider(api_key="bce-v3/ALTAK-explicit/key")
        assert isinstance(result, BaiduSegmentationProvider)
        assert result.api_key == "bce-v3/ALTAK-explicit/key"
