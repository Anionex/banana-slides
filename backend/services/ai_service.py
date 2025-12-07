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
import time
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
    get_description_split_prompt
)

logger = logging.getLogger(__name__)


def get_api_config_from_db():
    """
    Get API configuration from database or fallback to environment variables

    Returns:
        dict with keys: api_key, api_base, image_api_key, image_api_base
    """
    try:
        from models.settings import Settings

        return {
            'api_key': Settings.get_value('GOOGLE_API_KEY', os.getenv('GOOGLE_API_KEY', '')),
            'api_base': Settings.get_value('GOOGLE_API_BASE', os.getenv('GOOGLE_API_BASE', '')),
            'image_api_key': Settings.get_value('GOOGLE_IMAGE_API_KEY', os.getenv('GOOGLE_IMAGE_API_KEY', '')),
            'image_api_base': Settings.get_value('GOOGLE_IMAGE_API_BASE', os.getenv('GOOGLE_IMAGE_API_BASE', '')),
        }
    except Exception as e:
        logger.warning(f"Failed to get API config from database, using environment variables: {e}")
        return {
            'api_key': os.getenv('GOOGLE_API_KEY', ''),
            'api_base': os.getenv('GOOGLE_API_BASE', ''),
            'image_api_key': os.getenv('GOOGLE_IMAGE_API_KEY', ''),
            'image_api_base': os.getenv('GOOGLE_IMAGE_API_BASE', ''),
        }


