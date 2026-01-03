"""
工厂类 - 负责创建和配置具体的提取器和Inpaint提供者
"""
import logging
from typing import List, Optional, Any
from pathlib import Path

from .extractors import ElementExtractor, MinerUElementExtractor, BaiduOCRElementExtractor, BaiduAccurateOCRElementExtractor, ExtractorRegistry
from .hybrid_extractor import HybridElementExtractor, create_hybrid_extractor
from .inpaint_providers import (
    InpaintProvider, 
    DefaultInpaintProvider, 
    GenerativeEditInpaintProvider, 
    BaiduInpaintProvider,
    HybridInpaintProvider,
    InpaintProviderRegistry
)
from .text_attribute_extractors import (
    TextAttributeExtractor,
    CaptionModelTextAttributeExtractor,
    TextAttributeExtractorRegistry,
    TextStyleResult
)

logger = logging.getLogger(__name__)


class ExtractorFactory:
    """元素提取器工厂"""
    
    @staticmethod
    def create_default_extractors(
        parser_service: Any,
        upload_folder: Path,
        baidu_table_ocr_provider: Optional[Any] = None
    ) -> List[ElementExtractor]:
        """
        创建默认的元素提取器列表
        
        Args:
            parser_service: MinerU解析服务实例
            upload_folder: 上传文件夹路径
            baidu_table_ocr_provider: 百度表格OCR Provider实例（可选）
        
        Returns:
            提取器列表（按优先级排序）
        
        Note:
            推荐使用 create_extractor_registry() 方法，它提供更清晰的类型到提取器映射
        """
        extractors: List[ElementExtractor] = []
        
        # 1. 百度OCR提取器（用于表格）
        if baidu_table_ocr_provider is None:
            try:
                from services.ai_providers.ocr import create_baidu_table_ocr_provider
                baidu_provider = create_baidu_table_ocr_provider()
                if baidu_provider:
                    extractors.append(BaiduOCRElementExtractor(baidu_provider))
                    logger.info("✅ 百度表格OCR提取器已启用")
            except Exception as e:
                logger.warning(f"无法初始化百度表格OCR: {e}")
        else:
            extractors.append(BaiduOCRElementExtractor(baidu_table_ocr_provider))
            logger.info("✅ 百度表格OCR提取器已启用")
        
        # 2. MinerU提取器（默认通用提取器）
        mineru_extractor = MinerUElementExtractor(parser_service, upload_folder)
        extractors.append(mineru_extractor)
        logger.info("✅ MinerU提取器已启用")
        
        return extractors
    
    @staticmethod
    def create_extractor_registry(
        parser_service: Any,
        upload_folder: Path,
        baidu_table_ocr_provider: Optional[Any] = None
    ) -> ExtractorRegistry:
        """
        创建元素类型到提取器的注册表
        
        默认配置：
        - 表格类型（table, table_cell）→ 百度OCR（如果可用），否则MinerU
        - 图片类型（image, figure, chart）→ MinerU
        - 其他类型 → MinerU（默认）
        
        Args:
            parser_service: MinerU解析服务实例
            upload_folder: 上传文件夹路径
            baidu_table_ocr_provider: 百度表格OCR Provider实例（可选）
        
        Returns:
            配置好的ExtractorRegistry实例
        """
        # 创建MinerU提取器
        mineru_extractor = MinerUElementExtractor(parser_service, upload_folder)
        logger.info("✅ MinerU提取器已创建")
        
        # 尝试创建百度OCR提取器
        baidu_ocr_extractor = None
        if baidu_table_ocr_provider is None:
            try:
                from services.ai_providers.ocr import create_baidu_table_ocr_provider
                baidu_provider = create_baidu_table_ocr_provider()
                if baidu_provider:
                    baidu_ocr_extractor = BaiduOCRElementExtractor(baidu_provider)
                    logger.info("✅ 百度表格OCR提取器已创建")
            except Exception as e:
                logger.warning(f"无法初始化百度表格OCR: {e}")
        else:
            baidu_ocr_extractor = BaiduOCRElementExtractor(baidu_table_ocr_provider)
            logger.info("✅ 百度表格OCR提取器已创建")
        
        # 尝试创建百度高精度OCR提取器
        baidu_accurate_ocr_extractor = None
        try:
            from services.ai_providers.ocr import create_baidu_accurate_ocr_provider
            baidu_accurate_provider = create_baidu_accurate_ocr_provider()
            if baidu_accurate_provider:
                baidu_accurate_ocr_extractor = BaiduAccurateOCRElementExtractor(baidu_accurate_provider)
                logger.info("✅ 百度高精度OCR提取器已创建")
        except Exception as e:
            logger.warning(f"无法初始化百度高精度OCR: {e}")
        
        # 使用注册表的工厂方法创建默认配置
        return ExtractorRegistry.create_default(
            mineru_extractor=mineru_extractor,
            baidu_ocr_extractor=baidu_ocr_extractor,
            baidu_accurate_ocr_extractor=baidu_accurate_ocr_extractor
        )
    
    @staticmethod
    def create_baidu_accurate_ocr_extractor(
        baidu_accurate_ocr_provider: Optional[Any] = None
    ) -> Optional[BaiduAccurateOCRElementExtractor]:
        """
        创建百度高精度OCR提取器
        
        Args:
            baidu_accurate_ocr_provider: 百度高精度OCR Provider实例（可选，自动创建）
        
        Returns:
            BaiduAccurateOCRElementExtractor实例，如果不可用则返回None
        """
        if baidu_accurate_ocr_provider is None:
            try:
                from services.ai_providers.ocr import create_baidu_accurate_ocr_provider
                baidu_accurate_ocr_provider = create_baidu_accurate_ocr_provider()
            except Exception as e:
                logger.warning(f"无法初始化百度高精度OCR Provider: {e}")
                return None
        
        if baidu_accurate_ocr_provider is None:
            return None
        
        return BaiduAccurateOCRElementExtractor(baidu_accurate_ocr_provider)
    
    @staticmethod
    def create_hybrid_extractor(
        parser_service: Any,
        upload_folder: Path,
        baidu_accurate_ocr_provider: Optional[Any] = None,
        contain_threshold: float = 0.8,
        intersection_threshold: float = 0.3
    ) -> Optional[HybridElementExtractor]:
        """
        创建混合元素提取器
        
        混合提取器结合MinerU版面分析和百度高精度OCR：
        - MinerU负责识别元素类型和整体布局
        - 百度OCR负责精确的文字识别和定位
        
        合并策略：
        1. 图片类型bbox里包含的百度OCR bbox → 删除（图片内的文字不需要单独提取）
        2. 表格类型bbox里包含的百度OCR bbox → 保留百度OCR结果，删除MinerU表格bbox
        3. 其他类型（文字等）与百度OCR bbox有交集 → 使用百度OCR结果，删除MinerU bbox
        
        Args:
            parser_service: MinerU解析服务实例
            upload_folder: 上传文件夹路径
            baidu_accurate_ocr_provider: 百度高精度OCR Provider实例（可选，自动创建）
            contain_threshold: 包含判断阈值，默认0.8（80%面积在内部算包含）
            intersection_threshold: 交集判断阈值，默认0.3（30%重叠算有交集）
        
        Returns:
            HybridElementExtractor实例，如果无法创建则返回None
        """
        # 创建MinerU提取器
        mineru_extractor = MinerUElementExtractor(parser_service, upload_folder)
        logger.info("✅ MinerU提取器已创建（用于混合提取）")
        
        # 创建百度高精度OCR提取器
        baidu_ocr_extractor = ExtractorFactory.create_baidu_accurate_ocr_extractor(
            baidu_accurate_ocr_provider
        )
        
        if baidu_ocr_extractor is None:
            logger.warning("无法创建百度高精度OCR提取器，混合提取器创建失败")
            return None
        
        logger.info("✅ 百度高精度OCR提取器已创建（用于混合提取）")
        
        return HybridElementExtractor(
            mineru_extractor=mineru_extractor,
            baidu_ocr_extractor=baidu_ocr_extractor,
            contain_threshold=contain_threshold,
            intersection_threshold=intersection_threshold
        )
    
    @staticmethod
    def create_hybrid_extractor_registry(
        parser_service: Any,
        upload_folder: Path,
        baidu_table_ocr_provider: Optional[Any] = None,
        baidu_accurate_ocr_provider: Optional[Any] = None,
        contain_threshold: float = 0.8,
        intersection_threshold: float = 0.3
    ) -> ExtractorRegistry:
        """
        创建使用混合提取器的注册表
        
        默认配置：
        - 所有类型 → 混合提取器（如果可用）
        - 回退到MinerU（如果混合提取器不可用）
        
        Args:
            parser_service: MinerU解析服务实例
            upload_folder: 上传文件夹路径
            baidu_table_ocr_provider: 百度表格OCR Provider实例（可选）
            baidu_accurate_ocr_provider: 百度高精度OCR Provider实例（可选）
            contain_threshold: 包含判断阈值
            intersection_threshold: 交集判断阈值
        
        Returns:
            配置好的ExtractorRegistry实例
        """
        # 创建MinerU提取器作为回退
        mineru_extractor = MinerUElementExtractor(parser_service, upload_folder)
        logger.info("✅ MinerU提取器已创建")
        
        # 尝试创建混合提取器
        hybrid_extractor = ExtractorFactory.create_hybrid_extractor(
            parser_service=parser_service,
            upload_folder=upload_folder,
            baidu_accurate_ocr_provider=baidu_accurate_ocr_provider,
            contain_threshold=contain_threshold,
            intersection_threshold=intersection_threshold
        )
        
        # 尝试创建百度表格OCR提取器
        baidu_table_ocr_extractor = None
        if baidu_table_ocr_provider is None:
            try:
                from services.ai_providers.ocr import create_baidu_table_ocr_provider
                baidu_provider = create_baidu_table_ocr_provider()
                if baidu_provider:
                    from .extractors import BaiduOCRElementExtractor
                    baidu_table_ocr_extractor = BaiduOCRElementExtractor(baidu_provider)
                    logger.info("✅ 百度表格OCR提取器已创建")
            except Exception as e:
                logger.warning(f"无法初始化百度表格OCR: {e}")
        else:
            from .extractors import BaiduOCRElementExtractor
            baidu_table_ocr_extractor = BaiduOCRElementExtractor(baidu_table_ocr_provider)
            logger.info("✅ 百度表格OCR提取器已创建")
        
        # 创建注册表
        registry = ExtractorRegistry()
        
        # 设置默认提取器
        if hybrid_extractor:
            registry.register_default(hybrid_extractor)
            logger.info("✅ 使用混合提取器作为默认提取器")
        else:
            registry.register_default(mineru_extractor)
            logger.info("⚠️ 混合提取器不可用，回退到MinerU提取器")
        
        # 表格类型使用百度表格OCR（如果可用）
        if baidu_table_ocr_extractor:
            registry.register_types(list(ExtractorRegistry.TABLE_TYPES), baidu_table_ocr_extractor)
        
        return registry


