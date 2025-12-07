"""
AI Service - handles all AI model interactions
Based on demo.py and gemini_genai.py
TODO: use structured output API
"""
import os
import json
import re
import logging
import requests
from typing import List, Dict, Optional, Union
from textwrap import dedent
from google import genai
from google.genai import types
from PIL import Image
from .prompts import (
    get_outline_generation_prompt,
    get_outline_parsing_prompt,
    get_page_description_prompt,
    get_image_generation_prompt,
    get_image_edit_prompt,
    get_description_to_outline_prompt,
    get_description_split_prompt,
    get_outline_refinement_prompt,
    get_descriptions_refinement_prompt
)

logger = logging.getLogger(__name__)


class ProjectContext:
    """项目上下文数据类，统一管理 AI 需要的所有项目信息"""
    
    def __init__(self, project_or_dict, reference_files_content: Optional[List[Dict[str, str]]] = None):
        """
        Args:
            project_or_dict: 项目对象（Project model）或项目字典（project.to_dict()）
            reference_files_content: 参考文件内容列表
        """
        # 支持直接传入 Project 对象，避免 to_dict() 调用，提升性能
        if hasattr(project_or_dict, 'idea_prompt'):
            # 是 Project 对象
            self.idea_prompt = project_or_dict.idea_prompt
            self.outline_text = project_or_dict.outline_text
            self.description_text = project_or_dict.description_text
            self.creation_type = project_or_dict.creation_type or 'idea'
        else:
            # 是字典
            self.idea_prompt = project_or_dict.get('idea_prompt')
            self.outline_text = project_or_dict.get('outline_text')
            self.description_text = project_or_dict.get('description_text')
            self.creation_type = project_or_dict.get('creation_type', 'idea')
        
        self.reference_files_content = reference_files_content or []
    
    def to_dict(self) -> Dict:
        """转换为字典，方便传递"""
        return {
            'idea_prompt': self.idea_prompt,
            'outline_text': self.outline_text,
            'description_text': self.description_text,
            'creation_type': self.creation_type,
            'reference_files_content': self.reference_files_content
        }


