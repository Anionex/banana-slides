"""
Inpaint提供者 - 抽象不同的inpaint实现

提供多种重绘方法：
1. DefaultInpaintProvider - 基于mask的精确区域重绘（使用Volcengine Inpainting服务）
2. GenerativeEditInpaintProvider - 基于生成式大模型的整图编辑重绘（如Gemini图片编辑）
3. BaiduInpaintProvider - 基于百度图像修复API的区域重绘
4. HybridInpaintProvider - 混合方法：先百度修复去除文字，再生成式提升画质

以及注册表：
- InpaintProviderRegistry - 元素类型到重绘方法的映射注册表
"""
import logging
import tempfile
from abc import ABC, abstractmethod
from typing import List, Optional, Dict
from PIL import Image

logger = logging.getLogger(__name__)


class InpaintProvider(ABC):
    """
    Inpaint提供者抽象接口
    
    用于抽象不同的inpaint方法，支持接入多种实现：
    - 基于InpaintingService的实现（当前默认）
    - Gemini API实现
    - SD/SDXL等其他模型实现
    - 第三方API实现
    """
    
    @abstractmethod
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        对图像中指定区域进行inpaint处理
        
        Args:
            image: 原始PIL图像对象
            bboxes: 边界框列表，每个bbox格式为 (x0, y0, x1, y1)
            types: 可选的元素类型列表，与bboxes一一对应（如 'text', 'image', 'table'等）
            **kwargs: 其他由具体实现自定义的参数
        
        Returns:
            处理后的PIL图像对象，失败返回None
        """
        pass


class DefaultInpaintProvider(InpaintProvider):
    """
    基于InpaintingService的默认Inpaint提供者
    
    这是当前系统使用的实现，调用已有的InpaintingService
    """
    
    def __init__(self, inpainting_service):
        """
        初始化默认Inpaint提供者
        
        Args:
            inpainting_service: InpaintingService实例
        """
        self.inpainting_service = inpainting_service
    
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        使用InpaintingService处理inpaint
        
        支持的kwargs参数：
        - expand_pixels: int, 扩展像素数，默认10
        - merge_bboxes: bool, 是否合并bbox，默认False
        - merge_threshold: int, 合并阈值，默认20
        - save_mask_path: str, mask保存路径，可选
        - full_page_image: Image.Image, 完整页面图像（用于Gemini），可选
        - crop_box: tuple, 裁剪框 (x0, y0, x1, y1)，可选
        """
        expand_pixels = kwargs.get('expand_pixels', 10)
        merge_bboxes = kwargs.get('merge_bboxes', False)
        merge_threshold = kwargs.get('merge_threshold', 20)
        save_mask_path = kwargs.get('save_mask_path')
        full_page_image = kwargs.get('full_page_image')
        crop_box = kwargs.get('crop_box')
        
        try:
            result_img = self.inpainting_service.remove_regions_by_bboxes(
                image=image,
                bboxes=bboxes,
                expand_pixels=expand_pixels,
                merge_bboxes=merge_bboxes,
                merge_threshold=merge_threshold,
                save_mask_path=save_mask_path,
                full_page_image=full_page_image,
                crop_box=crop_box
            )
            return result_img
        except Exception as e:
            logger.error(f"DefaultInpaintProvider处理失败: {e}", exc_info=True)
            return None