class InpaintProviderFactory:
    """Inpaint提供者工厂"""
    
    @staticmethod
    def create_default_provider(inpainting_service: Optional[Any] = None) -> Optional[InpaintProvider]:
        """
        创建默认的Inpaint提供者（使用Volcengine Inpainting服务）
        
        Args:
            inpainting_service: InpaintingService实例（可选）
        
        Returns:
            InpaintProvider实例，失败返回None
        """
        if inpainting_service is None:
            from services.inpainting_service import get_inpainting_service
            inpainting_service = get_inpainting_service()
        
        logger.info("创建DefaultInpaintProvider")
        return DefaultInpaintProvider(inpainting_service)
    
    @staticmethod
    def create_generative_edit_provider(
        ai_service: Optional[Any] = None,
        aspect_ratio: str = "16:9",
        resolution: str = "2K"
    ) -> InpaintProvider:
        """
        创建基于生成式大模型的Inpaint提供者
        
        使用生成式大模型（如Gemini图片编辑）通过自然语言指令移除图片中的文字和图标。
        适用于不需要精确bbox的场景，大模型自动理解并移除相关元素。
        
        Args:
            ai_service: AIService实例（可选，如果不提供则自动获取）
            aspect_ratio: 目标宽高比
            resolution: 目标分辨率
        
        Returns:
            GenerativeEditInpaintProvider实例
        
        Raises:
            如果AI服务初始化失败，会抛出异常
        """
        if ai_service is None:
            from services.ai_service_manager import get_ai_service
            ai_service = get_ai_service()
        
        logger.info("创建GenerativeEditInpaintProvider")
        return GenerativeEditInpaintProvider(ai_service, aspect_ratio, resolution)
    
    @staticmethod
    def create_inpaint_registry(
        mask_provider: Optional[InpaintProvider] = None,
        generative_provider: Optional[InpaintProvider] = None,
        default_provider_type: str = "generative"
    ) -> InpaintProviderRegistry:
        """
        创建重绘方法注册表
        
        支持动态注册新元素类型，不限于预定义类型。
        
        Args:
            mask_provider: 基于mask的重绘提供者（可选，自动创建）
            generative_provider: 生成式重绘提供者（可选，自动创建）
            default_provider_type: 默认使用的提供者类型 ("mask" 或 "generative")
        
        Returns:
            配置好的InpaintProviderRegistry实例
        """
        # 自动创建提供者
        if mask_provider is None:
            mask_provider = InpaintProviderFactory.create_default_provider()
        
        if generative_provider is None:
            generative_provider = InpaintProviderFactory.create_generative_edit_provider()
        
        # 创建注册表
        registry = InpaintProviderRegistry()
        
        # 设置默认提供者
        if default_provider_type == "generative" and generative_provider:
            registry.register_default(generative_provider)
        elif mask_provider:
            registry.register_default(mask_provider)
        elif generative_provider:
            registry.register_default(generative_provider)
        
        # 注册类型映射（可通过registry.register()动态扩展）
        if mask_provider:
            # 文本和表格使用mask-based精确移除
            registry.register_types(['text', 'title', 'paragraph'], mask_provider)
            registry.register_types(['table', 'table_cell'], mask_provider)
        
        if generative_provider:
            # 图片和图表使用生成式重绘
            registry.register_types(['image', 'figure', 'chart', 'diagram'], generative_provider)
        
        logger.info(f"创建InpaintProviderRegistry: 默认={default_provider_type}, "
                   f"mask={mask_provider is not None}, generative={generative_provider is not None}")
        
        return registry
    
    @staticmethod
    def create_baidu_inpaint_provider() -> Optional[BaiduInpaintProvider]:
        """
        创建百度图像修复提供者
        
        使用百度AI在指定矩形区域去除遮挡物并用背景内容填充。
        
        Returns:
            BaiduInpaintProvider实例，如果不可用则返回None
        """
        try:
            from services.ai_providers.image.baidu_inpainting_provider import create_baidu_inpainting_provider
            baidu_provider = create_baidu_inpainting_provider()
            if baidu_provider:
                logger.info("✅ 创建BaiduInpaintProvider")
                return BaiduInpaintProvider(baidu_provider)
            else:
                logger.warning("⚠️ 无法创建百度图像修复Provider（API Key未配置）")
                return None
        except Exception as e:
            logger.warning(f"⚠️ 创建BaiduInpaintProvider失败: {e}")
            return None
    
    @staticmethod
    def create_hybrid_inpaint_provider(
        baidu_provider: Optional[BaiduInpaintProvider] = None,
        generative_provider: Optional[GenerativeEditInpaintProvider] = None,
        ai_service: Optional[Any] = None,
        enhance_quality: bool = True
    ) -> Optional[HybridInpaintProvider]:
        """
        创建混合Inpaint提供者（百度修复 + 生成式画质提升）
        
        工作流程：
        1. 先使用百度图像修复API精确去除文字
        2. 再使用生成式大模型提升整体画质
        
        Args:
            baidu_provider: 百度图像修复提供者（可选，自动创建）
            generative_provider: 生成式编辑提供者（可选，自动创建）
            ai_service: AI服务实例（用于创建生成式提供者）
            enhance_quality: 是否启用画质提升，默认True
        
        Returns:
            HybridInpaintProvider实例，如果无法创建则返回None
        """
        # 创建百度修复提供者
        if baidu_provider is None:
            baidu_provider = InpaintProviderFactory.create_baidu_inpaint_provider()
        
        if baidu_provider is None:
            logger.warning("⚠️ 无法创建百度图像修复Provider，混合Provider创建失败")
            return None
        
        # 创建生成式提供者（用于画质提升）
        if generative_provider is None:
            generative_provider = InpaintProviderFactory.create_generative_edit_provider(
                ai_service=ai_service
            )
        
        logger.info("✅ 创建HybridInpaintProvider（百度修复 + 生成式画质提升）")
        return HybridInpaintProvider(
            baidu_provider=baidu_provider,
            generative_provider=generative_provider,
            enhance_quality=enhance_quality
        )


