"""RMBG-2.0 ONNX 本地推理主体抠图 provider。

模型：briaai/RMBG-2.0 (FP16 ONNX)，CPU 推理。
首次使用懒下载到 ~/.cache/banana-slides/models/rmbg-2.0/model_fp16.onnx，
可通过 RMBG_MODEL_PATH 环境变量指定本地模型路径绕过下载。

注意：模型为 non-commercial license，仅用于本地推理。
"""
import logging
import os
import threading
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

_MODEL_URL = "https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model_fp16.onnx"
# repo 根目录：rmbg_segmentation_provider.py → backend/services/ai_providers/image/...
_PROJECT_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_MODEL_PATH = _PROJECT_ROOT / "models" / "rmbg-2.0" / "model_fp16.onnx"
_INPUT_SIZE = 1024
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _resolve_model_path() -> Path:
    """优先用 RMBG_MODEL_PATH，否则用默认缓存路径。"""
    env_path = os.environ.get("RMBG_MODEL_PATH")
    if env_path:
        return Path(env_path).expanduser()
    return _DEFAULT_MODEL_PATH


def _download_model(target: Path) -> None:
    """流式下载模型到 *.part 临时文件，下载完成后 rename。"""
    import requests

    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".part")
    logger.info(f"📥 开始下载 RMBG-2.0 模型 (~1GB) 到 {target} ...")

    chunk_size = 1024 * 1024
    log_step = 5 * 1024 * 1024
    downloaded = 0
    next_log = log_step

    with requests.get(_MODEL_URL, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        total = int(resp.headers.get("Content-Length", 0))
        with open(tmp, "wb") as f:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                if not chunk:
                    continue
                f.write(chunk)
                downloaded += len(chunk)
                if downloaded >= next_log:
                    if total:
                        pct = downloaded * 100 / total
                        logger.info(f"  下载进度: {downloaded // (1024*1024)}MB / {total // (1024*1024)}MB ({pct:.1f}%)")
                    else:
                        logger.info(f"  下载进度: {downloaded // (1024*1024)}MB")
                    next_log += log_step

    tmp.rename(target)
    logger.info(f"✅ RMBG-2.0 模型已就绪: {target}")


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _decontaminate_foreground(
    rgb: np.ndarray,
    alpha: np.ndarray,
    bg_alpha_threshold: float = 0.05,
    fg_alpha_floor: float = 0.1,
) -> np.ndarray:
    """从软 alpha 边缘像素里去掉原背景色的贡献，返回近似的真前景 RGB。

    - 用 alpha < bg_alpha_threshold 的像素均值估计原背景色 B
    - 对其他像素套 F = (C - (1-α)·B) / α，alpha 太小（< fg_alpha_floor）时
      限制分母避免噪声放大
    - 估不出背景（这种像素太少）时直接原样返回
    """
    bg_mask = alpha < bg_alpha_threshold
    if bg_mask.sum() < 100:
        return rgb

    bg_color = rgb[bg_mask].mean(axis=0)
    a = np.clip(alpha[..., None], fg_alpha_floor, 1.0)
    fg = (rgb - (1.0 - a) * bg_color) / a
    fg = np.clip(fg, 0.0, 255.0)
    return np.where(alpha[..., None] >= bg_alpha_threshold, fg, rgb)


class RmbgSegmentationProvider:
    """RMBG-2.0 ONNX FP16 本地推理 provider。"""

    def __init__(self, model_path: Optional[Path] = None):
        self._model_path = model_path or _resolve_model_path()
        self._session = None
        self._input_name: Optional[str] = None
        self._init_lock = threading.Lock()

    def _ensure_session(self) -> None:
        if self._session is not None:
            return
        with self._init_lock:
            if self._session is not None:
                return
            if not self._model_path.exists():
                _download_model(self._model_path)

            import onnxruntime as ort

            logger.info(f"🧠 加载 RMBG-2.0 ONNX 模型: {self._model_path}")
            self._session = ort.InferenceSession(
                str(self._model_path), providers=["CPUExecutionProvider"]
            )
            self._input_name = self._session.get_inputs()[0].name

    def extract_subject(self, image: Image.Image) -> Optional[Image.Image]:
        """对输入 PIL Image 抠出主体，返回 RGBA；失败返回 None。"""
        try:
            self._ensure_session()
            rgb = image.convert("RGB")
            orig_size = rgb.size  # (w, h)
            resized = rgb.resize((_INPUT_SIZE, _INPUT_SIZE), Image.LANCZOS)

            arr = np.asarray(resized, dtype=np.float32) / 255.0
            arr = (arr - _MEAN) / _STD
            tensor = arr.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float32)

            outputs = self._session.run(None, {self._input_name: tensor})
            mask = outputs[-1] if isinstance(outputs, (list, tuple)) else outputs

            mask = np.asarray(mask, dtype=np.float32)
            mask = np.squeeze(mask)
            if mask.ndim != 2:
                logger.warning(f"RMBG 输出 shape 异常: {mask.shape}，跳过")
                return None

            # RMBG-2.0 输出已应用 sigmoid，落在 [0,1]，但数值噪声可能略微越界。
            # 仅在显著超出 [0,1] 时（明显是 raw logits）才补 sigmoid，否则裁剪即可。
            if mask.min() < -0.5 or mask.max() > 1.5:
                mask = _sigmoid(mask)

            mask = np.clip(mask, 0.0, 1.0)
            mask_uint8 = (mask * 255.0).astype(np.uint8)
            mask_pil = Image.fromarray(mask_uint8, mode="L").resize(orig_size, Image.LANCZOS)
            alpha_full = np.asarray(mask_pil, dtype=np.float32) / 255.0

            # 边缘去污染：模型给的软 alpha 边缘 RGB 仍然混着原背景色，
            # 合成到新底色时会漏出旧背景。用 F=(C-(1-α)B)/α 反解真前景色。
            rgb_decont = _decontaminate_foreground(np.asarray(rgb, dtype=np.float32), alpha_full)

            # 极薄 alpha（<0.05）一律拍零，防止 1/α 放大噪声造成色斑。
            alpha_full = np.where(alpha_full < 0.05, 0.0, alpha_full)
            alpha_uint8 = np.clip(alpha_full * 255.0, 0, 255).astype(np.uint8)

            rgba = np.dstack([rgb_decont.astype(np.uint8), alpha_uint8])
            return Image.fromarray(rgba, mode="RGBA")
        except Exception as e:
            logger.warning(f"RMBG 抠图失败: {e}")
            return None


_singleton_lock = threading.Lock()
_singleton: Optional[RmbgSegmentationProvider] = None


def create_rmbg_segmentation_provider() -> RmbgSegmentationProvider:
    """单例工厂。"""
    global _singleton
    if _singleton is not None:
        return _singleton
    with _singleton_lock:
        if _singleton is None:
            _singleton = RmbgSegmentationProvider()
    return _singleton