class GenerativeEditInpaintProvider(InpaintProvider):
    """
    基于生成式大模型图片编辑的Inpaint提供者
    
    使用生成式大模型（如Gemini的图片编辑功能）通过自然语言指令移除图片中的文字、图标等元素。
    
    与DefaultInpaintProvider的区别：
    - DefaultInpaintProvider: 基于mask的精确区域重绘（需要准确的bbox）
    - GenerativeEditInpaintProvider: 整图生成式编辑（通过prompt描述要移除的内容）
    
    优点：不需要精确的bbox，大模型自动理解并移除相关元素
    缺点：可能改变背景细节，生成速度较慢，消耗更多token
    
    适用场景：
    - bbox不够精确时
    - 需要移除复杂或分散的元素时
    - 作为mask-based方法的备选方案
    """
    
    def __init__(self, ai_service, aspect_ratio: str = "16:9", resolution: str = "2K"):
        """
        初始化生成式编辑Inpaint提供者
        
        Args:
            ai_service: AIService实例（需要支持edit_image方法）
            aspect_ratio: 目标宽高比
            resolution: 目标分辨率
        """
        self.ai_service = ai_service
        self.aspect_ratio = aspect_ratio
        self.resolution = resolution
    
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        使用生成式大模型编辑生成干净背景
        
        注意：此方法忽略bboxes参数，通过大模型自动识别并移除所有文字和图标
        
        支持的kwargs参数：
        - aspect_ratio: str, 宽高比，默认使用初始化时的值
        - resolution: str, 分辨率，默认使用初始化时的值
        """
        aspect_ratio = kwargs.get('aspect_ratio', self.aspect_ratio)
        resolution = kwargs.get('resolution', self.resolution)
        
        try:
            from services.prompts import get_clean_background_prompt
            
            # 获取清理背景的prompt
            edit_instruction = get_clean_background_prompt()
            
            # 保存临时图片文件（AI服务需要文件路径）
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                tmp_path = tmp_file.name
                image.save(tmp_path)
            
            logger.info("GenerativeEditInpaintProvider: 开始生成式编辑重绘...")
            
            # 调用AI服务编辑图片
            clean_bg_image = self.ai_service.edit_image(
                prompt=edit_instruction,
                current_image_path=tmp_path,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                original_description=None,
                additional_ref_images=None
            )
            
            if not clean_bg_image:
                logger.error("GenerativeEditInpaintProvider: 生成式编辑返回空结果")
                return None
            
            # 转换为PIL Image
            if not isinstance(clean_bg_image, Image.Image):
                # Google GenAI返回自己的Image类型，需要提取_pil_image
                if hasattr(clean_bg_image, '_pil_image'):
                    clean_bg_image = clean_bg_image._pil_image
                else:
                    logger.error(f"GenerativeEditInpaintProvider: 未知的图片类型: {type(clean_bg_image)}")
                    return None
            
            logger.info("GenerativeEditInpaintProvider: 重绘完成")
            return clean_bg_image
        
        except Exception as e:
            logger.error(f"GenerativeEditInpaintProvider处理失败: {e}", exc_info=True)
            return None


class BaiduInpaintProvider(InpaintProvider):
    """
    基于百度图像修复API的Inpaint提供者
    
    使用百度AI在指定矩形区域去除遮挡物并用背景内容填充。
    
    特点：
    - 基于bbox的精确区域修复
    - 快速响应，使用背景内容智能填充
    - 适合去除文字、水印等规则区域
    
    注意：修复质量可能不如生成式模型，但速度快且稳定
    """
    
    def __init__(self, baidu_inpainting_provider):
        """
        初始化百度图像修复提供者
        
        Args:
            baidu_inpainting_provider: BaiduInpaintingProvider实例（来自ai_providers.image）
        """
        self._provider = baidu_inpainting_provider
    
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        使用百度图像修复API处理指定区域
        
        支持的kwargs参数：
        - expand_pixels: int, 扩展像素数，默认2
        """
        expand_pixels = kwargs.get('expand_pixels', 2)
        
        try:
            logger.info(f"BaiduInpaintProvider: 开始修复 {len(bboxes)} 个区域...")
            
            result_image = self._provider.inpaint_bboxes(
                image=image,
                bboxes=bboxes,
                expand_pixels=expand_pixels
            )
            
            if result_image:
                logger.info("BaiduInpaintProvider: 修复完成")
            else:
                logger.warning("BaiduInpaintProvider: 修复返回空结果")
            
            return result_image
        
        except Exception as e:
            logger.error(f"BaiduInpaintProvider处理失败: {e}", exc_info=True)
            return None


