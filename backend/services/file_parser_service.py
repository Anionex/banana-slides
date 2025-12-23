"""
File Parser Service - handles file parsing using MinerU service and image captioning
"""
import os
import re
import time
import logging
import zipfile
import io
import base64
import requests
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image
from markitdown import MarkItDown

logger = logging.getLogger(__name__)


def _get_ai_provider_format(provider_format: str = None) -> str:
    """Get the configured AI provider format
    
    Priority:
        1. Provided provider_format parameter
        2. Flask app.config['AI_PROVIDER_FORMAT'] (from database settings)
        3. Environment variable AI_PROVIDER_FORMAT
        4. Default: 'gemini'
    
    Args:
        provider_format: Optional provider format string. If not provided, reads from Flask config or environment variable.
    """
    if provider_format:
        return provider_format.lower()
    
    # Try to get from Flask app config first (database settings)
    try:
        from flask import current_app
        if current_app and hasattr(current_app, 'config'):
            config_value = current_app.config.get('AI_PROVIDER_FORMAT')
            if config_value:
                return str(config_value).lower()
    except RuntimeError:
        # Not in Flask application context
        pass
    
    # Fallback to environment variable
    return os.getenv('AI_PROVIDER_FORMAT', 'gemini').lower()


class FileParserService:
    """Service for parsing files using MinerU and enhancing with image captions"""
    
    def __init__(self, mineru_token: str, mineru_api_base: str = "https://mineru.net",
                 google_api_key: str = "", google_api_base: str = "",
                 openai_api_key: str = "", openai_api_base: str = "",
                 image_caption_model: str = "gemini-3-flash-preview",
                 provider_format: str = None):
        """
        Initialize the file parser service
        
        Args:
            mineru_token: MinerU API token
            mineru_api_base: MinerU API base URL
            google_api_key: Google Gemini API key for image captioning (used when AI_PROVIDER_FORMAT=gemini)
            google_api_base: Google Gemini API base URL
            openai_api_key: OpenAI API key for image captioning (used when AI_PROVIDER_FORMAT=openai)
            openai_api_base: OpenAI API base URL
            image_caption_model: Model to use for image captioning
            provider_format: AI provider format ('gemini' or 'openai'). If not provided, reads from environment variable.
        """
        self.mineru_token = mineru_token
        self.mineru_api_base = mineru_api_base
        self.get_upload_url_api = f"{mineru_api_base}/api/v4/file-urls/batch"
        self.get_result_api_template = f"{mineru_api_base}/api/v4/extract-results/batch/{{}}"
        
        # Store config for lazy initialization
        self._google_api_key = google_api_key
        self._google_api_base = google_api_base
        self._openai_api_key = openai_api_key
        self._openai_api_base = openai_api_base
        self.image_caption_model = image_caption_model
        
        # Clients will be initialized lazily based on AI_PROVIDER_FORMAT
        self._gemini_client = None
        self._openai_client = None
        self._provider_format = _get_ai_provider_format(provider_format)
    
    def _get_gemini_client(self):
        """Lazily initialize Gemini client"""
        if self._gemini_client is None and self._google_api_key:
            from google import genai
            from google.genai import types
            self._gemini_client = genai.Client(
                http_options=types.HttpOptions(base_url=self._google_api_base) if self._google_api_base else None,
                api_key=self._google_api_key
            )
        return self._gemini_client
    
    def _get_openai_client(self):
        """Lazily initialize OpenAI client"""
        if self._openai_client is None and self._openai_api_key:
            from openai import OpenAI
            self._openai_client = OpenAI(
                api_key=self._openai_api_key,
                base_url=self._openai_api_base
            )
        return self._openai_client
    
    def _can_generate_captions(self) -> bool:
        """Check if image caption generation is available"""
        if self._provider_format == 'openai':
            return bool(self._openai_api_key)
        else:
            return bool(self._google_api_key)
    
    def parse_file(self, file_path: str, filename: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], int]:
        """
        Parse a file using MinerU service and enhance with image captions
        
        Args:
            file_path: Path to the file to parse
            filename: Original filename
            
        Returns:
            Tuple of (batch_id, markdown_content, extract_id, error_message, failed_image_count)
            - batch_id: MinerU batch ID (for tracking, None for text files)
            - markdown_content: Parsed markdown with enhanced image descriptions
            - extract_id: Unique ID for the extracted files directory (None for text files)
            - error_message: Error message if parsing failed
            - failed_image_count: Number of images that failed to generate captions
        """
        try:
            # Check if it's a plain text file that doesn't need MinerU parsing
            file_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            
            if file_ext in ['txt', 'md', 'markdown']:
                logger.info(f"File {filename} is a plain text file, reading directly...")
                return self._parse_text_file(file_path, filename)
            
            # Check if it's a spreadsheet file (xlsx, csv) - use markitdown
            if file_ext in ['xlsx', 'xls', 'csv']:
                logger.info(f"File {filename} is a spreadsheet file, using markitdown...")
                return self._parse_spreadsheet_file(file_path, filename)
            
            # For other file types, use MinerU service
            logger.info(f"File {filename} requires MinerU parsing...")
            
            # Step 1: Get upload URL
            logger.info(f"Step 1/4: Requesting upload URL for {filename}...")
            batch_id, upload_url, error = self._get_upload_url(filename)
            if error:
                return None, None, None, error, 0
            
            logger.info(f"Got upload URL. Batch ID: {batch_id}")
            
            # Step 2: Upload file
            logger.info(f"Step 2/4: Uploading file {filename}...")
            error = self._upload_file(file_path, upload_url)
            if error:
                return batch_id, None, None, error, 0
            
            logger.info("File uploaded successfully.")
            
            # Step 3: Poll for parsing result
            logger.info("Step 3/4: Waiting for parsing to complete...")
            markdown_content, extract_id, error = self._poll_result(batch_id)
            if error:
                return batch_id, None, None, error, 0
            
            logger.info("File parsed successfully.")
            
            # Step 4: Enhance markdown with image captions
            if markdown_content and self._can_generate_captions():
                logger.info("Step 4/4: Enhancing markdown with image captions...")
                enhanced_content, failed_count = self._enhance_markdown_with_captions(markdown_content)
                if failed_count > 0:
                    logger.warning(f"Markdown enhanced with image captions, but {failed_count} images failed to generate captions.")
                else:
                    logger.info("Markdown enhanced with image captions (all images succeeded).")
                return batch_id, enhanced_content, extract_id, None, failed_count
            else:
                logger.info("Skipping image caption enhancement (no Gemini client).")
                return batch_id, markdown_content, extract_id, None, 0
            
        except Exception as e:
            error_msg = f"Unexpected error during file parsing: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return None, None, None, error_msg, 0
    
    def _parse_text_file(self, file_path: str, filename: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], int]:
        """
        Parse plain text file directly without MinerU
        
        Args:
            file_path: Path to the file
            filename: Original filename
            
        Returns:
            Tuple of (batch_id, markdown_content, extract_id, error_message, failed_image_count)
        """
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            logger.info(f"Text file read successfully: {len(content)} characters")
            
            # Enhance markdown with image captions if it contains images
            if content and self._can_generate_captions():
                # Check if content has markdown images
                if '![' in content and '](' in content:
                    logger.info("Text file contains images, enhancing with captions...")
                    enhanced_content, failed_count = self._enhance_markdown_with_captions(content)
                    if failed_count > 0:
                        logger.warning(f"Text file enhanced with image captions, but {failed_count} images failed to generate captions.")
                    else:
                        logger.info("Text file enhanced with image captions (all images succeeded).")
                    return None, enhanced_content, None, None, failed_count
            
            return None, content, None, None, 0
            
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(file_path, 'r', encoding='gbk') as f:
                    content = f.read()
                logger.info(f"Text file read successfully with GBK encoding: {len(content)} characters")
                
                if content and self._can_generate_captions() and '![' in content and '](' in content:
                    logger.info("Text file contains images, enhancing with captions...")
                    enhanced_content, failed_count = self._enhance_markdown_with_captions(content)
                    if failed_count > 0:
                        logger.warning(f"Text file enhanced with image captions, but {failed_count} images failed to generate captions.")
                    else:
                        logger.info("Text file enhanced with image captions (all images succeeded).")
                    return None, enhanced_content, None, None, failed_count
                
                return None, content, None, None, 0
            except Exception as e:
                error_msg = f"Failed to read text file with multiple encodings: {str(e)}"
                logger.error(error_msg)
                return None, None, None, error_msg, 0
        except Exception as e:
            error_msg = f"Failed to read text file: {str(e)}"
            logger.error(error_msg)
            return None, None, None, error_msg, 0
    
    def _parse_spreadsheet_file(self, file_path: str, filename: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], int]:
        """
        Parse spreadsheet files (xlsx, xls, csv) using markitdown
        
        Args:
            file_path: Path to the file
            filename: Original filename
            
        Returns:
            Tuple of (batch_id, markdown_content, extract_id, error_message, failed_image_count)
        """
        try:
            # Use markitdown to convert spreadsheet to markdown
            md = MarkItDown()
            result = md.convert(file_path)
            markdown_content = result.text_content
            
            logger.info(f"Spreadsheet file converted successfully: {len(markdown_content)} characters")
            
            # Spreadsheet files typically don't have images, so no need for caption enhancement
            return None, markdown_content, None, None, 0
            
        except Exception as e:
            error_msg = f"Failed to parse spreadsheet file: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return None, None, None, error_msg, 0
    
    def _get_upload_url(self, filename: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Get upload URL from MinerU"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.mineru_token}"
        }
        
        upload_data = {
            "files": [{"name": filename}],
            "model_version": "vlm"  # or "pipeline"
        }
        
        try:
            response = requests.post(
                self.get_upload_url_api,
                headers=headers,
                json=upload_data,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get("code") != 0:
                error_msg = f"Failed to get upload URL: {result.get('msg')}"
                logger.error(error_msg)
                return None, None, error_msg
            
            batch_id = result["data"]["batch_id"]
            upload_url = result["data"]["file_urls"][0]
            return batch_id, upload_url, None
            
        except requests.exceptions.RequestException as e:
            error_msg = f"Network error while requesting upload URL: {str(e)}"
            logger.error(error_msg)
            return None, None, error_msg
    
    def _upload_file(self, file_path: str, upload_url: str) -> Optional[str]:
        """Upload file to MinerU"""
        try:
            with open(file_path, 'rb') as f:
                response = requests.put(
                    upload_url,
                    data=f,
                    headers={"Authorization": None},  # Remove auth for upload
                    timeout=300  # 5 minutes timeout for large files
                )
                response.raise_for_status()
            return None
            
        except requests.exceptions.RequestException as e:
            error_msg = f"File upload failed: {str(e)}"
            logger.error(error_msg)
            return error_msg
        except IOError as e:
            error_msg = f"Failed to read file: {str(e)}"
            logger.error(error_msg)
            return error_msg
    
    def _poll_result(self, batch_id: str, max_wait_time: int = 600) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Poll for parsing result
        
        Returns:
            Tuple of (markdown_content, extract_id, error_message)
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.mineru_token}"
        }
        
        result_url = self.get_result_api_template.format(batch_id)
        start_time = time.time()
        
        while True:
            if time.time() - start_time > max_wait_time:
                error_msg = f"Parsing timeout after {max_wait_time} seconds"
                logger.error(error_msg)
                return None, None, error_msg
            
            try:
                response = requests.get(result_url, headers=headers, timeout=30)
                response.raise_for_status()
                task_info = response.json()
                
                if task_info.get("code") != 0:
                    error_msg = f"Failed to query task status: {task_info.get('msg')}"
                    logger.error(error_msg)
                    return None, None, error_msg
                
                task_status = task_info["data"]["extract_result"][0]["state"]
                
                if task_status == "done":
                    logger.info("File parsing completed!")
                    full_zip_url = task_info["data"]["extract_result"][0]["full_zip_url"]
                    # Download and extract markdown
                    return self._download_markdown(full_zip_url)
                elif task_status == "failed":
                    err_msg = task_info["data"]["extract_result"][0].get("err_msg", "Unknown error")
                    error_msg = f"File parsing failed: {err_msg}"
                    logger.error(error_msg)
                    return None, None, error_msg
                else:
                    logger.debug(f"Current task status: {task_status}, waiting...")
                    time.sleep(2)  # Wait 2 seconds before next poll
                    
            except requests.exceptions.RequestException as e:
                logger.warning(f"Network error while polling result: {str(e)}, retrying...")
                time.sleep(2)
    
    def _download_markdown(self, zip_url: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """Download and extract markdown from result zip, save images to local server
        
        Returns:
            Tuple of (markdown_content, extract_id, error_message)
        """
        try:
            response = requests.get(zip_url, timeout=60)
            response.raise_for_status()
            
            # Generate unique directory name for this extraction
            import uuid
            extract_id = str(uuid.uuid4())[:8]
            
            # Get upload folder from Flask config (we'll need to pass this)
            # For now, use a hardcoded path relative to project root
            import os
            from pathlib import Path
            
            # Navigate to project root (assuming this file is in backend/services/)
            current_file = Path(__file__).resolve()
            backend_dir = current_file.parent.parent
            project_root = backend_dir.parent
            
            # Create directory for mineru extracts
            mineru_storage = project_root / 'uploads' / 'mineru_files' / extract_id
            mineru_storage.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Extracting ZIP to: {mineru_storage}")
            
            markdown_content = None
            markdown_file_path = None
            
            with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                # Extract all files
                z.extractall(mineru_storage)
                logger.info(f"Extracted {len(z.namelist())} files from ZIP")
                
                # Find markdown file (usually full.md or similar)
                for name in z.namelist():
                    if name.endswith('.md') or name.endswith('.MD'):
                        markdown_file_path = name
                        md_full_path = mineru_storage / name
                        with open(md_full_path, 'r', encoding='utf-8') as f:
                            markdown_content = f.read()
                        logger.info(f"Found markdown file: {name}")
                        break
                
                if not markdown_content:
                    error_msg = "No markdown file found in result zip"
                    logger.error(error_msg)
                    return None, None, error_msg
            
            # Replace relative image paths with local server URLs
            markdown_content = self._replace_image_paths(
                markdown_content, 
                markdown_file_path,
                extract_id
            )
            
            return markdown_content, extract_id, None
                
        except requests.exceptions.RequestException as e:
            error_msg = f"Failed to download result: {str(e)}"
            logger.error(error_msg)
            return None, None, error_msg
        except zipfile.BadZipFile:
            error_msg = "Downloaded file is not a valid ZIP archive"
            logger.error(error_msg)
            return None, None, error_msg
        except Exception as e:
            error_msg = f"Failed to process ZIP file: {str(e)}"
            logger.error(error_msg)
            return None, None, error_msg
    
    def _replace_image_paths(self, markdown_content: str, markdown_file_path: str, extract_id: str) -> str:
        """Replace relative image paths in markdown with local server URLs"""
        import os
        
        # Get the directory where the markdown file is located (within the extracted ZIP)
        md_dir = os.path.dirname(markdown_file_path)
        
        def replace_link(match):
            alt_text = match.group(1)
            img_path = match.group(2)
            
            # Skip if already an absolute URL
            if img_path.startswith(('http://', 'https://')):
                return match.group(0)
            
            # Handle /file/ or /files/ paths (MinerU may generate these)
            # These are relative to the extracted directory
            if img_path.startswith('/file/') or img_path.startswith('/files/'):
                # Remove leading slash and use as relative path
                rel_path = img_path.lstrip('/')
                # Remove 'file/' or 'files/' prefix if present
                if rel_path.startswith('file/'):
                    rel_path = rel_path[5:]  # Remove 'file/' prefix
                elif rel_path.startswith('files/'):
                    rel_path = rel_path[6:]  # Remove 'files/' prefix
            else:
                # Calculate the relative path from the markdown file
                if md_dir:
                    # Normalize path separators
                    rel_path = os.path.normpath(os.path.join(md_dir, img_path)).replace('\\', '/')
                else:
                    rel_path = img_path.replace('\\', '/')
            
            # Construct the local server URL
            # The files are served at /files/mineru/{extract_id}/{rel_path}
            new_url = f"/files/mineru/{extract_id}/{rel_path[:15]}.{rel_path.split('.')[-1]}" # "images/...(8)"
            
            logger.debug(f"Replacing image path: {img_path} -> {new_url}")
            return f"![{alt_text}]({new_url})"
        
        # Match markdown image syntax
        pattern = r"!\[(.*?)\]\((.*?)\)"
        replaced_content = re.sub(pattern, replace_link, markdown_content)
        
        return replaced_content
    
    def _enhance_markdown_with_captions(self, markdown_content: str) -> tuple[str, int]:
        """
        Enhance markdown by adding captions to images that don't have alt text
        
        Args:
            markdown_content: Original markdown content
            
        Returns:
            Tuple of (enhanced_markdown, failed_image_count)
        """
        if not self._can_generate_captions():
            return markdown_content, 0
        
        # Extract all image URLs from markdown (both with and without alt text)
        # Support both http/https URLs and relative paths
        image_pattern = r'!\[(.*?)\]\(([^\)]+)\)'
        matches = list(re.finditer(image_pattern, markdown_content))
        
        logger.info(f"Found {len(matches)} markdown image references")
        
        if not matches:
            logger.info("No markdown image syntax found")
            return markdown_content, 0
        
        # Filter to only images without alt text (empty brackets)
        images_to_caption = []
        for match in matches:
            alt_text = match.group(1).strip()
            image_url = match.group(2).strip()
            logger.debug(f"Image found: alt='{alt_text}', url='{image_url}'")
            
            if not alt_text:  # Only process images with empty alt text
                images_to_caption.append(match)
        
        if not images_to_caption:
            logger.info(f"Found {len(matches)} images in markdown, but all have descriptions. Skipping caption generation.")
            return markdown_content, 0
        
        logger.info(f"Found {len(images_to_caption)} images without descriptions out of {len(matches)} total, generating captions...")
        
        # Generate captions in parallel (only for images without alt text)
        image_urls = [match.group(2) for match in images_to_caption]
        captions, failed_count = self._generate_captions_parallel(image_urls)
        
        # Log results
        success_count = len(images_to_caption) - failed_count
        logger.info(f"Image caption generation completed: {success_count} succeeded, {failed_count} failed out of {len(images_to_caption)} total")
        
        # Replace image syntax with captioned version (in reverse order to maintain positions)
        enhanced_content = markdown_content
        for match, caption in zip(reversed(images_to_caption), reversed(captions)):
            old_text = match.group(0)
            url = match.group(2)
            # Use caption as alt text (empty if generation failed)
            new_text = f"![{caption}]({url})"
            enhanced_content = enhanced_content[:match.start()] + new_text + enhanced_content[match.end():]
        
        return enhanced_content, failed_count
    
    def _generate_captions_parallel(self, image_urls: List[str], max_workers: int = 12, max_retries: int = 3) -> tuple[List[str], int]:
        """
        Generate captions for multiple images in parallel with retry mechanism
        
        Args:
            image_urls: List of image URLs
            max_workers: Maximum number of parallel workers
            max_retries: Maximum number of retries for each image
            
        Returns:
            Tuple of (list of captions, number of failed images)
        """
        captions = [""] * len(image_urls)
        failed_count = 0
        
        def generate_with_retry(url: str, idx: int) -> tuple[int, str, bool]:
            """Generate caption with retry logic"""
            for attempt in range(max_retries):
                try:
                    caption = self._generate_single_caption(url)
                    if caption:
                        logger.debug(f"Generated caption for image {idx + 1}/{len(image_urls)} (attempt {attempt + 1})")
                        return (idx, caption, True)
                    else:
                        logger.warning(f"Empty caption for image {idx + 1} (attempt {attempt + 1}/{max_retries})")
                except Exception as e:
                    logger.warning(f"Failed to generate caption for image {idx + 1} (attempt {attempt + 1}/{max_retries}): {str(e)}")
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(1 * (attempt + 1))  # Exponential backoff: 1s, 2s, 3s
            
            # All retries failed
            logger.error(f"Failed to generate caption for image {idx + 1} after {max_retries} attempts")
            return (idx, "", False)
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_idx = {
                executor.submit(generate_with_retry, url, idx): idx
                for idx, url in enumerate(image_urls)
            }
            
            for future in as_completed(future_to_idx):
                try:
                    idx, caption, success = future.result()
                    captions[idx] = caption
                    if not success:
                        failed_count += 1
                except Exception as e:
                    idx = future_to_idx[future]
                    logger.error(f"Unexpected error generating caption for image {idx + 1}: {str(e)}")
                    failed_count += 1
        
        return captions, failed_count
    
    def _generate_single_caption(self, image_url: str) -> str:
        """
        Generate caption for a single image (supports both HTTP URLs and local paths)
        
        Args:
            image_url: URL or local path of the image
            
        Returns:
            Generated caption
        """
        try:
            # Load image based on URL type
            if image_url.startswith('http://') or image_url.startswith('https://'):
                # Download from HTTP(S) URL
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                image = Image.open(io.BytesIO(response.content))
            elif image_url.startswith('/files/mineru/'):
                # Local MinerU extracted file with prefix matching support
                from utils.path_utils import find_mineru_file_with_prefix
                
                # Find file with prefix matching
                img_path = find_mineru_file_with_prefix(image_url)
                
                if img_path is None or not img_path.exists():
                    logger.warning(f"Local image file not found (with prefix matching): {image_url}")
                    return ""
                
                image = Image.open(img_path)
            else:
                # Unsupported path type
                logger.warning(f"Unsupported image path type: {image_url}")
                return ""
            
            # Generate caption based on provider format
            prompt = "请用一句简短的中文描述这张图片的主要内容。只返回描述文字，不要其他解释。"
            
            if self._provider_format == 'openai':
                # Use OpenAI SDK format
                client = self._get_openai_client()
                if not client:
                    logger.warning("OpenAI client not initialized, skipping caption generation")
                    return ""
                
                # Encode image to base64
                buffered = io.BytesIO()
                if image.mode in ('RGBA', 'LA', 'P'):
                    image = image.convert('RGB')
                image.save(buffered, format="JPEG", quality=95)
                base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
                
                response = client.chat.completions.create(
                    model=self.image_caption_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                                {"type": "text", "text": prompt}
                            ]
                        }
                    ],
                    temperature=0.3
                )
                caption = response.choices[0].message.content.strip()
            else:
                # Use Gemini SDK format (default)
                from google.genai import types
                client = self._get_gemini_client()
                if not client:
                    logger.warning("Gemini client not initialized, skipping caption generation")
                    return ""
                
                result = client.models.generate_content(
                    model=self.image_caption_model,
                    contents=[image, prompt],
                    config=types.GenerateContentConfig(
                        temperature=0.3,  # Lower temperature for more consistent captions
                    )
                )
                caption = result.text.strip()
            
            return caption
            
        except Exception as e:
            logger.warning(f"Failed to generate caption for {image_url}: {str(e)}")
            return ""  # Return empty string on failure

