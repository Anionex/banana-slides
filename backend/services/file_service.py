"""
File Service - 高级文件操作封装

在 StorageBackend 抽象层之上提供业务级别的文件操作方法。
支持本地存储和云存储的无缝切换。
"""
import os
import uuid
import time
import logging
from pathlib import Path
from typing import Optional
from werkzeug.utils import secure_filename
from PIL import Image
from models import Project
from models import db

from .storage import get_storage, StorageBackend

logger = logging.getLogger(__name__)


def convert_image_to_rgb(image: Image.Image) -> Image.Image:
    """
    Convert image to RGB mode for JPEG compatibility.
    Handles RGBA, LA, P (palette) and other modes by compositing onto white background.

    Args:
        image: PIL Image object

    Returns:
        PIL Image in RGB mode
    """
    if image.mode in ('RGBA', 'LA', 'P'):
        # Create white background for transparent images
        background = Image.new('RGB', image.size, (255, 255, 255))

        # Convert palette mode to RGBA to handle transparency
        if image.mode == 'P':
            image = image.convert('RGBA')

        # Paste image onto white background using alpha channel as mask
        # For RGBA and LA modes, the last channel is the alpha/transparency channel
        if image.mode in ('RGBA', 'LA'):
            background.paste(image, mask=image.split()[-1])
        else:
            # This shouldn't happen after P->RGBA conversion, but handle just in case
            background.paste(image)

        return background
    elif image.mode != 'RGB':
        return image.convert('RGB')
    return image


def resize_image_for_thumbnail(image: Image.Image, max_width: int = 1920) -> Image.Image:
    """
    Resize image for thumbnail if it exceeds max width.
    Maintains aspect ratio.
    
    Args:
        image: PIL Image object
        max_width: Maximum width in pixels (default 1920)
        
    Returns:
        Resized PIL Image (or original if already smaller)
    """
    if image.width > max_width:
        ratio = max_width / image.width
        new_height = int(image.height * ratio)
        return image.resize((max_width, new_height), Image.Resampling.LANCZOS)
    return image