class ServiceConfig:
    """服务配置类 - 纯配置，不持有具体服务引用"""
    
    def __init__(
        self,
        upload_folder: Path,
        extractor_registry: ExtractorRegistry,
        inpaint_registry: InpaintProviderRegistry,
        max_depth: int = 1,
        min_image_size: int = 200,
        min_image_area: int = 40000
    ):
        """
        初始化服务配置
        
        Args:
            upload_folder: 上传文件夹路径
            extractor_registry: 元素类型到提取器的注册表
            inpaint_registry: 元素类型到重绘方法的注册表
            max_depth: 最大递归深度（默认1）
            min_image_size: 最小图片尺寸
            min_image_area: 最小图片面积
        """
        self.upload_folder = upload_folder
        self.extractor_registry = extractor_registry
        self.inpaint_registry = inpaint_registry
        self.max_depth = max_depth
        self.min_image_size = min_image_size
        self.min_image_area = min_image_area
    
    @classmethod
    def from_defaults(
        cls,
        mineru_token: Optional[str] = None,
        mineru_api_base: Optional[str] = None,
        upload_folder: Optional[str] = None,
        ai_service: Optional[Any] = None,
        use_hybrid_extractor: bool = True,
        use_hybrid_inpaint: bool = True,
        **kwargs
    ) -> 'ServiceConfig':
        """
        从默认参数创建配置
        
        默认配置（推荐用于导出PPTX）：
        - 元素提取：混合提取器（MinerU版面分析 + 百度高精度OCR）
        - 背景生成：混合Inpaint（百度图像修复 + 生成式画质提升）
        - 递归深度：1
        
        混合提取器合并策略：
        1. 图片类型bbox里包含的百度OCR bbox → 删除
        2. 表格类型bbox里包含的百度OCR bbox → 保留百度OCR结果，删除MinerU表格bbox
        3. 其他类型与百度OCR bbox有交集 → 使用百度OCR结果
        
        混合Inpaint策略：
        1. 先用百度图像修复精确去除指定区域的文字
        2. 再用生成式模型提升整体画质
        
        支持动态注册新的元素类型到不同的提取器/重绘方法。
        
        如果不提供参数，会自动从 Flask app.config 获取配置。
        
        Args:
            mineru_token: MinerU API token（可选，默认从 Flask config 获取）
            mineru_api_base: MinerU API base URL（可选，默认从 Flask config 获取）
            upload_folder: 上传文件夹路径（可选，默认从 Flask config 获取）
            ai_service: AI服务实例（可选，用于生成式重绘）
            use_hybrid_extractor: 是否使用混合提取器（默认True）
            use_hybrid_inpaint: 是否使用混合Inpaint（百度修复+生成式画质提升）（默认True）
            **kwargs: 其他配置参数
                - max_depth: 最大递归深度（默认1）
                - min_image_size: 最小图片尺寸（默认200）
                - min_image_area: 最小图片面积（默认40000）
                - contain_threshold: 混合提取器包含判断阈值（默认0.8）
                - intersection_threshold: 混合提取器交集判断阈值（默认0.3）
                - enhance_quality: 混合Inpaint是否启用画质提升（默认True）
        
        Returns:
            ServiceConfig实例
        
        Raises:
            ValueError: 如果 mineru_token 未配置
        """
        # 自动从 Flask config 获取配置
        from flask import current_app, has_app_context
        
        if has_app_context() and current_app:
            if mineru_token is None:
                mineru_token = current_app.config.get('MINERU_TOKEN')
            if mineru_api_base is None:
                mineru_api_base = current_app.config.get('MINERU_API_BASE', 'https://mineru.net')
            if upload_folder is None:
                upload_folder = current_app.config.get('UPLOAD_FOLDER', './uploads')
        else:
            # 回退到默认值
            if mineru_api_base is None:
                mineru_api_base = 'https://mineru.net'
            if upload_folder is None:
                upload_folder = './uploads'
        
        # 验证必需配置
        if not mineru_token:
            raise ValueError("MinerU token is required. Please configure MINERU_TOKEN.")
        
        from services.file_parser_service import FileParserService
        
        # 解析upload_folder路径
        upload_path = Path(upload_folder)
        if not upload_path.is_absolute():
            current_file = Path(__file__).resolve()
            backend_dir = current_file.parent.parent
            project_root = backend_dir.parent
            upload_path = project_root / upload_folder.lstrip('./')
        
        logger.info(f"Upload folder resolved to: {upload_path}")
        
        # 创建MinerU解析服务
        parser_service = FileParserService(
            mineru_token=mineru_token,
            mineru_api_base=mineru_api_base
        )
        
        # 创建提取器注册表
        extractor_registry = ExtractorRegistry()
        
        if use_hybrid_extractor:
            # 尝试创建混合提取器（MinerU + 百度高精度OCR）
            hybrid_extractor = ExtractorFactory.create_hybrid_extractor(
                parser_service=parser_service,
                upload_folder=upload_path,
                contain_threshold=kwargs.get('contain_threshold', 0.8),
                intersection_threshold=kwargs.get('intersection_threshold', 0.3)
            )
            
            if hybrid_extractor:
                extractor_registry.register_default(hybrid_extractor)
                logger.info("✅ 混合提取器已创建（MinerU + 百度高精度OCR）")
            else:
                # 回退到MinerU
                mineru_extractor = MinerUElementExtractor(parser_service, upload_path)
                extractor_registry.register_default(mineru_extractor)
                logger.warning("⚠️ 混合提取器创建失败，回退到MinerU提取器")
        else:
            # 使用纯MinerU提取器
            mineru_extractor = MinerUElementExtractor(parser_service, upload_path)
            extractor_registry.register_default(mineru_extractor)
            logger.info("✅ MinerU提取器已创建（通用分割）")
        
        # 创建Inpaint提供者
        inpaint_registry = InpaintProviderRegistry()
        
        if use_hybrid_inpaint:
            # 尝试创建混合Inpaint提供者（百度修复 + 生成式画质提升）
            hybrid_inpaint = InpaintProviderFactory.create_hybrid_inpaint_provider(
                ai_service=ai_service,
                enhance_quality=kwargs.get('enhance_quality', True)
            )
            
            if hybrid_inpaint:
                inpaint_registry.register_default(hybrid_inpaint)
                logger.info("✅ 混合Inpaint提供者已创建（百度修复 + 生成式画质提升）")
            else:
                # 回退到纯生成式重绘
                generative_provider = InpaintProviderFactory.create_generative_edit_provider(
                    ai_service=ai_service
                )
                inpaint_registry.register_default(generative_provider)
                logger.warning("⚠️ 混合Inpaint创建失败，回退到GenerativeEdit")
        else:
            # 使用纯生成式重绘
            generative_provider = InpaintProviderFactory.create_generative_edit_provider(
                ai_service=ai_service
            )
            inpaint_registry.register_default(generative_provider)
            logger.info("✅ 重绘注册表已创建（GenerativeEdit通用）")
        
        return cls(
            upload_folder=upload_path,
            extractor_registry=extractor_registry,
            inpaint_registry=inpaint_registry,
            max_depth=kwargs.get('max_depth', 1),
            min_image_size=kwargs.get('min_image_size', 200),
            min_image_area=kwargs.get('min_image_area', 40000)
        )


