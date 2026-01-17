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

    def _get_page_templates_dir(self, project_id: str) -> Path:
        """Get page-level templates directory for project"""
        page_templates_dir = self._get_project_dir(project_id) / "page_templates"
        page_templates_dir.mkdir(exist_ok=True, parents=True)
        return page_templates_dir

    def _get_pending_templates_dir(self, project_id: str) -> Path:
        """Get pending templates directory for project (templates uploaded before outline generation)"""
        pending_dir = self._get_project_dir(project_id) / "pending_templates"
        pending_dir.mkdir(exist_ok=True, parents=True)
        return pending_dir

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
        Delete a specific image version file
        
        Args:
            image_path: Relative path to the image file
        
        Returns:
            True if deleted successfully
        """
        filepath = self.upload_folder / image_path.replace('\\', '/')
        if filepath.exists() and filepath.is_file():
            filepath.unlink()
            return True
        return False
    
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

    def save_page_template(self, file, project_id: str, page_id: str) -> str:
        """
        Save page-level template image file

        Args:
            file: FileStorage object from Flask request
            project_id: Project ID
            page_id: Page ID

        Returns:
            Relative file path from upload folder
        """
        page_templates_dir = self._get_page_templates_dir(project_id)

        # Secure filename and preserve extension
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"{page_id}.{ext}"

        filepath = page_templates_dir / filename

        # Delete old template file for this page if exists
        for old_file in page_templates_dir.glob(f"{page_id}.*"):
            if old_file.is_file():
                old_file.unlink()

        file.save(str(filepath))

        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()

    def save_page_template_from_path(self, source_path: str, project_id: str, page_id: str) -> str:
        """
        Save page-level template image from an existing file path

        Args:
            source_path: Absolute path to source image file
            project_id: Project ID
            page_id: Page ID

        Returns:
            Relative file path from upload folder
        """
        import shutil

        page_templates_dir = self._get_page_templates_dir(project_id)

        # Get extension from source file
        source = Path(source_path)
        ext = source.suffix.lower().lstrip('.') or 'png'
        filename = f"{page_id}.{ext}"

        filepath = page_templates_dir / filename

        # Delete old template file for this page if exists
        for old_file in page_templates_dir.glob(f"{page_id}.*"):
            if old_file.is_file():
                old_file.unlink()

        # Copy file
        shutil.copy2(source_path, filepath)

        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()

    def get_page_template_path(self, project_id: str, page_id: str) -> Optional[str]:
        """
        Get page-level template file path

        Args:
            project_id: Project ID
            page_id: Page ID

        Returns:
            Absolute path to template file or None
        """
        page_templates_dir = self._get_page_templates_dir(project_id)

        # Find template file for this page
        for file in page_templates_dir.glob(f"{page_id}.*"):
            if file.is_file():
                return str(file)

        return None

    def delete_page_template(self, project_id: str, page_id: str) -> bool:
        """
        Delete page-level template

        Args:
            project_id: Project ID
            page_id: Page ID

        Returns:
            True if deleted successfully
        """
        page_templates_dir = self._get_page_templates_dir(project_id)

        # Delete template file for this page
        deleted = False
        for file in page_templates_dir.glob(f"{page_id}.*"):
            if file.is_file():
                file.unlink()
                deleted = True

        return deleted

    def delete_page_image(self, project_id: str, page_id: str) -> bool:
        """
        Delete page image
        
        Args:
            project_id: Project ID
            page_id: Page ID
        
        Returns:
            True if deleted successfully
        """
        pages_dir = self._get_pages_dir(project_id)
        
        # Find and delete page image (any extension)
        for file in pages_dir.glob(f"{page_id}.*"):
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

    def save_pending_template(self, file, project_id: str, order_index: int) -> str:
        """
        Save pending template image (uploaded before outline generation)

        Args:
            file: FileStorage object from Flask request
            project_id: Project ID
            order_index: Order index for the template (0-based)

        Returns:
            Relative file path from upload folder
        """
        pending_dir = self._get_pending_templates_dir(project_id)

        # Secure filename and preserve extension
        original_filename = secure_filename(file.filename)
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'png'
        filename = f"pending_{order_index}.{ext}"

        filepath = pending_dir / filename
        file.save(str(filepath))

        # Return relative path
        return filepath.relative_to(self.upload_folder).as_posix()

    def get_pending_templates(self, project_id: str) -> list:
        """
        Get all pending templates for a project, sorted by order index

        Args:
            project_id: Project ID

        Returns:
            List of dicts with 'path' (absolute) and 'relative_path' keys
        """
        pending_dir = self._get_pending_templates_dir(project_id)

        if not pending_dir.exists():
            return []

        templates = []
        for file in pending_dir.iterdir():
            if file.is_file() and file.stem.startswith('pending_'):
                try:
                    order_index = int(file.stem.split('_')[1])
                    templates.append({
                        'path': str(file),
                        'relative_path': file.relative_to(self.upload_folder).as_posix(),
                        'order_index': order_index
                    })
                except (ValueError, IndexError):
                    continue

        # Sort by order index
        templates.sort(key=lambda t: t['order_index'])
        return templates

    def move_pending_to_page_template(self, project_id: str, pending_path: str, page_id: str) -> str:
        """
        Move a pending template to become a page template

        Args:
            project_id: Project ID
            pending_path: Absolute path to pending template
            page_id: Page ID to associate with

        Returns:
            Relative path to the new page template
        """
        import shutil

        source = Path(pending_path)
        if not source.exists():
            raise FileNotFoundError(f"Pending template not found: {pending_path}")

        page_templates_dir = self._get_page_templates_dir(project_id)
        ext = source.suffix.lower().lstrip('.') or 'png'
        filename = f"{page_id}.{ext}"

        dest = page_templates_dir / filename

        # Delete old template file for this page if exists
        for old_file in page_templates_dir.glob(f"{page_id}.*"):
            if old_file.is_file():
                old_file.unlink()

        # Move file
        shutil.move(str(source), str(dest))

        return dest.relative_to(self.upload_folder).as_posix()

    def clear_pending_templates(self, project_id: str) -> bool:
        """
        Clear all pending templates for a project

        Args:
            project_id: Project ID

        Returns:
            True if cleared successfully
        """
        import shutil
        pending_dir = self._get_pending_templates_dir(project_id)

        if pending_dir.exists():
            shutil.rmtree(pending_dir)

        return True
    