class AIService:
    """Service for AI model interactions using Gemini"""
    
    def __init__(self, api_key: str, api_base: str = None):
        """Initialize AI service with API credentials"""
        # Always create HttpOptions, matching gemini_genai.py behavior
        self.client = genai.Client(
            http_options=types.HttpOptions(
                base_url=api_base
            ),
            api_key=api_key
        )
        self.text_model = "gemini-2.5-flash"
        self.image_model = "gemini-3-pro-image-preview"
    
    @staticmethod
    def extract_image_urls_from_markdown(text: str) -> List[str]:
        """
        从 markdown 文本中提取图片 URL
        
        Args:
            text: Markdown 文本，可能包含 ![](url) 格式的图片
            
        Returns:
            图片 URL 列表（包括 http/https URL 和 /files/mineru/ 开头的本地路径）
        """
        if not text:
            return []
        
        # 匹配 markdown 图片语法: ![](url) 或 ![alt](url)
        pattern = r'!\[.*?\]\((.*?)\)'
        matches = re.findall(pattern, text)
        
        # 过滤掉空字符串，支持 http/https URL 和 /files/mineru/ 开头的本地路径
        urls = []
        for url in matches:
            url = url.strip()
            if url and (url.startswith('http://') or url.startswith('https://') or url.startswith('/files/mineru/')):
                urls.append(url)
        
        return urls
    
    @staticmethod
    def remove_markdown_images(text: str) -> str:
        """
        从文本中移除 Markdown 图片链接，只保留 alt text（描述文字）
        
        Args:
            text: 包含 Markdown 图片语法的文本
            
        Returns:
            移除图片链接后的文本，保留描述文字
        """
        if not text:
            return text
        
        # 将 ![描述文字](url) 替换为 描述文字
        # 如果没有描述文字（空的 alt text），则完全删除该图片链接
        def replace_image(match):
            alt_text = match.group(1).strip()
            # 如果有描述文字，保留它；否则删除整个链接
            return alt_text if alt_text else ''
        
        pattern = r'!\[(.*?)\]\([^\)]+\)'
        cleaned_text = re.sub(pattern, replace_image, text)
        
        # 清理可能产生的多余空行
        cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
        
        return cleaned_text
    
    @staticmethod
    def _convert_mineru_path_to_local(mineru_path: str) -> Optional[str]:
        """
        将 /files/mineru/{extract_id}/{rel_path} 格式的路径转换为本地文件系统路径（支持前缀匹配）
        
        Args:
            mineru_path: MinerU URL 路径，格式为 /files/mineru/{extract_id}/{rel_path}
            
        Returns:
            本地文件系统路径，如果转换失败则返回 None
        """
        from utils.path_utils import find_mineru_file_with_prefix
        
        matched_path = find_mineru_file_with_prefix(mineru_path)
        return str(matched_path) if matched_path else None
    
    @staticmethod
    def download_image_from_url(url: str) -> Optional[Image.Image]:
        """
        从 URL 下载图片并返回 PIL Image 对象
        
        Args:
            url: 图片 URL
            
        Returns:
            PIL Image 对象，如果下载失败则返回 None
        """
        try:
            logger.debug(f"Downloading image from URL: {url}")
            response = requests.get(url, timeout=30, stream=True)
            response.raise_for_status()
            
            # 从响应内容创建 PIL Image
            image = Image.open(response.raw)
            # 确保图片被加载
            image.load()
            logger.debug(f"Successfully downloaded image: {image.size}, {image.mode}")
            return image
        except Exception as e:
            logger.error(f"Failed to download image from {url}: {str(e)}")
            return None
    
    def generate_outline(self, project_context: ProjectContext) -> List[Dict]:
        """
        Generate PPT outline from idea prompt
        Based on demo.py gen_outline()
        
        Args:
            project_context: 项目上下文对象，包含所有原始信息
            
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        outline_prompt = get_outline_generation_prompt(project_context)
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=outline_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        outline_text = response.text.strip().strip("```json").strip("```").strip()
        outline = json.loads(outline_text)
        return outline
    
    def parse_outline_text(self, project_context: ProjectContext) -> List[Dict]:
        """
        Parse user-provided outline text into structured outline format
        This method analyzes the text and splits it into pages without modifying the original text
        
        Args:
            project_context: 项目上下文对象，包含所有原始信息
        
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        parse_prompt = get_outline_parsing_prompt(project_context)
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=parse_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        outline_json = response.text.strip().strip("```json").strip("```").strip()
        outline = json.loads(outline_json)
        return outline
    
    def flatten_outline(self, outline: List[Dict]) -> List[Dict]:
        """
        Flatten outline structure to page list
        Based on demo.py flatten_outline()
        """
        pages = []
        for item in outline:
            if "part" in item and "pages" in item:
                # This is a part, expand its pages
                for page in item["pages"]:
                    page_with_part = page.copy()
                    page_with_part["part"] = item["part"]
                    pages.append(page_with_part)
            else:
                # This is a direct page
                pages.append(item)
        return pages
    
    def generate_page_description(self, project_context: ProjectContext, outline: List[Dict], 
                                 page_outline: Dict, page_index: int) -> str:
        """
        Generate description for a single page
        Based on demo.py gen_desc() logic
        
        Args:
            project_context: 项目上下文对象，包含所有原始信息
            outline: Complete outline
            page_outline: Outline for this specific page
            page_index: Page number (1-indexed)
        
        Returns:
            Text description for the page
        """
        part_info = f"\nThis page belongs to: {page_outline['part']}" if 'part' in page_outline else ""
        
        desc_prompt = get_page_description_prompt(
            project_context=project_context,
            outline=outline,
            page_outline=page_outline,
            page_index=page_index,
            part_info=part_info
        )
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=desc_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        page_desc = response.text
        return dedent(page_desc)
    
    def generate_outline_text(self, outline: List[Dict]) -> str:
        """
        Convert outline to text format for prompts
        Based on demo.py gen_outline_text()
        """
        text_parts = []
        for i, item in enumerate(outline, 1):
            if "part" in item and "pages" in item:
                text_parts.append(f"{i}. {item['part']}")
            else:
                text_parts.append(f"{i}. {item.get('title', 'Untitled')}")
        result = "\n".join(text_parts)
        return dedent(result)
    
    def generate_image_prompt(self, outline: List[Dict], page: Dict, 
                            page_desc: str, page_index: int, 
                            has_material_images: bool = False,
                            extra_requirements: Optional[str] = None) -> str:
        """
        Generate image generation prompt for a page
        Based on demo.py gen_prompts()
        
        Args:
            outline: Complete outline
            page: Page outline data
            page_desc: Page description text
            page_index: Page number (1-indexed)
            has_material_images: 是否有素材图片（从项目描述中提取的图片）
            extra_requirements: Optional extra requirements to apply to all pages
        
        Returns:
            Image generation prompt
        """
        outline_text = self.generate_outline_text(outline)
        
        # Determine current section
        if 'part' in page:
            current_section = page['part']
        else:
            current_section = f"{page.get('title', 'Untitled')}"
        
        # 在传给文生图模型之前，移除 Markdown 图片链接
        # 图片本身已经通过 additional_ref_images 传递，只保留文字描述
        cleaned_page_desc = self.remove_markdown_images(page_desc)
        
        prompt = get_image_generation_prompt(
            page_desc=cleaned_page_desc,
            outline_text=outline_text,
            current_section=current_section,
            has_material_images=has_material_images,
            extra_requirements=extra_requirements
        )
        
        return prompt
    
    def generate_image(self, prompt: str, ref_image_path: Optional[str] = None, 
                      aspect_ratio: str = "16:9", resolution: str = "2K",
                      additional_ref_images: Optional[List[Union[str, Image.Image]]] = None) -> Optional[Image.Image]:
        """
        Generate image using Gemini image model
        Based on gemini_genai.py gen_image()
        
        Args:
            prompt: Image generation prompt
            ref_image_path: Path to reference image (optional). If None, will generate based on prompt only.
            aspect_ratio: Image aspect ratio (currently not used, kept for compatibility)
            resolution: Image resolution (currently not used, kept for compatibility)
            additional_ref_images: 额外的参考图片列表，可以是本地路径、URL 或 PIL Image 对象
        
        Returns:
            PIL Image object or None if failed
        
        Raises:
            Exception with detailed error message if generation fails
        """
        try:
            logger.debug(f"Reference image: {ref_image_path}")
            if additional_ref_images:
                logger.debug(f"Additional reference images: {len(additional_ref_images)}")
            logger.debug(f"Config - aspect_ratio: {aspect_ratio}, resolution: {resolution}")

            # 构建 contents 列表，包含 prompt 和所有参考图片
            # 约定：如果有主参考图，则放在第一个索引，其后是文本 prompt，再后是其他参考图
            contents = []
            
            # 添加主参考图片（如果提供了路径，放在第一个位置）
            if ref_image_path:
                if not os.path.exists(ref_image_path):
                    raise FileNotFoundError(f"Reference image not found: {ref_image_path}")
                main_ref_image = Image.open(ref_image_path)
                contents.append(main_ref_image)
            
            # 文本 prompt 紧跟在主参考图之后（或成为第一个元素）
            contents.append(prompt)
            
            # 添加额外的参考图片
            if additional_ref_images:
                for ref_img in additional_ref_images:
                    if isinstance(ref_img, Image.Image):
                        # 已经是 PIL Image 对象
                        contents.append(ref_img)
                    elif isinstance(ref_img, str):
                        # 可能是本地路径或 URL
                        if os.path.exists(ref_img):
                            # 本地路径
                            contents.append(Image.open(ref_img))
                        elif ref_img.startswith('http://') or ref_img.startswith('https://'):
                            # URL，需要下载
                            downloaded_img = self.download_image_from_url(ref_img)
                            if downloaded_img:
                                contents.append(downloaded_img)
                            else:
                                logger.warning(f"Failed to download image from URL: {ref_img}, skipping...")
                        elif ref_img.startswith('/files/mineru/'):
                            # MinerU 本地文件路径，需要转换为文件系统路径（支持前缀匹配）
                            local_path = self._convert_mineru_path_to_local(ref_img)
                            if local_path and os.path.exists(local_path):
                                contents.append(Image.open(local_path))
                                logger.debug(f"Loaded MinerU image from local path: {local_path}")
                            else:
                                logger.warning(f"MinerU image file not found (with prefix matching): {ref_img}, skipping...")
                        else:
                            logger.warning(f"Invalid image reference: {ref_img}, skipping...")
            
            logger.debug(f"Calling Gemini API for image generation with {len(contents) - 1} reference images...")
            response = self.client.models.generate_content(
                model=self.image_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_modalities=['TEXT', 'IMAGE'],
                    image_config=types.ImageConfig(
                        aspect_ratio=aspect_ratio,
                        image_size=resolution
                    ),
                )
            )
            logger.debug("Gemini API call completed")
            
            logger.debug("API response received, checking parts...")
            for i, part in enumerate(response.parts):
                if part.text is not None:   
                    logger.debug(f"Part {i}: TEXT - {part.text[:100]}")
                else:
                    # Try to get image from part
                    try:
                        logger.debug(f"Part {i}: Attempting to extract image...")
                        image = part.as_image()
                        if image:
                            # Don't check image.size - it might not be a standard PIL Image yet
                            logger.debug(f"Successfully extracted image from part {i}")
                            return image
                    except Exception as e:
                        logger.debug(f"Part {i}: Failed to extract image - {str(e)}")
            
            # If we get here, no image was found in the response
            error_msg = "No image found in API response. "
            if response.parts:
                error_msg += f"Response had {len(response.parts)} parts but none contained valid images."
            else:
                error_msg += "Response had no parts."
            
            raise ValueError(error_msg)
            
        except Exception as e:
            error_detail = f"Error generating image: {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e
    
    def edit_image(self, prompt: str, current_image_path: str,
                  aspect_ratio: str = "16:9", resolution: str = "2K",
                  original_description: str = None,
                  additional_ref_images: Optional[List[Union[str, Image.Image]]] = None) -> Optional[Image.Image]:
        """
        Edit existing image with natural language instruction
        Uses current image as reference
        
        Args:
            prompt: Edit instruction
            current_image_path: Path to current page image
            aspect_ratio: Image aspect ratio
            resolution: Image resolution
            original_description: Original page description to include in prompt
            additional_ref_images: 额外的参考图片列表，可以是本地路径、URL 或 PIL Image 对象
        
        Returns:
            PIL Image object or None if failed
        """
        # Build edit instruction with original description if available
        edit_instruction = get_image_edit_prompt(
            edit_instruction=prompt,
            original_description=original_description
        )
        return self.generate_image(edit_instruction, current_image_path, aspect_ratio, resolution, additional_ref_images)
    
    def parse_description_to_outline(self, project_context: ProjectContext) -> List[Dict]:
        """
        从描述文本解析出大纲结构
        
        Args:
            project_context: 项目上下文对象，包含所有原始信息
        
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        parse_prompt = get_description_to_outline_prompt(project_context)
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=parse_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        outline_json = response.text.strip().strip("```json").strip("```").strip()
        outline = json.loads(outline_json)
        return outline
    
    def parse_description_to_page_descriptions(self, project_context: ProjectContext, outline: List[Dict]) -> List[str]:
        """
        从描述文本切分出每页描述
        
        Args:
            project_context: 项目上下文对象，包含所有原始信息
            outline: 已解析出的大纲结构
        
        Returns:
            List of page descriptions (strings), one for each page in the outline
        """
        split_prompt = get_description_split_prompt(project_context, outline)
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=split_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        descriptions_json = response.text.strip().strip("```json").strip("```").strip()
        descriptions = json.loads(descriptions_json)
        
        # 确保返回的是字符串列表
        if isinstance(descriptions, list):
            return [str(desc) for desc in descriptions]
        else:
            raise ValueError("Expected a list of page descriptions, but got: " + str(type(descriptions)))
    
    def refine_outline(self, current_outline: List[Dict], user_requirement: str,
                      project_context: ProjectContext,
                      previous_requirements: Optional[List[str]] = None) -> List[Dict]:
        """
        根据用户要求修改已有大纲
        
        Args:
            current_outline: 当前的大纲结构
            user_requirement: 用户的新要求
            project_context: 项目上下文对象，包含所有原始信息
            previous_requirements: 之前的修改要求列表（可选）
        
        Returns:
            修改后的大纲结构
        """
        refinement_prompt = get_outline_refinement_prompt(
            current_outline=current_outline,
            user_requirement=user_requirement,
            project_context=project_context,
            previous_requirements=previous_requirements
        )
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=refinement_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        outline_json = response.text.strip().strip("```json").strip("```").strip()
        outline = json.loads(outline_json)
        return outline
    
    def refine_descriptions(self, current_descriptions: List[Dict], user_requirement: str,
                           project_context: ProjectContext,
                           outline: List[Dict] = None,
                           previous_requirements: Optional[List[str]] = None) -> List[str]:
        """
        根据用户要求修改已有页面描述
        
        Args:
            current_descriptions: 当前的页面描述列表，每个元素包含 {index, title, description_content}
            user_requirement: 用户的新要求
            project_context: 项目上下文对象，包含所有原始信息
            outline: 完整的大纲结构（可选）
            previous_requirements: 之前的修改要求列表（可选）
        
        Returns:
            修改后的页面描述列表（字符串列表）
        """
        refinement_prompt = get_descriptions_refinement_prompt(
            current_descriptions=current_descriptions,
            user_requirement=user_requirement,
            project_context=project_context,
            outline=outline,
            previous_requirements=previous_requirements
        )
        
        response = self.client.models.generate_content(
            model=self.text_model,
            contents=refinement_prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=1000),
            ),
        )
        
        descriptions_json = response.text.strip().strip("```json").strip("```").strip()
        descriptions = json.loads(descriptions_json)
        
        # 确保返回的是字符串列表
        if isinstance(descriptions, list):
            return [str(desc) for desc in descriptions]
        else:
            raise ValueError("Expected a list of page descriptions, but got: " + str(type(descriptions)))