class TextAttributeExtractorFactory:
    """文字属性提取器工厂"""
    
    @staticmethod
    def create_caption_model_extractor(
        ai_service: Optional[Any] = None,
        prompt_template: Optional[str] = None
    ) -> TextAttributeExtractor:
        """
        创建基于Caption Model的文字属性提取器
        
        使用视觉语言模型（如Gemini）分析文字区域图像，
        通过生成JSON的方式获取字体颜色、是否粗体、是否斜体等属性。
        
        Args:
            ai_service: AIService实例（可选，如果不提供则自动获取）
            prompt_template: 自定义的prompt模板（可选），必须使用 {content_hint} 作为占位符
        
        Returns:
            CaptionModelTextAttributeExtractor实例
        
        Raises:
            如果AI服务初始化失败，会抛出异常
        """
        if ai_service is None:
            from services.ai_service_manager import get_ai_service
            ai_service = get_ai_service()
        
        logger.info("创建CaptionModelTextAttributeExtractor")
        return CaptionModelTextAttributeExtractor(ai_service, prompt_template)
    
    @staticmethod
    def create_text_attribute_registry(
        caption_extractor: Optional[TextAttributeExtractor] = None,
        ai_service: Optional[Any] = None
    ) -> TextAttributeExtractorRegistry:
        """
        创建文字属性提取器注册表
        
        支持动态注册新元素类型，不限于预定义类型。
        
        Args:
            caption_extractor: Caption Model提取器（可选，自动创建）
            ai_service: AIService实例（可选，用于自动创建提取器）
        
        Returns:
            配置好的TextAttributeExtractorRegistry实例
        
        Raises:
            如果提取器创建失败，会抛出异常
        """
        # 自动创建提取器
        if caption_extractor is None:
            caption_extractor = TextAttributeExtractorFactory.create_caption_model_extractor(
                ai_service=ai_service
            )
        
        # 创建注册表
        registry = TextAttributeExtractorRegistry()
        
        # 设置默认提取器
        registry.register_default(caption_extractor)
        
        # 注册文本类型
        registry.register_types(
            ['text', 'title', 'paragraph', 'heading', 'table_cell'],
            caption_extractor
        )
        
        logger.info("创建TextAttributeExtractorRegistry")
        
        return registry

