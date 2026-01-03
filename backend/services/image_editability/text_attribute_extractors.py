"""
文字属性提取器 - 从文字区域图像中提取文字的视觉属性

包含：
- TextStyleResult: 文字样式数据结构
- TextAttributeExtractor: 提取器抽象接口
- CaptionModelTextAttributeExtractor: 基于Caption Model的默认实现
- TextAttributeExtractorRegistry: 提取器注册表
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional, Tuple, Union
from PIL import Image
from services.prompts import get_text_attribute_extraction_prompt

logger = logging.getLogger(__name__)


@dataclass
class TextStyleResult:
    """
    文字样式数据结构
    
    包含从文字区域图像中提取的视觉属性
    
    Note:
        字体大小不在此处提取，因为传入的是裁剪后的子图，无法准确估算。
        字体大小应由 PPTXBuilder.calculate_font_size 根据bbox计算。
    """
    # 字体颜色 RGB (0-255)
    font_color_rgb: Tuple[int, int, int] = (0, 0, 0)
    
    # 是否粗体
    is_bold: bool = False
    
    # 是否斜体
    is_italic: bool = False
    
    # 是否有下划线
    is_underline: bool = False
    
    # 文字对齐方式 - 可选 ('left', 'center', 'right', 'justify')
    text_alignment: Optional[str] = None
    
    # 置信度 (0.0-1.0)
    confidence: float = 1.0
    
    # 额外的元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        result = asdict(self)
        # 将 tuple 转换为 list 以便 JSON 序列化
        result['font_color_rgb'] = list(self.font_color_rgb)
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TextStyleResult':
        """从字典创建实例"""
        if 'font_color_rgb' in data and isinstance(data['font_color_rgb'], list):
            data['font_color_rgb'] = tuple(data['font_color_rgb'])
        return cls(**data)
    
    def get_hex_color(self) -> str:
        """获取十六进制颜色值"""
        r, g, b = self.font_color_rgb
        return f"#{r:02x}{g:02x}{b:02x}"


class TextAttributeExtractor(ABC):
    """
    文字属性提取器抽象接口
    
    用于从文字区域图像中提取文字的视觉属性，支持接入多种实现：
    - CaptionModelTextAttributeExtractor: 使用视觉语言模型（如Gemini）分析图像
    - 未来可扩展：基于传统CV的方法、专用OCR模型等
    """
    
    @abstractmethod
    def extract(
        self,
        image: Union[str, Image.Image],
        text_content: Optional[str] = None,
        **kwargs
    ) -> TextStyleResult:
        """
        从文字区域图像中提取文字样式属性
        
        Args:
            image: 文字区域的图像，可以是文件路径或PIL Image对象
            text_content: 文字内容（可选，某些实现可能用于辅助识别）
            **kwargs: 其他由具体实现自定义的参数
        
        Returns:
            TextStyleResult对象，包含提取的文字样式属性
        """
        pass
    
    @abstractmethod
    def supports_batch(self) -> bool:
        """
        是否支持批量处理
        
        Returns:
            如果支持批量处理返回True
        """
        pass
    
    def extract_batch(
        self,
        items: List[Tuple[Union[str, Image.Image], Optional[str]]],
        **kwargs
    ) -> List[TextStyleResult]:
        """
        批量提取文字样式属性
        
        默认实现：逐个调用extract方法
        子类可以覆盖此方法以实现更高效的批量处理
        
        Args:
            items: 列表，每个元素是 (image, text_content) 元组
            **kwargs: 其他参数
        
        Returns:
            TextStyleResult列表
        """
        results = []
        for image, text_content in items:
            try:
                result = self.extract(image, text_content, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"批量提取文字属性失败: {e}")
                # 返回默认结果
                results.append(TextStyleResult(confidence=0.0))
        return results


class CaptionModelTextAttributeExtractor(TextAttributeExtractor):
    """
    基于Caption Model（视觉语言模型）的文字属性提取器
    
    使用视觉语言模型（如Gemini）分析文字区域图像，
    通过生成JSON的方式获取字体颜色、是否粗体、是否斜体等属性。
    """
    @staticmethod
    def build_prompt(text_content: Optional[str] = None) -> str:
        """
        构建合并后的prompt
        如果text_content存在则插入提示，否则省略
        """
        if text_content:
            content_hint = f'图片中的文字内容是: "{text_content}"'
        else:
            content_hint = ""
        return get_text_attribute_extraction_prompt(content_hint=content_hint)
    
    def __init__(self, ai_service, prompt_template: Optional[str] = None):
        """
        初始化Caption Model文字属性提取器
        
        Args:
            ai_service: AIService实例（需要支持generate_json方法和图片输入）
            prompt_template: 自定义的prompt模板（可选），必须使用 {content_hint} 作为占位符
        """
        self.ai_service = ai_service
        self.prompt_template = prompt_template
    
    def supports_batch(self) -> bool:
        """当前实现不支持批量处理"""
        return False
    
    def extract(
        self,
        image: Union[str, Image.Image],
        text_content: Optional[str] = None,
        **kwargs
    ) -> TextStyleResult:
        """
        使用Caption Model提取文字样式属性
        
        Args:
            image: 文字区域的图像
            text_content: 文字内容（可选，用于辅助识别）
            **kwargs: 
                - thinking_budget: int, 思考预算，默认500
        
        Returns:
            TextStyleResult对象
        """
        thinking_budget = kwargs.get('thinking_budget', 500)
        
        try:
            # 准备图片
            if isinstance(image, str):
                pil_image = Image.open(image)
            else:
                pil_image = image
            
            # 构建prompt
            # 统一使用 content_hint 格式
            if text_content:
                content_hint = f'图片中的文字内容是: "{text_content}"'
            else:
                content_hint = ""
            
            if self.prompt_template:
                # 自定义模板必须使用 {content_hint} 占位符
                prompt = self.prompt_template.format(content_hint=content_hint)
            else:
                prompt = get_text_attribute_extraction_prompt(content_hint=content_hint)
            
            # 调用AI服务（需要支持图片输入的generate_json）
            # 这里假设text_provider支持带图片的generate方法
            result_json = self._call_vision_model(pil_image, prompt, thinking_budget)
            
            # 解析结果
            return self._parse_result(result_json)
        
        except Exception as e:
            logger.error(f"CaptionModelTextAttributeExtractor提取失败: {e}", exc_info=True)
            return TextStyleResult(confidence=0.0, metadata={'error': str(e)})
    
    def _call_vision_model(self, image: Image.Image, prompt: str, thinking_budget: int) -> Dict[str, Any]:
        """
        调用视觉语言模型
        
        Args:
            image: PIL Image对象
            prompt: 提示词
            thinking_budget: 思考预算
        
        Returns:
            解析后的JSON结果
        """
        import tempfile
        import json
        
        # 保存临时图片文件
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            tmp_path = tmp_file.name
            image.save(tmp_path)
        
        try:
            # 使用text_provider的generate_with_image方法（如果支持）
            # 或者回退到generate_text方法
            if hasattr(self.ai_service.text_provider, 'generate_with_image'):
                response_text = self.ai_service.text_provider.generate_with_image(
                    prompt=prompt,
                    image_path=tmp_path,
                    thinking_budget=thinking_budget
                )
            elif hasattr(self.ai_service.text_provider, 'generate_text_with_images'):
                response_text = self.ai_service.text_provider.generate_text_with_images(
                    prompt=prompt,
                    images=[tmp_path],
                    thinking_budget=thinking_budget
                )
            else:
                # 回退方案：使用基础的generate_text
                # 但这可能无法处理图片，所以会返回默认结果
                logger.warning("text_provider不支持图片输入，使用默认结果")
                return {}
            
            # 清理响应文本
            cleaned_text = response_text.strip().strip("```json").strip("```").strip()
            return json.loads(cleaned_text)
        
        finally:
            import os
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    
    @staticmethod
    def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        """
        将十六进制颜色转换为RGB元组
        
        Args:
            hex_color: 十六进制颜色，如 "#FF6B6B" 或 "FF6B6B"
        
        Returns:
            RGB元组 (R, G, B)
        """
        # 移除 # 前缀
        hex_color = hex_color.lstrip('#')
        
        # 处理简写格式 (如 #FFF -> #FFFFFF)
        if len(hex_color) == 3:
            hex_color = ''.join(c * 2 for c in hex_color)
        
        if len(hex_color) != 6:
            return (0, 0, 0)  # 无效格式，返回黑色
        
        try:
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
            return (r, g, b)
        except ValueError:
            return (0, 0, 0)
    
    def _parse_result(self, result_json: Dict[str, Any]) -> TextStyleResult:
        """
        解析AI返回的JSON结果
        
        Args:
            result_json: AI返回的JSON字典
        
        Returns:
            TextStyleResult对象
        """
        if not result_json:
            return TextStyleResult(confidence=0.0)
        
        try:
            # 解析颜色（十六进制格式）
            font_color_hex = result_json.get('font_color', '#000000')
            if isinstance(font_color_hex, str):
                font_color_rgb = self._hex_to_rgb(font_color_hex)
            else:
                font_color_rgb = (0, 0, 0)
            
            # 解析布尔值
            # is_bold = bool(result_json.get('is_bold', False))
            # is_italic = bool(result_json.get('is_italic', False))
            is_bold = False # 全局信息缺失的情况下，识别效果不佳，暂时改为统一False
            is_italic = False
            is_underline = bool(result_json.get('is_underline', False))
            
            # 解析文字对齐方式
            # text_alignment = result_json.get('text_alignment')
            text_alignment = 'left'
            if text_alignment not in ('left', 'center', 'right', 'justify', None):
                text_alignment = None
            
            return TextStyleResult(
                font_color_rgb=font_color_rgb,
                is_bold=is_bold,
                is_italic=is_italic,
                is_underline=is_underline,
                text_alignment=text_alignment,
                confidence=0.9,  # 模型返回的结果给予较高置信度
                metadata={'source': 'caption_model', 'raw_response': result_json}
            )
        
        except Exception as e:
            logger.error(f"解析结果失败: {e}")
            return TextStyleResult(confidence=0.0, metadata={'error': str(e)})
    
    def extract_batch_with_full_image(
        self,
        full_image: Union[str, Image.Image],
        text_elements: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, TextStyleResult]:
        """
        【新逻辑】使用全图一次性提取所有文本元素的样式属性
        
        优势：模型可以看到全局上下文，提高分析准确性
        
        Args:
            full_image: 完整的页面图片，可以是文件路径或PIL Image对象
            text_elements: 文本元素列表，每个元素包含：
                - element_id: 元素唯一标识
                - bbox: 边界框 [x0, y0, x1, y1]
                - content: 文字内容
            **kwargs:
                - thinking_budget: int, 思考预算，默认1000
        
        Returns:
            字典，key为element_id，value为TextStyleResult
        """
        import json
        import tempfile
        from services.prompts import get_batch_text_attribute_extraction_prompt
        
        thinking_budget = kwargs.get('thinking_budget', 1000)
        
        if not text_elements:
            return {}
        
        try:
            # 准备图片
            if isinstance(full_image, str):
                pil_image = Image.open(full_image)
                tmp_path = full_image  # 如果已经是路径，直接使用
                need_cleanup = False
            else:
                pil_image = full_image
                # 保存临时图片文件
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                    tmp_path = tmp_file.name
                    pil_image.save(tmp_path)
                need_cleanup = True
            
            # 构建文本元素的 JSON 描述
            elements_for_prompt = []
            for elem in text_elements:
                elements_for_prompt.append({
                    'element_id': elem['element_id'],
                    'bbox': elem['bbox'],
                    'content': elem['content']
                })
            
            text_elements_json = json.dumps(elements_for_prompt, ensure_ascii=False, indent=2)
            
            # 构建 prompt
            prompt = get_batch_text_attribute_extraction_prompt(text_elements_json)
            
            # 调用视觉语言模型
            try:
                if hasattr(self.ai_service.text_provider, 'generate_with_image'):
                    response_text = self.ai_service.text_provider.generate_with_image(
                        prompt=prompt,
                        image_path=tmp_path,
                        thinking_budget=thinking_budget
                    )
                elif hasattr(self.ai_service.text_provider, 'generate_text_with_images'):
                    response_text = self.ai_service.text_provider.generate_text_with_images(
                        prompt=prompt,
                        images=[tmp_path],
                        thinking_budget=thinking_budget
                    )
                else:
                    logger.warning("text_provider不支持图片输入，无法使用批量提取")
                    return {}
                
                # 清理响应文本并解析JSON
                cleaned_text = response_text.strip()
                # 移除可能的 markdown 代码块标记
                if cleaned_text.startswith("```json"):
                    cleaned_text = cleaned_text[7:]
                if cleaned_text.startswith("```"):
                    cleaned_text = cleaned_text[3:]
                if cleaned_text.endswith("```"):
                    cleaned_text = cleaned_text[:-3]
                cleaned_text = cleaned_text.strip()
                
                result_list = json.loads(cleaned_text)
                
                # 解析结果
                return self._parse_batch_result(result_list, text_elements)
                
            finally:
                if need_cleanup:
                    import os
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
        
        except Exception as e:
            logger.error(f"批量提取文字属性失败: {e}", exc_info=True)
            return {}
    
    def _parse_batch_result(
        self,
        result_list: List[Dict[str, Any]],
        original_elements: List[Dict[str, Any]]
    ) -> Dict[str, TextStyleResult]:
        """
        解析批量提取的 AI 返回结果
        
        Args:
            result_list: AI 返回的 JSON 列表，每个元素包含样式属性
            original_elements: 原始输入的元素列表，用于匹配 element_id
        
        Returns:
            字典，key 为 element_id，value 为 TextStyleResult
        """
        results = {}
        
        # 创建 element_id 到原始元素的映射，用于回退
        original_map = {elem['element_id']: elem for elem in original_elements}
        
        for item in result_list:
            try:
                element_id = item.get('element_id')
                if not element_id:
                    continue
                
                # 解析颜色（十六进制格式）
                font_color_hex = item.get('font_color', '#000000')
                if isinstance(font_color_hex, str):
                    font_color_rgb = self._hex_to_rgb(font_color_hex)
                else:
                    font_color_rgb = (0, 0, 0)
                
                # 解析布尔值
                is_bold = bool(item.get('is_bold', False))
                is_italic = bool(item.get('is_italic', False))
                is_underline = bool(item.get('is_underline', False))
                
                # 解析文字对齐方式
                text_alignment = item.get('text_alignment')
                if text_alignment not in ('left', 'center', 'right', 'justify', None):
                    text_alignment = None
                
                results[element_id] = TextStyleResult(
                    font_color_rgb=font_color_rgb,
                    is_bold=is_bold,
                    is_italic=is_italic,
                    is_underline=is_underline,
                    text_alignment=text_alignment,
                    confidence=0.9,
                    metadata={'source': 'batch_caption_model', 'raw_response': item}
                )
                
            except Exception as e:
                logger.warning(f"解析元素 {item.get('element_id', 'unknown')} 的样式失败: {e}")
                continue
        
        logger.info(f"批量解析完成: 成功 {len(results)}/{len(original_elements)} 个元素")
        return results


class TextAttributeExtractorRegistry:
    """
    文字属性提取器注册表
    
    管理不同元素类型应该使用哪个文字属性提取器：
    - 普通文本 → CaptionModelTextAttributeExtractor
    - 标题文本 → 可使用不同配置的提取器
    - 其他类型 → 默认提取器
    
    使用方式：
        >>> registry = TextAttributeExtractorRegistry()
        >>> registry.register('text', caption_extractor)
        >>> registry.register('title', title_extractor)
        >>> registry.register_default(caption_extractor)
        >>> 
        >>> extractor = registry.get_extractor('text')
        >>> extractor = registry.get_extractor('unknown_type')  # 返回默认提取器
    """
    
    # 预定义的元素类型分组
    TEXT_TYPES = {'text', 'title', 'paragraph', 'heading', 'header', 'footer'}
    TABLE_TEXT_TYPES = {'table_cell'}
    
    def __init__(self):
        """初始化注册表"""
        self._type_mapping: Dict[str, TextAttributeExtractor] = {}
        self._default_extractor: Optional[TextAttributeExtractor] = None
    
    def register(self, element_type: str, extractor: TextAttributeExtractor) -> 'TextAttributeExtractorRegistry':
        """
        注册元素类型到提取器的映射
        
        Args:
            element_type: 元素类型（如 'text', 'title' 等）
            extractor: 对应的提取器实例
        
        Returns:
            self，支持链式调用
        """
        self._type_mapping[element_type] = extractor
        logger.debug(f"注册文字属性提取器: {element_type} -> {extractor.__class__.__name__}")
        return self
    
    def register_types(self, element_types: List[str], extractor: TextAttributeExtractor) -> 'TextAttributeExtractorRegistry':
        """
        批量注册多个元素类型到同一个提取器
        
        Args:
            element_types: 元素类型列表
            extractor: 对应的提取器实例
        
        Returns:
            self，支持链式调用
        """
        for t in element_types:
            self.register(t, extractor)
        return self
    
    def register_default(self, extractor: TextAttributeExtractor) -> 'TextAttributeExtractorRegistry':
        """
        注册默认提取器（当没有特定类型映射时使用）
        
        Args:
            extractor: 默认提取器实例
        
        Returns:
            self，支持链式调用
        """
        self._default_extractor = extractor
        logger.debug(f"注册默认文字属性提取器: {extractor.__class__.__name__}")
        return self
    
    def get_extractor(self, element_type: Optional[str]) -> Optional[TextAttributeExtractor]:
        """
        根据元素类型获取对应的提取器
        
        Args:
            element_type: 元素类型，None表示使用默认提取器
        
        Returns:
            对应的提取器，如果没有注册则返回默认提取器
        """
        if element_type is None:
            return self._default_extractor
        
        # 先查找精确匹配
        if element_type in self._type_mapping:
            return self._type_mapping[element_type]
        
        # 返回默认提取器
        return self._default_extractor
    
    def get_all_extractors(self) -> List[TextAttributeExtractor]:
        """
        获取所有已注册的提取器（去重）
        
        Returns:
            提取器列表
        """
        extractors = list(set(self._type_mapping.values()))
        if self._default_extractor and self._default_extractor not in extractors:
            extractors.append(self._default_extractor)
        return extractors
    
    @classmethod
    def create_default(
        cls,
        caption_extractor: Optional[TextAttributeExtractor] = None
    ) -> 'TextAttributeExtractorRegistry':
        """
        创建默认配置的注册表
        
        默认配置：
        - 所有文本类型 → CaptionModelTextAttributeExtractor
        - 其他类型 → 默认提取器
        
        Args:
            caption_extractor: Caption Model提取器实例
        
        Returns:
            配置好的注册表实例
        """
        registry = cls()
        
        if not caption_extractor:
            logger.warning("创建TextAttributeExtractorRegistry时未提供任何extractor")
            return registry
        
        # 设置默认提取器
        registry.register_default(caption_extractor)
        
        # 所有文本类型使用相同的提取器
        registry.register_types(list(cls.TEXT_TYPES), caption_extractor)
        registry.register_types(list(cls.TABLE_TEXT_TYPES), caption_extractor)
        
        logger.info(f"创建默认TextAttributeExtractorRegistry: "
                   f"默认提取器->{caption_extractor.__class__.__name__}")
        
        return registry

