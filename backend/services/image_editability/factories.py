"""
工厂类 - 负责创建和配置具体的提取器和Inpaint提供者
"""
import logging
from typing import List, Optional, Any
from pathlib import Path

from .extractors import ElementExtractor, MinerUElementExtractor, BaiduOCRElementExtractor
from .inpaint_providers import InpaintProvider, DefaultInpaintProvider

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


class InpaintProviderFactory:
    """Inpaint提供者工厂"""
    
    @staticmethod
    def create_default_provider(inpainting_service: Optional[Any] = None) -> Optional[InpaintProvider]:
        """
        创建默认的Inpaint提供者
        
        Args:
            inpainting_service: InpaintingService实例（可选）
        
        Returns:
            InpaintProvider实例，失败返回None
        """
        if inpainting_service is not None:
            logger.info("使用提供的InpaintingService")
            return DefaultInpaintProvider(inpainting_service)
        
        # 尝试自动初始化
        try:
            from services.inpainting_service import get_inpainting_service
            inpainting_service = get_inpainting_service()
            logger.info("自动初始化DefaultInpaintProvider")
            return DefaultInpaintProvider(inpainting_service)
        except Exception as e:
            logger.warning(f"无法初始化Inpainting服务: {e}")
            return None


class ServiceConfig:
    """服务配置类 - 纯配置，不持有具体服务引用"""
    
    def __init__(
        self,
        upload_folder: Path,
        extractors: List[ElementExtractor],
        inpaint_provider: Optional[InpaintProvider] = None,
        max_depth: int = 3,
        min_image_size: int = 200,
        min_image_area: int = 40000
    ):
        """
        初始化服务配置
        
        Args:
            upload_folder: 上传文件夹路径
            extractors: 元素提取器列表
            inpaint_provider: Inpaint提供者
            max_depth: 最大递归深度
            min_image_size: 最小图片尺寸
            min_image_area: 最小图片面积
        """
        self.upload_folder = upload_folder
        self.extractors = extractors
        self.inpaint_provider = inpaint_provider
        self.max_depth = max_depth
        self.min_image_size = min_image_size
        self.min_image_area = min_image_area
    
    @classmethod
    def from_defaults(
        cls,
        mineru_token: str,
        mineru_api_base: str = "https://mineru.net",
        upload_folder: str = "./uploads",
        inpainting_service: Optional[Any] = None,
        baidu_table_ocr_provider: Optional[Any] = None,
        **kwargs
    ) -> 'ServiceConfig':
        """
        从默认参数创建配置
        
        Args:
            mineru_token: MinerU API token
            mineru_api_base: MinerU API base URL
            upload_folder: 上传文件夹路径
            inpainting_service: Inpainting服务实例（可选）
            baidu_table_ocr_provider: 百度表格OCR Provider实例（可选）
            **kwargs: 其他配置参数
        
        Returns:
            ServiceConfig实例
        """
        from services.file_parser_service import FileParserService
        
        # 解析upload_folder路径
        upload_path = Path(upload_folder)
        if not upload_path.is_absolute():
            import os
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
        
        # 创建提取器
        extractors = ExtractorFactory.create_default_extractors(
            parser_service=parser_service,
            upload_folder=upload_path,
            baidu_table_ocr_provider=baidu_table_ocr_provider
        )
        
        # 创建Inpaint提供者
        inpaint_provider = InpaintProviderFactory.create_default_provider(
            inpainting_service=inpainting_service
        )
        
        return cls(
            upload_folder=upload_path,
            extractors=extractors,
            inpaint_provider=inpaint_provider,
            max_depth=kwargs.get('max_depth', 3),
            min_image_size=kwargs.get('min_image_size', 200),
            min_image_area=kwargs.get('min_image_area', 40000)
        )

