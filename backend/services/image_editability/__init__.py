"""
图片可编辑化服务模块

核心设计：
- 无状态服务 - 线程安全，可并行调用
- 依赖注入 - 通过配置对象注入所有依赖
- 单一职责 - 只负责单张图片的可编辑化，批量处理由调用者控制

组件：
- 数据模型（BBox, EditableElement, EditableImage）
- 元素提取器（ElementExtractor及其实现）
- Inpaint提供者（InpaintProvider及其实现）
- 工厂和配置（ServiceConfig）
- 主服务类（ImageEditabilityService）

Example:
    >>> from services.image_editability import ServiceConfig, ImageEditabilityService
    >>> 
    >>> # 创建配置
    >>> config = ServiceConfig.from_defaults(mineru_token="your_token")
    >>> 
    >>> # 创建服务
    >>> service = ImageEditabilityService(config)
    >>> 
    >>> # 串行处理
    >>> result = service.make_image_editable("image.png")
    >>> 
    >>> # 并行处理（推荐）
    >>> from concurrent.futures import ThreadPoolExecutor, as_completed
    >>> 
    >>> images = ["img1.png", "img2.png", "img3.png"]
    >>> with ThreadPoolExecutor(max_workers=4) as executor:
    ...     futures = {executor.submit(service.make_image_editable, img): img 
    ...                for img in images}
    ...     results = {images[i]: future.result() 
    ...                for i, future in enumerate(as_completed(futures))}
"""

# 数据模型
from .data_models import BBox, EditableElement, EditableImage

# 坐标映射
from .coordinate_mapper import CoordinateMapper

# 元素提取器
from .extractors import (
    ElementExtractor,
    MinerUElementExtractor,
    BaiduOCRElementExtractor,
    BaiduAccurateOCRElementExtractor,
    ExtractorRegistry
)

# 混合提取器
from .hybrid_extractor import (
    HybridElementExtractor,
    BBoxUtils,
    create_hybrid_extractor
)

# Inpaint提供者
from .inpaint_providers import (
    InpaintProvider,
    DefaultInpaintProvider,
    GenerativeEditInpaintProvider,
    BaiduInpaintProvider,
    HybridInpaintProvider,
    InpaintProviderRegistry
)

# 文字属性提取器
from .text_attribute_extractors import (
    TextStyleResult,
    TextAttributeExtractor,
    CaptionModelTextAttributeExtractor,
    TextAttributeExtractorRegistry
)

# 工厂和配置
from .factories import (
    ExtractorFactory,
    InpaintProviderFactory,
    TextAttributeExtractorFactory,
    ServiceConfig
)

# 主服务
from .service import ImageEditabilityService

__all__ = [
    # 数据模型
    'BBox',
    'EditableElement',
    'EditableImage',
    # 坐标映射
    'CoordinateMapper',
    # 元素提取器
    'ElementExtractor',
    'MinerUElementExtractor',
    'BaiduOCRElementExtractor',
    'BaiduAccurateOCRElementExtractor',
    'ExtractorRegistry',
    # 混合提取器
    'HybridElementExtractor',
    'BBoxUtils',
    'create_hybrid_extractor',
    # Inpaint提供者
    'InpaintProvider',
    'DefaultInpaintProvider',
    'GenerativeEditInpaintProvider',
    'BaiduInpaintProvider',
    'HybridInpaintProvider',
    'InpaintProviderRegistry',
    # 文字属性提取器
    'TextStyleResult',
    'TextAttributeExtractor',
    'CaptionModelTextAttributeExtractor',
    'TextAttributeExtractorRegistry',
    # 工厂和配置
    'ExtractorFactory',
    'InpaintProviderFactory',
    'TextAttributeExtractorFactory',
    'ServiceConfig',
    # 主服务
    'ImageEditabilityService',
]