class HybridInpaintProvider(InpaintProvider):
    """
    混合Inpaint提供者 - 百度修复 + 生成式画质提升
    
    工作流程：
    1. 先使用百度图像修复API去除指定区域的内容（如文字、水印）
    2. 再使用生成式大模型（如Gemini）提升整体画质，保持内容不变
    
    优点：
    - 百度修复快速精确地去除文字，不会遗漏
    - 生成式模型提升画质，使修复痕迹更自然
    
    适用场景：
    - 需要精确去除文字且保证高画质的场景
    - 单独使用生成式模型容易遗漏文字的情况
    """
    
    def __init__(
        self,
        baidu_provider: BaiduInpaintProvider,
        generative_provider: 'GenerativeEditInpaintProvider',
        enhance_quality: bool = True
    ):
        """
        初始化混合Inpaint提供者
        
        Args:
            baidu_provider: 百度图像修复提供者
            generative_provider: 生成式编辑提供者（用于画质提升）
            enhance_quality: 是否在百度修复后使用生成式模型提升画质，默认True
        """
        self._baidu_provider = baidu_provider
        self._generative_provider = generative_provider
        self._enhance_quality = enhance_quality
    
    def inpaint_regions(
        self,
        image: Image.Image,
        bboxes: List[tuple],
        types: Optional[List[str]] = None,
        **kwargs
    ) -> Optional[Image.Image]:
        """
        混合处理：先百度修复，再生成式画质提升
        
        支持的kwargs参数：
        - expand_pixels: int, 百度修复的扩展像素数，默认2
        - enhance_quality: bool, 是否提升画质，默认使用初始化时的值
        - aspect_ratio: str, 画质提升的宽高比
        - resolution: str, 画质提升的分辨率
        """
        expand_pixels = kwargs.get('expand_pixels', 2)
        enhance_quality = kwargs.get('enhance_quality', self._enhance_quality)
        
        try:
            # Step 1: 百度图像修复 - 精确去除文字
            logger.info(f"HybridInpaintProvider Step 1: 百度修复 {len(bboxes)} 个区域...")
            
            repaired_image = self._baidu_provider.inpaint_regions(
                image=image,
                bboxes=bboxes,
                types=types,
                expand_pixels=expand_pixels
            )
            
            if repaired_image is None:
                logger.error("HybridInpaintProvider: 百度修复失败")
                return None
            
            logger.info("HybridInpaintProvider: 百度修复完成")
            
            # Step 2: 生成式画质提升（可选）
            if enhance_quality and self._generative_provider:
                logger.info("HybridInpaintProvider Step 2: 生成式画质提升...")
                
                # 使用专门的画质提升prompt，传入被修复的区域信息
                enhanced_image = self._enhance_image_quality(
                    repaired_image,
                    inpainted_bboxes=bboxes,  # 传入被修复的区域
                    aspect_ratio=kwargs.get('aspect_ratio'),
                    resolution=kwargs.get('resolution')
                )
                
                if enhanced_image:
                    logger.info("HybridInpaintProvider: 画质提升完成")
                    return enhanced_image
                else:
                    logger.warning("HybridInpaintProvider: 画质提升失败，返回百度修复结果")
                    return repaired_image
            else:
                logger.info("HybridInpaintProvider: 跳过画质提升")
                return repaired_image
        
        except Exception as e:
            logger.error(f"HybridInpaintProvider处理失败: {e}", exc_info=True)
            return None
    
    def _enhance_image_quality(
        self,
        image: Image.Image,
        inpainted_bboxes: Optional[List[tuple]] = None,
        aspect_ratio: Optional[str] = None,
        resolution: Optional[str] = None
    ) -> Optional[Image.Image]:
        """
        使用生成式模型提升图像画质
        
        Args:
            image: 需要提升画质的图像
            inpainted_bboxes: 被修复区域的bbox列表，格式为 [(x0, y0, x1, y1), ...]
            aspect_ratio: 宽高比（可选）
            resolution: 分辨率（可选）
        
        Returns:
            提升画质后的图像
        """
        try:
            # 保存临时图片
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                tmp_path = tmp_file.name
                image.save(tmp_path)
            
            # 将bboxes转换为百分比形式（相对于图片宽高）
            regions = None
            if inpainted_bboxes:
                # 先合并上下间距很小的bbox（减少传递给生成式模型的区域数量）
                from utils.mask_utils import merge_vertical_nearby_bboxes
                original_count = len(inpainted_bboxes)
                merged_bboxes = merge_vertical_nearby_bboxes(inpainted_bboxes)
                if len(merged_bboxes) < original_count:
                    logger.info(f"合并相邻文字行后：{original_count} -> {len(merged_bboxes)} 个区域")
                
                img_width, img_height = image.size
                regions = []
                for bbox in merged_bboxes:
                    x0, y0, x1, y1 = bbox
                    # 转换为百分比（0-100）
                    regions.append({
                        'left': round(x0 / img_width * 100, 1),
                        'top': round(y0 / img_height * 100, 1),
                        'right': round(x1 / img_width * 100, 1),
                        'bottom': round(y1 / img_height * 100, 1),
                        'width_percent': round((x1 - x0) / img_width * 100, 1),
                        'height_percent': round((y1 - y0) / img_height * 100, 1)
                    })
                logger.info(f"传递 {len(regions)} 个被修复区域给生成式模型（百分比坐标）")
            
            # 获取画质提升的prompt（包含被修复区域信息）
            from services.prompts import get_quality_enhancement_prompt
            enhance_prompt = get_quality_enhancement_prompt(inpainted_regions=regions)
            
            # 使用AI服务的aspect_ratio和resolution（如果提供）
            ar = aspect_ratio or self._generative_provider.aspect_ratio
            res = resolution or self._generative_provider.resolution
            
            # 调用AI服务
            enhanced_image = self._generative_provider.ai_service.edit_image(
                prompt=enhance_prompt,
                current_image_path=tmp_path,
                aspect_ratio=ar,
                resolution=res,
                original_description=None,
                additional_ref_images=None
            )
            
            if not enhanced_image:
                return None
            
            # 转换为PIL Image
            if not isinstance(enhanced_image, Image.Image):
                if hasattr(enhanced_image, '_pil_image'):
                    enhanced_image = enhanced_image._pil_image
                else:
                    logger.error(f"未知的图片类型: {type(enhanced_image)}")
                    return None
            
            return enhanced_image
        
        except Exception as e:
            logger.error(f"画质提升失败: {e}", exc_info=True)
            return None


