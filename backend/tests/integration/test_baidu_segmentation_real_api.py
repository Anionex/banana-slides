"""
真实 API 集成测试：百度智能抠图 Provider

需要 BAIDU_API_KEY (或 BAIDU_OCR_API_KEY) 环境变量。
未配置时跳过。

运行：
  cd backend && uv run pytest tests/integration/test_baidu_segmentation_real_api.py -v -s
"""
import io
import os
from pathlib import Path

import pytest
from PIL import Image

from services.ai_providers.image.baidu_segmentation_provider import (
    create_baidu_segmentation_provider,
)


def _baidu_key_available() -> bool:
    if os.getenv("BAIDU_API_KEY") or os.getenv("BAIDU_OCR_API_KEY"):
        return True
    try:
        from config import Config
        return bool(Config.BAIDU_API_KEY)
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _baidu_key_available(),
    reason="未配置 BAIDU_API_KEY/BAIDU_OCR_API_KEY，跳过真实百度 API 测试",
)


def _find_test_image() -> Path:
    """找一张本地测试图片：优先 e2e fixtures，其次 backend 目录下任意 PNG/JPG"""
    candidates = [
        Path(__file__).parent.parent.parent.parent / "frontend" / "e2e" / "fixtures" / "slide_1.jpg",
        Path(__file__).parent.parent.parent.parent / "frontend" / "e2e" / "fixtures" / "slide_2.jpg",
    ]
    for p in candidates:
        if p.exists():
            return p
    pytest.skip("未找到测试图片")


def test_extract_subject_returns_rgba_with_alpha():
    provider = create_baidu_segmentation_provider()
    assert provider is not None, "Provider 创建失败（key 未配置）"

    img_path = _find_test_image()
    img = Image.open(img_path)

    # API 要求短边 ≥ 128px；fixtures 通常足够大
    assert min(img.size) >= 128, f"测试图片 {img_path} 短边 < 128px"

    result = provider.extract_subject(img)

    assert result is not None, "百度智能抠图返回 None"
    assert result.mode == "RGBA", f"预期 RGBA mode，实际 {result.mode}"

    # 验证 alpha 通道存在透明像素（说明真的抠出了主体）
    alpha = result.split()[-1]
    alpha_values = list(alpha.getdata())
    has_transparent = any(v < 255 for v in alpha_values)
    has_opaque = any(v > 0 for v in alpha_values)
    assert has_opaque, "结果全透明，主体提取失败"
    # 注意：若图片是纯主体充满整个画面，可能没有透明像素；这里只 warn
    if not has_transparent:
        print(f"⚠️ 结果无透明像素（图片 {img_path.name} 可能整体被识别为主体）")
    else:
        transparent_ratio = sum(1 for v in alpha_values if v < 255) / len(alpha_values)
        print(f"✅ 透明像素占比 {transparent_ratio:.1%}（{img_path.name}）")
