"""
单元测试：图标主体提取
- should_extract_subject：基于 cv flood-fill 的 icon vs photo 分类器（Optional[bool]）
- RmbgSegmentationProvider：RMBG-2.0 ONNX 本地推理 mock 测试
"""
from pathlib import Path
from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest
from PIL import Image

from services.image_editability.data_models import BBox
from services.image_editability.helpers import should_extract_subject


def _white_page(w: int = 800, h: int = 600) -> np.ndarray:
    return np.full((h, w, 3), 255, dtype=np.uint8)


class TestShouldExtractSubject:
    """should_extract_subject 分类器：True=icon / False=photo / None=不确定"""

    def test_circle_icon_returns_true(self):
        page = _white_page()
        x0, y0, x1, y1 = 200, 200, 400, 400
        cv2.circle(page, ((x0 + x1) // 2, (y0 + y1) // 2), 80, (0, 0, 0), thickness=-1)
        assert should_extract_subject(page, BBox(x0, y0, x1, y1)) is True

    def test_star_icon_returns_true(self):
        page = _white_page()
        x0, y0, x1, y1 = 150, 150, 350, 350
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        pts = []
        for i in range(10):
            angle = -np.pi / 2 + i * np.pi / 5
            r = 80 if i % 2 == 0 else 35
            pts.append([int(cx + r * np.cos(angle)), int(cy + r * np.sin(angle))])
        cv2.fillPoly(page, [np.array(pts, dtype=np.int32)], (50, 50, 200))
        assert should_extract_subject(page, BBox(x0, y0, x1, y1)) is True

    def test_full_photo_filling_roi_returns_none(self):
        # ROI 边缘和环形背景色完全不同（无 seed 匹配）→ 分类器视为"不确定"
        # 策略上等价于 False（都不会送 RMBG）
        page = _white_page()
        x0, y0, x1, y1 = 200, 200, 400, 400
        rng = np.random.default_rng(42)
        page[y0:y1, x0:x1] = rng.integers(20, 80, size=(y1 - y0, x1 - x0, 3), dtype=np.uint8)
        assert should_extract_subject(page, BBox(x0, y0, x1, y1)) is None

    def test_roi_touching_page_edge_returns_none(self):
        page = _white_page(200, 200)
        assert should_extract_subject(page, BBox(0, 0, 200, 200)) is None

    def test_tiny_roi_returns_none(self):
        page = _white_page()
        assert should_extract_subject(page, BBox(10, 10, 16, 16)) is None

    def test_roi_completely_filled_with_bg_color_returns_none(self):
        page = _white_page()
        assert should_extract_subject(page, BBox(100, 100, 300, 300)) is None

    def test_empty_image_returns_none(self):
        assert should_extract_subject(np.zeros((0, 0, 3), dtype=np.uint8), BBox(0, 0, 10, 10)) is None

    def test_rect_subject_with_small_padding_returns_false(self):
        page = _white_page()
        x0, y0, x1, y1 = 200, 200, 400, 400
        page[y0 + 3:y1 - 3, x0 + 3:x1 - 3] = (40, 80, 200)
        assert should_extract_subject(page, BBox(x0, y0, x1, y1)) is False


def _build_mock_session(run_return):
    """构造一个 mock 的 onnxruntime.InferenceSession。"""
    mock_input = MagicMock()
    mock_input.name = "input"
    mock_session = MagicMock()
    mock_session.get_inputs.return_value = [mock_input]
    mock_session.run.return_value = run_return
    return mock_session


def _install_fake_onnxruntime(mock_session):
    """把 sys.modules['onnxruntime'] 替换为可被 `import onnxruntime as ort` 使用的 stub。"""
    fake_ort = MagicMock()
    fake_ort.InferenceSession = MagicMock(return_value=mock_session)
    return patch.dict("sys.modules", {"onnxruntime": fake_ort})


class TestRmbgSegmentationProvider:
    """RmbgSegmentationProvider mock 测试"""

    def _new_provider(self, model_path: Path):
        from services.ai_providers.image.rmbg_segmentation_provider import RmbgSegmentationProvider
        return RmbgSegmentationProvider(model_path=model_path)

    def test_extract_subject_returns_rgba_with_input_size(self, tmp_path):
        model_path = tmp_path / "model.onnx"
        model_path.write_bytes(b"fake-model")
        provider = self._new_provider(model_path)

        mask = np.full((1, 1, 1024, 1024), 1.0, dtype=np.float32)
        mock_session = _build_mock_session([mask])

        with _install_fake_onnxruntime(mock_session):
            src = Image.new("RGB", (300, 200), color=(50, 100, 200))
            result = provider.extract_subject(src)

        assert result is not None
        assert result.mode == "RGBA"
        assert result.size == (300, 200)
        arr = np.array(result)
        assert (arr[..., 3] >= 250).all()

    def test_extract_subject_takes_last_output_when_multi(self, tmp_path):
        model_path = tmp_path / "model.onnx"
        model_path.write_bytes(b"fake-model")
        provider = self._new_provider(model_path)

        # 多尺度输出：第一个低分辨率应被忽略，最后一个是高分辨率
        low_res = np.full((1, 1, 256, 256), 0.0, dtype=np.float32)
        high_res = np.full((1, 1, 1024, 1024), 1.0, dtype=np.float32)
        mock_session = _build_mock_session([low_res, high_res])

        with _install_fake_onnxruntime(mock_session):
            src = Image.new("RGB", (128, 128), color=(0, 0, 0))
            result = provider.extract_subject(src)

        assert result is not None
        arr = np.array(result)
        assert (arr[..., 3] >= 250).all()

    def test_extract_subject_applies_sigmoid_when_out_of_range(self, tmp_path):
        model_path = tmp_path / "model.onnx"
        model_path.write_bytes(b"fake-model")
        provider = self._new_provider(model_path)

        # logits 超出 [0,1] → 应套 sigmoid。-10 → ~0，10 → ~1
        mask = np.full((1, 1, 1024, 1024), -10.0, dtype=np.float32)
        mask[0, 0, 256:768, 256:768] = 10.0
        mock_session = _build_mock_session([mask])

        with _install_fake_onnxruntime(mock_session):
            src = Image.new("RGB", (1024, 1024), color=(0, 0, 0))
            result = provider.extract_subject(src)

        assert result is not None
        arr = np.array(result)
        assert arr[512, 512, 3] >= 240
        assert arr[10, 10, 3] <= 10

    def test_extract_subject_returns_none_on_inference_error(self, tmp_path):
        model_path = tmp_path / "model.onnx"
        model_path.write_bytes(b"fake-model")
        provider = self._new_provider(model_path)

        mock_input = MagicMock()
        mock_input.name = "input"
        mock_session = MagicMock()
        mock_session.get_inputs.return_value = [mock_input]
        mock_session.run.side_effect = RuntimeError("model crashed")

        with _install_fake_onnxruntime(mock_session):
            src = Image.new("RGB", (128, 128), color=(0, 0, 0))
            result = provider.extract_subject(src)

        assert result is None

    def test_extract_subject_downloads_model_when_missing(self, tmp_path):
        model_path = tmp_path / "subdir" / "model.onnx"
        provider = self._new_provider(model_path)

        chunks = [b"a" * 1024, b"b" * 1024, b""]
        fake_resp = MagicMock()
        fake_resp.headers = {"Content-Length": "2048"}
        fake_resp.iter_content.return_value = iter(chunks)
        fake_resp.raise_for_status.return_value = None
        fake_resp.__enter__ = MagicMock(return_value=fake_resp)
        fake_resp.__exit__ = MagicMock(return_value=False)

        mask = np.full((1, 1, 1024, 1024), 0.5, dtype=np.float32)
        mock_session = _build_mock_session([mask])

        with patch("requests.get", return_value=fake_resp) as mock_get, \
             _install_fake_onnxruntime(mock_session):
            src = Image.new("RGB", (64, 64), color=(0, 0, 0))
            result = provider.extract_subject(src)

        assert result is not None
        assert model_path.exists()
        assert not model_path.with_suffix(model_path.suffix + ".part").exists()
        mock_get.assert_called_once()


class TestRmbgFactory:
    def test_factory_returns_singleton(self):
        import services.ai_providers.image.rmbg_segmentation_provider as mod
        mod._singleton = None  # 重置单例避免和其他测试相互影响
        a = mod.create_rmbg_segmentation_provider()
        b = mod.create_rmbg_segmentation_provider()
        assert a is b