class InpaintProviderRegistry:
    """
    元素类型到重绘方法的映射注册表
    
    根据元素类型选择合适的重绘方法：
    - 文本元素 → DefaultInpaintProvider（mask-based精确移除）
    - 表格元素 → DefaultInpaintProvider（保持表格框架）
    - 图片/图表元素 → GenerativeEditInpaintProvider（整图重绘）
    - 其他类型 → 默认提供者
    
    使用方式：
        >>> registry = InpaintProviderRegistry()
        >>> registry.register('text', mask_provider)
        >>> registry.register('image', generative_provider)
        >>> registry.register_default(mask_provider)
        >>> 
        >>> provider = registry.get_provider('text')  # 返回 mask_provider
        >>> provider = registry.get_provider('chart')  # 返回 generative_provider
    """
    
    # 预定义的元素类型分组
    TEXT_TYPES = {'text', 'title', 'paragraph', 'header', 'footer'}
    TABLE_TYPES = {'table', 'table_cell'}
    IMAGE_TYPES = {'image', 'figure', 'chart', 'diagram'}
    
    def __init__(self):
        """初始化注册表"""
        self._type_mapping: Dict[str, InpaintProvider] = {}
        self._default_provider: Optional[InpaintProvider] = None
    
    def register(self, element_type: str, provider: InpaintProvider) -> 'InpaintProviderRegistry':
        """
        注册元素类型到重绘方法的映射
        
        Args:
            element_type: 元素类型（如 'text', 'image' 等）
            provider: 对应的重绘提供者实例
        
        Returns:
            self，支持链式调用
        """
        self._type_mapping[element_type] = provider
        logger.debug(f"注册重绘提供者: {element_type} -> {provider.__class__.__name__}")
        return self
    
    def register_types(self, element_types: List[str], provider: InpaintProvider) -> 'InpaintProviderRegistry':
        """
        批量注册多个元素类型到同一个重绘方法
        
        Args:
            element_types: 元素类型列表
            provider: 对应的重绘提供者实例
        
        Returns:
            self，支持链式调用
        """
        for t in element_types:
            self.register(t, provider)
        return self
    
    def register_default(self, provider: InpaintProvider) -> 'InpaintProviderRegistry':
        """
        注册默认重绘方法（当没有特定类型映射时使用）
        
        Args:
            provider: 默认重绘提供者实例
        
        Returns:
            self，支持链式调用
        """
        self._default_provider = provider
        logger.debug(f"注册默认重绘提供者: {provider.__class__.__name__}")
        return self
    
    def get_provider(self, element_type: Optional[str]) -> Optional[InpaintProvider]:
        """
        根据元素类型获取对应的重绘方法
        
        Args:
            element_type: 元素类型，None表示使用默认提供者
        
        Returns:
            对应的重绘提供者，如果没有注册则返回默认提供者
        """
        if element_type is None:
            return self._default_provider
        
        # 先查找精确匹配
        if element_type in self._type_mapping:
            return self._type_mapping[element_type]
        
        # 返回默认提供者
        return self._default_provider
    
    def get_all_providers(self) -> List[InpaintProvider]:
        """
        获取所有已注册的重绘提供者（去重）
        
        Returns:
            重绘提供者列表
        """
        providers = list(set(self._type_mapping.values()))
        if self._default_provider and self._default_provider not in providers:
            providers.append(self._default_provider)
        return providers
    
    @classmethod
    def create_default(
        cls,
        mask_provider: Optional[InpaintProvider] = None,
        generative_provider: Optional[InpaintProvider] = None
    ) -> 'InpaintProviderRegistry':
        """
        创建默认配置的注册表
        
        默认配置：
        - 文本类型 → mask-based（精确移除文字区域）
        - 表格类型 → mask-based（保持表格框架，只移除单元格内容）
        - 图片/图表类型 → generative（整图重绘，处理复杂图形）
        - 其他类型 → mask-based（默认）
        
        Args:
            mask_provider: 基于mask的重绘提供者（DefaultInpaintProvider）
            generative_provider: 生成式重绘提供者（GenerativeEditInpaintProvider）
        
        Returns:
            配置好的注册表实例
        """
        registry = cls()
        
        # 如果没有提供任何provider，返回空注册表
        if not mask_provider and not generative_provider:
            logger.warning("创建InpaintProviderRegistry时未提供任何provider")
            return registry
        
        # 设置默认提供者（优先使用mask_provider）
        default_provider = mask_provider or generative_provider
        registry.register_default(default_provider)
        
        # 文本类型使用mask-based
        if mask_provider:
            registry.register_types(list(cls.TEXT_TYPES), mask_provider)
            registry.register_types(list(cls.TABLE_TYPES), mask_provider)
        
        # 图片类型使用generative（如果可用），否则使用mask-based
        image_provider = generative_provider or mask_provider
        if image_provider:
            registry.register_types(list(cls.IMAGE_TYPES), image_provider)
        
        logger.info(f"创建默认InpaintProviderRegistry: "
                   f"文本/表格->{mask_provider.__class__.__name__ if mask_provider else 'None'}, "
                   f"图片->{image_provider.__class__.__name__ if image_provider else 'None'}")
        
        return registry

