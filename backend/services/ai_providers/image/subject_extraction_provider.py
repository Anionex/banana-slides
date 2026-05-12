"""Subject extraction provider 兼容层。"""
from typing import Optional, Protocol, runtime_checkable

from PIL import Image


@runtime_checkable
class SubjectExtractionProvider(Protocol):
    """主体抠图 provider 兼容层。

    任何实现 extract_subject 的对象都可作为 provider，
    便于未来从本地 RMBG ONNX 切到 BRIA 托管 API 等。
    """

    def extract_subject(self, image: Image.Image) -> Optional[Image.Image]:
        """输入任意 mode PIL Image，返回 RGBA 主体图；失败返 None。"""
        ...
