"""
File Service - handles all file operations
"""
import os
import uuid
from pathlib import Path
from typing import Optional
from werkzeug.utils import secure_filename
from PIL import Image


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
        template_dir = self._get_template_dir(project_id)
        
        # Find template file
        for file in template_dir.iterdir():
            if file.is_file() and file.stem == 'template':
                return str(file)
        
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
    