class AIService:
    """Service for AI model interactions using Gemini"""

    def __init__(self, api_key: str, api_base: str = None,
                 image_api_key: str = None, image_api_base: str = None):
        """Initialize AI service with API credentials

        Args:
            api_key: API key for text generation
            api_base: API base URL for text generation
            image_api_key: API key for image generation (optional, defaults to api_key)
            image_api_base: API base URL for image generation (optional, defaults to api_base)
        """
        # Validate API key is present
        if not api_key or api_key.strip() == '':
            raise ValueError(
                "API密钥未配置！请在前端页面右上角点击 ⚙️ 设置 按钮，"
                "选择 '🚀 中转API（推荐）' 预设并输入你的API Key。"
                "推荐使用中转API: https://apipro.maynor1024.live/"
            )

        # Text client - for gemini-2.5-flash (text generation)
        self.text_client = genai.Client(
            http_options=types.HttpOptions(
                base_url=api_base
            ),
            api_key=api_key
        )

        # Image client - for gemini-3-pro-image-preview (image generation)
        # Can use different API endpoint and key
        self.image_client = genai.Client(
            http_options=types.HttpOptions(
                base_url=image_api_base or api_base
            ),
            api_key=image_api_key or api_key
        )

        # Keep legacy client for backward compatibility (文本生成)
        self.client = self.text_client

        self.text_model = "gemini-2.5-flash"
        self.image_model = "gemini-3-pro-image-preview"

        # Store image API credentials for chat-compatible format
        self.image_api_key = image_api_key or api_key
        self.image_api_base = image_api_base or api_base

        # Detect if image API uses chat-compatible format (OpenAI-style)
        # Third-party proxies typically use /v1/chat/completions endpoint
        self.use_chat_format = self._should_use_chat_format(self.image_api_base)
        logger.info(f"Image API format: {'Chat-compatible' if self.use_chat_format else 'Native Gemini SDK'}")

    def _should_use_chat_format(self, api_base: str) -> bool:
        """
        Detect if the API base URL should use chat-compatible format

        Args:
            api_base: API base URL

        Returns:
            True if should use chat format, False for native SDK format
        """
        if not api_base:
            return False

        # Official Google API uses native SDK format
        if 'generativelanguage.googleapis.com' in api_base or 'googleapis.com' in api_base:
            return False

        # Third-party proxies typically use chat-compatible format
        # Common patterns: api.*, apipro.*, etc.
        if any(pattern in api_base for pattern in ['api.', 'apipro.', '/v1/', 'openai']):
            return True

        return False
    
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
    
    def generate_outline(self, idea_prompt: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> List[Dict]:
        """
        Generate PPT outline from idea prompt
        Based on demo.py gen_outline()
        
        Args:
            idea_prompt: User's idea/request
            reference_files_content: Optional list of reference file contents
            
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        outline_prompt = get_outline_generation_prompt(idea_prompt, reference_files_content)
        
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
    
    def parse_outline_text(self, outline_text: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> List[Dict]:
        """
        Parse user-provided outline text into structured outline format
        This method analyzes the text and splits it into pages without modifying the original text
        
        Args:
            outline_text: User-provided outline text (may contain sections, titles, bullet points, etc.)
            reference_files_content: Optional list of reference file contents
        
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        parse_prompt = get_outline_parsing_prompt(outline_text, reference_files_content)
        
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
    
    def generate_page_description(self, idea_prompt: str, outline: List[Dict], 
                                 page_outline: Dict, page_index: int,
                                 reference_files_content: Optional[List[Dict[str, str]]] = None) -> str:
        """
        Generate description for a single page
        Based on demo.py gen_desc() logic
        
        Args:
            idea_prompt: Original user idea
            outline: Complete outline
            page_outline: Outline for this specific page
            page_index: Page number (1-indexed)
            reference_files_content: Optional reference files content
        
        Returns:
            Text description for the page
        """
        part_info = f"\nThis page belongs to: {page_outline['part']}" if 'part' in page_outline else ""
        
        desc_prompt = get_page_description_prompt(
            idea_prompt=idea_prompt,
            outline=outline,
            page_outline=page_outline,
            page_index=page_index,
            part_info=part_info,
            reference_files_content=reference_files_content
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
        
        prompt = get_image_generation_prompt(
            page_desc=page_desc,
            outline_text=outline_text,
            current_section=current_section,
            has_material_images=has_material_images,
            extra_requirements=extra_requirements
        )
        
        return prompt
    
    def _generate_image_chat_format(self, prompt: str, ref_image_path: Optional[str] = None,
                                   aspect_ratio: str = "16:9", resolution: str = "2K",
                                   additional_ref_images: Optional[List[Union[str, Image.Image]]] = None) -> Optional[Image.Image]:
        """
        Generate image using chat-compatible format (/v1/chat/completions endpoint)

        Args:
            prompt: Image generation prompt
            ref_image_path: Path to reference image (optional)
            aspect_ratio: Image aspect ratio
            resolution: Image resolution
            additional_ref_images: Additional reference images

        Returns:
            PIL Image object or None if failed
        """
        import base64
        from io import BytesIO

        try:
            # Build messages array with text and images
            content_items = []

            # Add text prompt
            content_items.append({
                "type": "text",
                "text": prompt
            })

            # Add main reference image if provided
            if ref_image_path and os.path.exists(ref_image_path):
                with Image.open(ref_image_path) as img:
                    buffered = BytesIO()
                    img.save(buffered, format="PNG")
                    img_base64 = base64.b64encode(buffered.getvalue()).decode()
                    content_items.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{img_base64}"
                        }
                    })

            # Add additional reference images
            if additional_ref_images:
                for ref_img in additional_ref_images:
                    img_obj = None
                    if isinstance(ref_img, Image.Image):
                        img_obj = ref_img
                    elif isinstance(ref_img, str):
                        if os.path.exists(ref_img):
                            img_obj = Image.open(ref_img)
                        elif ref_img.startswith('http://') or ref_img.startswith('https://'):
                            downloaded_img = self.download_image_from_url(ref_img)
                            if downloaded_img:
                                img_obj = downloaded_img
                        elif ref_img.startswith('/files/mineru/'):
                            local_path = self._convert_mineru_path_to_local(ref_img)
                            if local_path and os.path.exists(local_path):
                                img_obj = Image.open(local_path)

                    if img_obj:
                        buffered = BytesIO()
                        img_obj.save(buffered, format="PNG")
                        img_base64 = base64.b64encode(buffered.getvalue()).decode()
                        content_items.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{img_base64}"
                            }
                        })

            # Build request payload
            payload = {
                "model": self.image_model,
                "messages": [
                    {
                        "role": "user",
                        "content": content_items
                    }
                ],
                "max_tokens": 16384,  # Increased max_tokens to handle larger image responses
                "stream": False  # Ensure we get the complete response at once
            }

            # Make HTTP request to chat endpoint
            url = f"{self.image_api_base.rstrip('/')}/v1/chat/completions"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.image_api_key}"
            }

            logger.debug(f"Calling chat-compatible API: {url}")

            # Add retry mechanism for transient errors
            max_retries = 3
            retry_delay = 2  # seconds

            for attempt in range(max_retries):
                try:
                    logger.debug(f"API request attempt {attempt + 1}/{max_retries}")
                    response = requests.post(url, json=payload, headers=headers, timeout=120)

                    # Check if we got a successful response
                    if response.status_code == 200:
                        logger.debug("API request successful")
                        break
                    elif response.status_code in [502, 503, 504]:
                        # Server errors that might be transient
                        if attempt < max_retries - 1:
                            logger.warning(f"Server error {response.status_code} on attempt {attempt + 1}, retrying in {retry_delay}s...")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                            continue
                        else:
                            logger.error(f"Server error {response.status_code} after {max_retries} attempts")
                            response.raise_for_status()
                    else:
                        # Other errors (client errors, etc.) - don't retry
                        logger.error(f"Non-retryable error {response.status_code}: {response.text}")
                        response.raise_for_status()

                except requests.exceptions.Timeout:
                    if attempt < max_retries - 1:
                        logger.warning(f"Timeout on attempt {attempt + 1}, retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        logger.error(f"Timeout after {max_retries} attempts")
                        raise
                except requests.exceptions.ConnectionError:
                    if attempt < max_retries - 1:
                        logger.warning(f"Connection error on attempt {attempt + 1}, retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                    else:
                        logger.error(f"Connection failed after {max_retries} attempts")
                        raise

            response.raise_for_status()

            # Parse response
            result = response.json()
            logger.info(f"Chat API response keys: {result.keys()}")
            logger.info(f"Response status code: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")

            # Log response size and content safely
            response_str = json.dumps(result, indent=2, ensure_ascii=False)
            logger.info(f"Full API response length: {len(response_str)} characters")
            logger.info(f"Full API response: {response_str}")

            # Check if it's a different API format (e.g., from ImageGen model)
            if 'data' in result and len(result['data']) > 0:
                # Some APIs return data array with URL
                data = result['data'][0]
                if 'url' in data:
                    image_url = data['url']
                    logger.info(f"Found image URL in response: {image_url}")
                    # Download the image
                    img_response = requests.get(image_url, timeout=30)
                    img_response.raise_for_status()
                    image = Image.open(BytesIO(img_response.content))
                    logger.info("Successfully downloaded and loaded image from URL")
                    return image
                elif 'b64_json' in data:
                    # Some APIs return base64 JSON
                    base64_data = data['b64_json']
                    image_data = base64.b64decode(base64_data)
                    image = Image.open(BytesIO(image_data))
                    logger.info("Successfully loaded image from base64_json")
                    return image

            if 'choices' in result and len(result['choices']) > 0:
                message = result['choices'][0].get('message', {})
                content = message.get('content', '')

                logger.info(f"Response content type: {type(content)}, length: {len(str(content)) if content else 0}")
                logger.info(f"Response content preview (first 500 chars): {str(content)[:500]}")
                logger.info(f"Response content preview (last 500 chars): {str(content)[-500:] if content else 'None'}")

                # Full content logging (only if not too large)
                if content and len(str(content)) < 10000:
                    logger.info(f"Response content: {content}")
                elif content:
                    logger.info(f"Response content too large ({len(str(content))} chars), logging to file")
                    # Log large content to file
                    try:
                        with open('logs/debug_content.log', 'w', encoding='utf-8') as f:
                            f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                            f.write(f"Content type: {type(content)}\n")
                            f.write(f"Content length: {len(str(content))}\n")
                            f.write(f"Full content:\n{content}\n")
                        logger.info("Logged full content to logs/debug_content.log")
                    except Exception as log_error:
                        logger.error(f"Failed to log content to file: {log_error}")

                # Check for error in other fields
                if 'error' in result:
                    logger.error(f"API returned error: {result['error']}")

                # Check if choice has finish_reason indicating an issue
                choice = result['choices'][0]
                if 'finish_reason' in choice:
                    finish_reason = choice['finish_reason']
                    logger.info(f"Finish reason: {finish_reason}")
                    if finish_reason not in ['stop', 'length']:
                        logger.warning(f"Unexpected finish_reason: {finish_reason}")

                # Content could be:
                # 1. A data URL: "data:image/png;base64,..."
                # 2. Pure base64 string
                # 3. A URL to the image
                # 4. Text response (error case)

                if not content:
                    raise ValueError("Empty content in API response")

                # Enhanced content detection and validation
                if not content or not str(content).strip():
                    raise ValueError("Empty content in API response")

                content_str = str(content).strip()

                # Log the full content for debugging
                logger.debug(f"Full API response content: {content_str}")
                logger.debug(f"Content length: {len(content_str)} characters")

                # Check for error indicators in the content
                error_keywords = ['error', 'failed', 'invalid', 'not found', 'exception', 'cannot', 'unable', 'forbidden']
                content_lower = content_str.lower()
                if any(keyword in content_lower for keyword in error_keywords):
                    logger.warning(f"Content contains error indicators: {content_str}")
                    # Don't immediately raise error, it might be a false positive

                # Check if it's a data URL
                if content_str.startswith('data:image'):
                    logger.debug("Detected data URL format")
                    # Extract base64 part from data URL
                    if ',' in content_str:
                        base64_data = content_str.split(',', 1)[1]
                    else:
                        raise ValueError("Invalid data URL format")
                # Check if it's a Markdown image link: ![image](data:image/png;base64,...)
                elif '![image]' in content_str and 'data:image' in content_str:
                    logger.debug("Detected markdown image format with '![image]'")
                    import re
                    # Use regex to extract the data URL from markdown
                    match = re.search(r'!\[image\]\((data:image/[^)]+)\)', content_str)
                    if match:
                        data_url = match.group(1)
                        if ',' in data_url:
                            base64_data = data_url.split(',', 1)[1]
                        else:
                            raise ValueError("Invalid data URL in markdown")
                    else:
                        raise ValueError("Could not extract data URL from markdown format")
                elif content_str.startswith('!['):
                    logger.debug("Detected generic markdown image format")
                    # Generic markdown image detection
                    import re
                    # Try to find any data URL in markdown
                    match = re.search(r'\!\[.*?\]\((data:image/[^)]+)\)', content_str)
                    if match:
                        data_url = match.group(1)
                        if ',' in data_url:
                            base64_data = data_url.split(',', 1)[1]
                        else:
                            raise ValueError("Invalid data URL in markdown")
                    else:
                        raise ValueError("Could not extract data URL from markdown format")
                elif content_str.startswith('http://') or content_str.startswith('https://'):
                    # It's a URL, download the image
                    logger.debug(f"Detected URL format, downloading image from: {content_str}")
                    try:
                        img_response = requests.get(content_str, timeout=30)
                        img_response.raise_for_status()
                        image = Image.open(BytesIO(img_response.content))
                        logger.info("Successfully downloaded and loaded image from URL")
                        return image
                    except Exception as url_error:
                        logger.error(f"Failed to download image from URL {content_str}: {str(url_error)}")
                        raise ValueError(f"Failed to download image from URL: {str(url_error)}")
                else:
                    logger.debug("Assuming pure base64 format")
                    # Assume it's pure base64
                    # First check if it looks like base64
                    if isinstance(content_str, str):
                        # Remove whitespace
                        base64_data = content_str.strip()

                        # Check if it's valid base64-like string
                        if not base64_data:
                            raise ValueError(f"Empty base64 data received. Full content: {content_str}")
                        elif len(base64_data) < 100:
                            logger.warning(f"Base64 data seems too short: {len(base64_data)} characters")
                            logger.warning(f"Short content: {base64_data}")
                            # It might be an error message, try to decode it
                            try:
                                decoded_text = base64.b64decode(base64_data + '==').decode('utf-8')
                                if any(keyword in decoded_text.lower() for keyword in error_keywords):
                                    raise ValueError(f"API returned error message: {decoded_text}")
                            except:
                                pass
                            raise ValueError(f"Content too short to be valid image data ({len(base64_data)} chars). Full content: {base64_data[:500]}")

                        # Check if it contains only base64 characters
                        import re
                        if not re.match(r'^[A-Za-z0-9+/=]+$', base64_data):
                            non_base64_chars = set(re.findall(r'[^A-Za-z0-9+/=]', base64_data))
                            logger.warning(f"Content contains non-base64 characters: {non_base64_chars}")
                            # It might be an error message in text format
                            if any(keyword in base64_data.lower() for keyword in error_keywords):
                                raise ValueError(f"API returned text error message: {base64_data}")
                    else:
                        raise ValueError(f"Unexpected content type: {type(content)}")

                # Try to decode base64 to image
                try:
                    # Clean up the base64 data first
                    if isinstance(base64_data, str):
                        original_length = len(base64_data)
                        logger.debug(f"Original base64_data length: {original_length}")

                        # Log if there are non-ASCII characters
                        try:
                            base64_data.encode('ascii')
                        except UnicodeEncodeError as e:
                            logger.warning(f"Found non-ASCII characters in base64 data: {e}")
                            logger.debug(f"Problematic characters sample: {[hex(ord(c)) for c in base64_data[:200] if ord(c) > 127]}")

                        # Remove any whitespace, newlines, etc.
                        base64_data = ''.join(base64_data.split())

                        # Fix non-ASCII characters that might be mixed in
                        # Sometimes APIs return mixed content with non-base64 characters
                        # We need to extract only valid base64 characters
                        import re
                        # Keep only base64 valid characters: A-Z, a-z, 0-9, +, /, =
                        cleaned_data = re.sub(r'[^A-Za-z0-9+/=]', '', base64_data)

                        if len(cleaned_data) != len(base64_data):
                            removed_chars = len(base64_data) - len(cleaned_data)
                            logger.warning(f"Removed {removed_chars} non-base64 characters from data")
                            base64_data = cleaned_data

                        # Ensure base64 string length is multiple of 4 (base64 requirement)
                        padding_needed = (-len(base64_data)) % 4
                        if padding_needed:
                            logger.debug(f"Adding {padding_needed} padding characters")
                            base64_data += '=' * padding_needed

                    logger.debug(f"Attempting to decode {len(base64_data)} chars of base64 data")
                    logger.debug(f"Base64 data preview (first 100 chars): {base64_data[:100]}")
                    logger.debug(f"Base64 data preview (last 100 chars): {base64_data[-100:]}")

                    image_data = base64.b64decode(base64_data)
                    logger.info(f"Successfully decoded {len(image_data)} bytes of image data")

                    # Check if it looks like valid image data
                    if len(image_data) < 100:
                        raise ValueError(f"Decoded data too small to be an image: {len(image_data)} bytes")

                    # Check the first few bytes to see if it's a valid image format
                    # PNG: starts with \x89PNG
                    # JPEG: starts with \xff\xd8\xff
                    # GIF: starts with GIF87a or GIF89a
                    # WebP: starts with RIFF....WEBP
                    header = image_data[:32]  # Check more bytes for better detection
                    logger.debug(f"Image data header (hex): {header.hex()}")
                    logger.debug(f"Image data header (repr): {repr(header)}")

                    # Detailed image format validation
                    is_valid_image = False
                    image_format = None

                    if header.startswith(b'\x89PNG\r\n\x1a\n'):
                        is_valid_image = True
                        image_format = 'PNG'
                    elif header.startswith(b'\xff\xd8\xff'):
                        is_valid_image = True
                        image_format = 'JPEG'
                    elif header.startswith(b'GIF87a') or header.startswith(b'GIF89a'):
                        is_valid_image = True
                        image_format = 'GIF'
                    elif header.startswith(b'RIFF') and len(header) >= 12 and header[8:12] == b'WEBP':
                        is_valid_image = True
                        image_format = 'WebP'
                    elif header.startswith(b'BM'):
                        is_valid_image = True
                        image_format = 'BMP'

                    # Also check for common patterns that indicate non-image data
                    if not is_valid_image:
                        # Try to decode as text to see if it's an error message
                        try:
                            text_content = image_data.decode('utf-8', errors='ignore')
                            if len(text_content.strip()) > 0:
                                logger.warning(f"Data appears to be text, not image: {text_content[:200]}...")
                                if any(keyword in text_content.lower() for keyword in ['error', 'failed', 'invalid', 'not found', 'exception']):
                                    raise ValueError(f"API returned error message instead of image: {text_content}")
                        except:
                            pass

                        # Check if it's trying to be JSON
                        try:
                            error_json = json.loads(image_data.decode('utf-8', errors='ignore'))
                            logger.error(f"API returned JSON instead of image: {error_json}")
                            if 'error' in error_json:
                                raise ValueError(f"API returned error: {error_json['error']}")
                            else:
                                raise ValueError(f"API returned JSON instead of image: {error_json}")
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            pass

                        # If we get here, it's not a recognized image format
                        raise ValueError(f"Invalid image format. Expected PNG/JPEG/GIF/WebP/BMP, got header: {header[:16].hex()}")

                    logger.info(f"Detected image format: {image_format}, size: {len(image_data)} bytes")

                    # Now try to open the image
                    try:
                        image = Image.open(BytesIO(image_data))
                        # Verify the image by trying to get its size (this forces PIL to actually parse the image)
                        _ = image.size
                        logger.info(f"Successfully created {image_format} image: {image.size}, mode: {image.mode}")
                        return image
                    except Exception as img_error:
                        logger.error(f"PIL failed to open image data: {str(img_error)}")
                        logger.error(f"Image data sample (first 100 bytes): {image_data[:100]}")
                        raise ValueError(f"Invalid image data that PIL cannot process: {str(img_error)}")
                except base64.binascii.Error as e:
                    logger.error(f"Base64 decode error. Original content preview: {str(content)[:500]}")
                    raise ValueError(f"Invalid base64 data: {str(e)}")
                except Exception as e:
                    logger.error(f"Failed to decode image. Content preview: {str(content)[:500]}")
                    logger.error(f"Decoded data size: {len(image_data) if 'image_data' in locals() else 'N/A'}")
                    if 'image_data' in locals() and len(image_data) < 1000:
                        logger.error(f"Decoded data (first 500 bytes): {image_data[:500]}")
                    raise ValueError(f"Failed to decode image data: {str(e)}")
            else:
                # Log the full response for debugging
                logger.error(f"Invalid API response structure: {result}")
                raise ValueError(f"No valid response from chat API. Response: {result}")

        except requests.exceptions.HTTPError as e:
            error_detail = f"HTTP Error generating image (chat format): {type(e).__name__}: {str(e)}"

            # Add user-friendly messages for common server errors
            if hasattr(e, 'response') and e.response is not None:
                status_code = e.response.status_code
                if status_code == 502:
                    error_detail = "图片生成服务暂时不可用 (502 Bad Gateway)。服务器可能正在维护或过载，请稍后重试。"
                elif status_code == 503:
                    error_detail = "图片生成服务暂时过载 (503 Service Unavailable)。请稍后重试。"
                elif status_code == 504:
                    error_detail = "图片生成请求超时 (504 Gateway Timeout)。请求处理时间过长，请稍后重试。"
                elif status_code == 429:
                    error_detail = "请求频率过高 (429 Rate Limited)。请稍后重试。"
                elif status_code == 401:
                    error_detail = "API 密钥无效或已过期 (401 Unauthorized)。请检查 API 配置。"
                elif status_code == 403:
                    error_detail = "访问被拒绝 (403 Forbidden)。API 密钥可能没有图片生成权限。"
                elif status_code >= 500:
                    error_detail = f"图片生成服务器内部错误 ({status_code})。这是服务器端问题，请稍后重试。"

                logger.error(f"{error_detail} - URL: {e.response.url if hasattr(e.response, 'url') else 'Unknown'}")
                logger.error(f"Response content: {e.response.text[:500] if hasattr(e.response, 'text') else 'No content'}")
            else:
                logger.error(error_detail)

            raise Exception(error_detail) from e
        except requests.exceptions.Timeout as e:
            error_detail = "图片生成请求超时。网络连接可能不稳定，或者服务器响应时间过长。请稍后重试。"
            logger.error(f"Timeout error generating image: {str(e)}")
            raise Exception(error_detail) from e
        except requests.exceptions.ConnectionError as e:
            error_detail = "无法连接到图片生成服务。请检查网络连接或联系管理员。"
            logger.error(f"Connection error generating image: {str(e)}")
            raise Exception(error_detail) from e
        except Exception as e:
            error_detail = f"Error generating image (chat format): {type(e).__name__}: {str(e)}"
            logger.error(error_detail, exc_info=True)
            raise Exception(error_detail) from e

    def generate_image(self, prompt: str, ref_image_path: Optional[str] = None,
                      aspect_ratio: str = "16:9", resolution: str = "2K",
                      additional_ref_images: Optional[List[Union[str, Image.Image]]] = None) -> Optional[Image.Image]:
        """
        Generate image using Gemini image model
        Automatically dispatches to appropriate format (native SDK or chat-compatible)
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
        # Dispatch to appropriate format handler
        if self.use_chat_format:
            return self._generate_image_chat_format(prompt, ref_image_path, aspect_ratio, resolution, additional_ref_images)

        # Original native SDK format implementation
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
            response = self.image_client.models.generate_content(
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
    
    def parse_description_to_outline(self, description_text: str, reference_files_content: Optional[List[Dict[str, str]]] = None) -> List[Dict]:
        """
        从描述文本解析出大纲结构
        
        Args:
            description_text: 用户提供的完整页面描述文本
            reference_files_content: 可选的参考文件内容列表
        
        Returns:
            List of outline items (may contain parts with pages or direct pages)
        """
        parse_prompt = get_description_to_outline_prompt(description_text, reference_files_content)
        
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
    
    def parse_description_to_page_descriptions(self, description_text: str, outline: List[Dict]) -> List[str]:
        """
        从描述文本切分出每页描述
        
        Args:
            description_text: 用户提供的完整页面描述文本
            outline: 已解析出的大纲结构
        
        Returns:
            List of page descriptions (strings), one for each page in the outline
        """
        split_prompt = get_description_split_prompt(description_text, outline)
        
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

