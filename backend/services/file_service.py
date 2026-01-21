"""
File Service - handles all file operations
"""
import os
import uuid
from pathlib import Path
from typing import Optional
from werkzeug.utils import secure_filename
from PIL import Image
from models import Project
from models import db


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
    """Service for file management"""
    
    def __init__(self, upload_folder: str):
        """Initialize file service"""
        self.upload_folder = Path(upload_folder)
        self.upload_folder.mkdir(exist_ok=True, parents=True)
    
    def _get_project_dir(self, project_id: str) -> Path:
        """Get project directory"""
        project_dir = self.upload_folder / project_id
        project_dir.mkdir(exist_ok=True, parents=True)
        return project_dir
    
    def _get_template_dir(self, project_id: str) -> Path:
        """Get template directory for project"""
        template_dir = self._get_project_dir(project_id) / "template"
        template_dir.mkdir(exist_ok=True, parents=True)
        return template_dir
    
    def _get_pages_dir(self, project_id: str) -> Path:
        """Get pages directory for project"""
        pages_dir = self._get_project_dir(project_id) / "pages"
        pages_dir.mkdir(exist_ok=True, parents=True)
        return pages_dir

    def _get_exports_dir(self, project_id: str) -> Path:
        """Get exports directory for project (for generated PPT/PDF files)"""
        exports_dir = self._get_project_dir(project_id) / "exports"
        exports_dir.mkdir(exist_ok=True, parents=True)
        return exports_dir

    def _get_materials_dir(self, project_id: str) -> Path:
        """Get materials directory for project (for standalone generated assets)"""
        materials_dir = self._get_project_dir(project_id) / "materials"
        materials_dir.mkdir(exist_ok=True, parents=True)
        return materials_dir
    
    def save_template_image(self, file, project_id: str) -> str:
        """
        Save template image file
        
        Args:
            file: FileStorage object from Flask request
            project_id: Project ID
        
        Returns:
            Relative file path from upload folder
        """
        template_dir = self._get_template_dir(project_id)
        
        # Secure filename and add unique suffix
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"template.{ext}"
        
        filepath = template_dir / filename
        file.save(str(filepath))
        
        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()
    
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

        # Use lowercase extension
        ext = image_format.lower()

        # Generate filename with version number or timestamp
        if version_number is not None:
            filename = f"{page_id}_v{version_number}.{ext}"
        else:
            # Use timestamp for unique filename
            import time
            timestamp = int(time.time() * 1000)  # milliseconds
            filename = f"{page_id}_{timestamp}.{ext}"

        filepath = pages_dir / filename

        # Save image - format is determined by file extension or explicitly specified
        # Some PIL Image objects may not support format parameter, so we use extension
        image.save(str(filepath))

        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()

    def get_cached_image_path(self, project_id: str, page_id: str, version_number: int) -> str:
        """
        Generate the relative path for a cached thumbnail image.

        This method centralizes the path generation logic for cached images,
        ensuring consistency across the codebase (DRY principle).

        Args:
            project_id: Project ID
            page_id: Page ID
            version_number: Version number

        Returns:
            Relative file path from upload folder (e.g., "project_id/pages/page_id_v1_thumb.jpg")
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

        # Use centralized path generation
        relative_path = self.get_cached_image_path(project_id, page_id, version_number)
        filename = Path(relative_path).name
        filepath = pages_dir / filename

        # Resize image if too large (for faster loading)
        image = resize_image_for_thumbnail(image, max_width)

        # Convert to RGB using shared function
        image = convert_image_to_rgb(image)

        # Save as compressed JPEG
        image.save(str(filepath), 'JPEG', quality=quality, optimize=True)

        # Return relative path
        return relative_path

    def save_material_image(self, image: Image.Image, project_id: Optional[str],
                            image_format: str = 'PNG') -> str:
        """
        Save standalone generated material image (not bound to a specific page)

        Args:
            image: PIL Image object
            project_id: Project ID (None for global materials)
            image_format: Image format (PNG, JPEG, etc.)

        Returns:
            Relative file path from upload folder
        """
        # Handle global materials (project_id is None)
        if project_id is None:
            materials_dir = self.upload_folder / "materials"
            materials_dir.mkdir(exist_ok=True, parents=True)
        else:
            materials_dir = self._get_materials_dir(project_id)

        # Use lowercase extension
        ext = image_format.lower()

        # Generate unique filename
        import time
        timestamp = int(time.time() * 1000)  # milliseconds
        filename = f"material_{timestamp}.{ext}"

        filepath = materials_dir / filename

        # Save image
        image.save(str(filepath))

        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()
    
    def delete_page_image_version(self, image_path: str) -> bool:
        """
        Delete a specific image version file and its cache

        Args:
            image_path: Relative path to the image file

        Returns:
            True if deleted successfully
        """
        filepath = self.upload_folder / image_path.replace('\\', '/')
        deleted = False

        if filepath.exists() and filepath.is_file():
            filepath.unlink()
            deleted = True

        # Also delete corresponding cache file (_thumb.jpg)
        # e.g., xxx_v1.png -> xxx_v1_thumb.jpg
        cache_filepath = filepath.parent / f"{filepath.stem}_thumb.jpg"
        if cache_filepath.exists() and cache_filepath.is_file():
            cache_filepath.unlink()

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
            # Global materials
            return f"/files/materials/{filename}"
        return f"/files/{project_id}/{file_type}/{filename}"
    
    def get_absolute_path(self, relative_path: str) -> str:
        """
        Get absolute file path from relative path
        
        Args:
            relative_path: Relative path from upload folder
        
        Returns:
            Absolute file path
        """
        return str(self.upload_folder / relative_path.replace('\\', '/'))
    
    def delete_template(self, project_id: str) -> bool:
        """
        Delete template for project
        
        Args:
            project_id: Project ID
        
        Returns:
            True if deleted successfully
        """
        template_dir = self._get_template_dir(project_id)
        
        # Delete all files in template directory
        for file in template_dir.iterdir():
            if file.is_file():
                file.unlink()
        
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

        # Find and delete all page image files (all versions and caches)
        # Pattern matches: {page_id}_v1.png, {page_id}_v1_thumb.jpg, etc.
        for file in pages_dir.glob(f"{page_id}_*"):
            if file.is_file():
                file.unlink()

        return True
    
    def delete_project_files(self, project_id: str) -> bool:
        """
        Delete all files for a project
        
        Args:
            project_id: Project ID
        
        Returns:
            True if deleted successfully
        """
        import shutil
        project_dir = self._get_project_dir(project_id)
        
        if project_dir.exists():
            shutil.rmtree(project_dir)
        
        return True
    
    def file_exists(self, relative_path: str) -> bool:
        """Check if file exists"""
        filepath = self.upload_folder / relative_path.replace('\\', '/')
        return filepath.exists() and filepath.is_file()
    
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
            # template_image_path 是相对路径，需要转换为绝对路径
            template_path = self.upload_folder / project.template_image_path
            if template_path.exists() and template_path.is_file():
                return str(template_path)
        
        # 如果数据库中没有，回退到目录查找（兼容旧数据）
        template_dir = self._get_template_dir(project_id)
        if template_dir.exists():
            # 按修改时间排序，返回最新的模板文件
            template_files = [
                f for f in template_dir.iterdir() 
                if f.is_file() and f.stem == 'template'
            ]
            if template_files:
                # 返回修改时间最新的文件
                latest_file = max(template_files, key=lambda f: f.stat().st_mtime)
                return str(latest_file)
        
        return None
    
    def _get_user_templates_dir(self) -> Path:
        """Get user templates directory"""
        templates_dir = self.upload_folder / "user-templates"
        templates_dir.mkdir(exist_ok=True, parents=True)
        return templates_dir
    
    def save_user_template(self, file, template_id: str) -> str:
        """
        Save user template image file
        
        Args:
            file: FileStorage object from Flask request
            template_id: Template ID
        
        Returns:
            Relative file path from upload folder
        """
        templates_dir = self._get_user_templates_dir()
        template_dir = templates_dir / template_id
        template_dir.mkdir(exist_ok=True, parents=True)
        
        # Secure filename and preserve extension
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"template.{ext}"
        
        filepath = template_dir / filename
        file.save(str(filepath))
        
        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()
    
    def delete_user_template(self, template_id: str) -> bool:
        """
        Delete user template

        Args:
            template_id: Template ID

        Returns:
            True if deleted successfully
        """
        import shutil
        templates_dir = self._get_user_templates_dir()
        template_dir = templates_dir / template_id

        if template_dir.exists():
            shutil.rmtree(template_dir)

        return True

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
            original_full_path = self.upload_folder / original_path.replace('\\', '/')

            if not original_full_path.exists():
                return None

            # Open and process image
            image = Image.open(str(original_full_path))

            # Resize if needed
            image = resize_image_for_thumbnail(image, max_width)

            # Convert to RGB for JPEG
            image = convert_image_to_rgb(image)

            # Save thumbnail
            templates_dir = self._get_user_templates_dir()
            template_dir = templates_dir / template_id
            template_dir.mkdir(exist_ok=True, parents=True)

            thumb_filename = "template-thumb.webp"
            thumb_filepath = template_dir / thumb_filename

            image.save(str(thumb_filepath), 'WEBP', quality=quality)
            image.close()

            return thumb_filepath.relative_to(self.upload_folder).as_posix()
        except Exception:
            return None
    