class FileService:
    """
    高级文件服务
    
    在 StorageBackend 之上提供业务相关的文件操作方法。
    保持原有 API 不变，内部使用抽象存储层。
    """
    
    def __init__(self, upload_folder: str, storage: StorageBackend = None):
        """
        Initialize file service
        
        Args:
            upload_folder: 上传目录路径（用于兼容旧代码）
            storage: 可选的存储后端实例（默认使用全局实例）
        """
        self.upload_folder = Path(upload_folder)
        self.upload_folder.mkdir(exist_ok=True, parents=True)
        
        # 使用传入的存储后端或获取全局实例
        self._storage = storage
    
    @property
    def storage(self) -> StorageBackend:
        """延迟获取存储后端"""
        if self._storage is None:
            self._storage = get_storage()
        return self._storage
    
    def _get_project_dir(self, project_id: str) -> str:
        """Get project directory path"""
        return project_id
    
    def _get_template_dir(self, project_id: str) -> str:
        """Get template directory path for project"""
        return f"{project_id}/template"
    
    def _get_pages_dir(self, project_id: str) -> str:
        """Get pages directory path for project"""
        return f"{project_id}/pages"

    def _get_exports_dir(self, project_id: str) -> str:
        """Get exports directory path for project"""
        return f"{project_id}/exports"

    def _get_materials_dir(self, project_id: str) -> str:
        """Get materials directory path for project"""
        return f"{project_id}/materials"
    
    def save_template_image(self, file, project_id: str) -> str:
        """
        Save template image file
        
        Args:
            file: FileStorage object from Flask request
            project_id: Project ID
        
        Returns:
            Relative file path from upload folder
        """
        # Secure filename and add unique suffix
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"template.{ext}"
        
        relative_path = f"{self._get_template_dir(project_id)}/{filename}"
        
        # 确保目录存在
        self.storage.ensure_directory(self._get_template_dir(project_id))
        
        # 保存文件
        self.storage.save_file(file, relative_path)
        
        return relative_path
    
    def save_generated_image(self, image: Image.Image, project_id: str,
                           page_id: str, image_format: str = 'PNG',
                           version_number: int = None) -> str:
        """
        Save generated image with version support

        Args:
            image: PIL Image object
            project_id: Project ID
            page_id: Page ID
            image_format: Image format (PNG, JPEG, etc.)
            version_number: Optional version number. If None, uses timestamp-based naming

        Returns:
            Relative file path from upload folder
        """
        pages_dir = self._get_pages_dir(project_id)
        ext = image_format.lower()

        # Generate filename with version number or timestamp
        if version_number is not None:
            filename = f"{page_id}_v{version_number}.{ext}"
        else:
            timestamp = int(time.time() * 1000)
            filename = f"{page_id}_{timestamp}.{ext}"

        relative_path = f"{pages_dir}/{filename}"
        
        # 确保目录存在
        self.storage.ensure_directory(pages_dir)
        
        # 保存图片
        self.storage.save_image(image, relative_path, format=image_format.upper())

        return relative_path

    def get_cached_image_path(self, project_id: str, page_id: str, version_number: int) -> str:
        """
        Generate the relative path for a cached thumbnail image.

        Args:
            project_id: Project ID
            page_id: Page ID
            version_number: Version number

        Returns:
            Relative file path from upload folder
        """
        filename = f"{page_id}_v{version_number}_thumb.jpg"
        return f"{project_id}/pages/{filename}"

    def save_cached_image(self, image: Image.Image, project_id: str,
                         page_id: str, version_number: int,
                         quality: int = 85, max_width: int = 1920) -> str:
        """
        Save compressed JPG thumbnail for faster frontend loading

        Args:
            image: PIL Image object
            project_id: Project ID
            page_id: Page ID
            version_number: Version number
            quality: JPEG quality (1-100), default 85
            max_width: Maximum thumbnail width in pixels (default 1920)

        Returns:
            Relative file path from upload folder
        """
        pages_dir = self._get_pages_dir(project_id)
        relative_path = self.get_cached_image_path(project_id, page_id, version_number)

        # 确保目录存在
        self.storage.ensure_directory(pages_dir)

        # Resize image if too large
        image = resize_image_for_thumbnail(image, max_width)

        # Convert to RGB
        image = convert_image_to_rgb(image)

        # Save as compressed JPEG
        self.storage.save_image(image, relative_path, format='JPEG', 
                               quality=quality, optimize=True)

        return relative_path

    def save_material_image(self, image: Image.Image, project_id: Optional[str],
                            image_format: str = 'PNG') -> str:
        """
        Save standalone generated material image

        Args:
            image: PIL Image object
            project_id: Project ID (None for global materials)
            image_format: Image format (PNG, JPEG, etc.)

        Returns:
            Relative file path from upload folder
        """
        # Handle global materials
        if project_id is None:
            materials_dir = "materials"
        else:
            materials_dir = self._get_materials_dir(project_id)

        ext = image_format.lower()
        timestamp = int(time.time() * 1000)
        filename = f"material_{timestamp}.{ext}"
        relative_path = f"{materials_dir}/{filename}"

        # 确保目录存在
        self.storage.ensure_directory(materials_dir)

        # Save image
        self.storage.save_image(image, relative_path, format=image_format.upper())

        return relative_path
    
    def delete_page_image_version(self, image_path: str) -> bool:
        """
        Delete a specific image version file and its cache

        Args:
            image_path: Relative path to the image file

        Returns:
            True if deleted successfully
        """
        deleted = self.storage.delete_file(image_path)

        # Also delete corresponding cache file
        # e.g., xxx_v1.png -> xxx_v1_thumb.jpg
        path = Path(image_path)
        cache_path = f"{path.parent.as_posix()}/{path.stem}_thumb.jpg"
        self.storage.delete_file(cache_path)

        return deleted
    
    def get_file_url(self, project_id: Optional[str], file_type: str, filename: str) -> str:
        """
        Generate file URL for frontend access
        
        Args:
            project_id: Project ID (None for global materials)
            file_type: 'template', 'pages', or 'materials'
            filename: File name
        
        Returns:
            URL path for file access
        """
        if project_id is None:
            relative_path = f"materials/{filename}"
        else:
            relative_path = f"{project_id}/{file_type}/{filename}"
        
        return self.storage.get_public_url(relative_path)
    
    def get_absolute_path(self, relative_path: str) -> str:
        """
        Get absolute file path from relative path
        
        Args:
            relative_path: Relative path from upload folder
        
        Returns:
            Absolute file path
        """
        return self.storage.get_absolute_path(relative_path)
    
    def delete_template(self, project_id: str) -> bool:
        """
        Delete template for project
        
        Args:
            project_id: Project ID
        
        Returns:
            True if deleted successfully
        """
        template_dir = self._get_template_dir(project_id)
        
        # 删除模板目录下的所有文件
        files = self.storage.list_files(template_dir)
        for f in files:
            self.storage.delete_file(f)
        
        return True
    
    def delete_page_image(self, project_id: str, page_id: str) -> bool:
        """
        Delete all page images (all versions and their caches)

        Args:
            project_id: Project ID
            page_id: Page ID

        Returns:
            True if deleted successfully
        """
        pages_dir = self._get_pages_dir(project_id)
        
        # 查找并删除所有匹配的文件
        files = self.storage.list_files(pages_dir, f"{page_id}_*")
        for f in files:
            self.storage.delete_file(f)

        return True
    
    def delete_project_files(self, project_id: str) -> bool:
        """
        Delete all files for a project
        
        Args:
            project_id: Project ID
        
        Returns:
            True if deleted successfully
        """
        return self.storage.delete_directory(project_id)
    
    def file_exists(self, relative_path: str) -> bool:
        """Check if file exists"""
        return self.storage.file_exists(relative_path)
    
    def get_template_path(self, project_id: str) -> Optional[str]:
        """
        Get template file path for project
        
        Args:
            project_id: Project ID
        
        Returns:
            Absolute path to template file or None
        """
        # 刷新数据库会话，确保获取最新数据
        db.session.expire_all()
        project = Project.query.get(project_id)
        if project and project.template_image_path:
            # 检查文件是否存在
            if self.storage.file_exists(project.template_image_path):
                return self.storage.get_absolute_path(project.template_image_path)
        
        # 如果数据库中没有，回退到目录查找（兼容旧数据）
        template_dir = self._get_template_dir(project_id)
        files = self.storage.list_files(template_dir, "template.*")
        if files:
            # 返回第一个匹配的文件
            return self.storage.get_absolute_path(files[0])
        
        return None
    
    def _get_user_templates_dir(self) -> str:
        """Get user templates directory"""
        return "user-templates"
    
    def save_user_template(self, file, template_id: str) -> str:
        """
        Save user template image file
        
        Args:
            file: FileStorage object from Flask request
            template_id: Template ID
        
        Returns:
            Relative file path from upload folder
        """
        # Secure filename and preserve extension
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"template.{ext}"
        
        template_dir = f"{self._get_user_templates_dir()}/{template_id}"
        relative_path = f"{template_dir}/{filename}"
        
        # 确保目录存在
        self.storage.ensure_directory(template_dir)
        
        # 保存文件
        self.storage.save_file(file, relative_path)
        
        return relative_path
    
    def delete_user_template(self, template_id: str) -> bool:
        """
        Delete user template

        Args:
            template_id: Template ID

        Returns:
            True if deleted successfully
        """
        template_dir = f"{self._get_user_templates_dir()}/{template_id}"
        return self.storage.delete_directory(template_dir)

    def save_user_template_thumbnail(self, template_id: str, original_path: str,
                                      quality: int = 80, max_width: int = 600) -> Optional[str]:
        """
        Generate and save thumbnail for user template

        Args:
            template_id: Template ID
            original_path: Relative path to original template image
            quality: JPEG quality (1-100), default 80
            max_width: Maximum thumbnail width in pixels (default 600)

        Returns:
            Relative file path to thumbnail, or None if failed
        """
        try:
            # Get full path to original image
            original_full_path = self.storage.get_absolute_path(original_path)

            if not os.path.exists(original_full_path):
                return None

            # Open and process image
            image = Image.open(original_full_path)

            # Resize if needed
            image = resize_image_for_thumbnail(image, max_width)

            # Convert to RGB for JPEG
            image = convert_image_to_rgb(image)

            # Save thumbnail
            template_dir = f"{self._get_user_templates_dir()}/{template_id}"
            thumb_filename = "template-thumb.webp"
            relative_path = f"{template_dir}/{thumb_filename}"

            # 确保目录存在
            self.storage.ensure_directory(template_dir)

            self.storage.save_image(image, relative_path, format='WEBP', quality=quality)
            image.close()

            return relative_path
        except Exception as e:
            logger.error(f"Failed to save user template thumbnail: {e}")
            return None
