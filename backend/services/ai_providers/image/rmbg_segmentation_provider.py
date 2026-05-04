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
_DEFAULT_MODEL_PATH = (
    Path.home() / ".cache" / "banana-slides" / "models" / "rmbg-2.0" / "model_fp16.onnx"
)
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
            tensor = arr.transpose(2, 0, 1)[np.newaxis, ...].astype(np.float16)

            outputs = self._session.run(None, {self._input_name: tensor})
            mask = outputs[-1] if isinstance(outputs, (list, tuple)) else outputs

            mask = np.asarray(mask, dtype=np.float32)
            mask = np.squeeze(mask)
            if mask.ndim != 2:
                logger.warning(f"RMBG 输出 shape 异常: {mask.shape}，跳过")
                return None

            if mask.min() < 0.0 or mask.max() > 1.0:
                mask = _sigmoid(mask)

            mask_uint8 = np.clip(mask * 255.0, 0, 255).astype(np.uint8)
            mask_pil = Image.fromarray(mask_uint8, mode="L").resize(orig_size, Image.LANCZOS)

            result = rgb.copy()
            result.putalpha(mask_pil)
            return result
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
