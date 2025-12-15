"""
Export Controller - handles file export endpoints
"""
from flask import Blueprint, request, current_app
from models import db, Project, Page
from utils import error_response, not_found, bad_request, success_response
from services import ExportService, FileService
import os
import io

export_bp = Blueprint('export', __name__, url_prefix='/api/projects')


@export_bp.route('/<project_id>/export/pptx', methods=['GET'])
def export_pptx(project_id):
    """
    GET /api/projects/{project_id}/export/pptx?filename=... - Export PPTX
    
    Returns:
        JSON with download URL, e.g.
        {
            "success": true,
            "data": {
                "download_url": "/files/{project_id}/exports/xxx.pptx",
                "download_url_absolute": "http://host:port/files/{project_id}/exports/xxx.pptx"
            }
        }
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Get image paths
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        image_paths = []
        for page in pages:
            if page.generated_image_path:
                abs_path = file_service.get_absolute_path(page.generated_image_path)
                image_paths.append(abs_path)
        
        if not image_paths:
            return bad_request("No generated images found for project")
        
        # Determine export directory and filename
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        exports_dir = file_service._get_exports_dir(project_id)
        
        # Get filename from query params or use default
        filename = request.args.get('filename', f'presentation_{project_id}.pptx')
        if not filename.endswith('.pptx'):
            filename += '.pptx'

        output_path = os.path.join(exports_dir, filename)

        # Generate PPTX file on disk
        ExportService.create_pptx_from_images(image_paths, output_file=output_path)

        # Build download URLs
        download_path = f"/files/{project_id}/exports/{filename}"
        base_url = request.url_root.rstrip("/")
        download_url_absolute = f"{base_url}{download_path}"

        return success_response(
            data={
                "download_url": download_path,
                "download_url_absolute": download_url_absolute,
            },
            message="Export PPTX task created"
        )
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@export_bp.route('/<project_id>/export/pdf', methods=['GET'])
def export_pdf(project_id):
    """
    GET /api/projects/{project_id}/export/pdf?filename=... - Export PDF
    
    Returns:
        JSON with download URL, e.g.
        {
            "success": true,
            "data": {
                "download_url": "/files/{project_id}/exports/xxx.pdf",
                "download_url_absolute": "http://host:port/files/{project_id}/exports/xxx.pdf"
            }
        }
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Get image paths
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        image_paths = []
        for page in pages:
            if page.generated_image_path:
                abs_path = file_service.get_absolute_path(page.generated_image_path)
                image_paths.append(abs_path)
        
        if not image_paths:
            return bad_request("No generated images found for project")
        
        # Determine export directory and filename
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        exports_dir = file_service._get_exports_dir(project_id)

        # Get filename from query params or use default
        filename = request.args.get('filename', f'presentation_{project_id}.pdf')
        if not filename.endswith('.pdf'):
            filename += '.pdf'

        output_path = os.path.join(exports_dir, filename)

        # Generate PDF file on disk
        ExportService.create_pdf_from_images(image_paths, output_file=output_path)

        # Build download URLs
        download_path = f"/files/{project_id}/exports/{filename}"
        base_url = request.url_root.rstrip("/")
        download_url_absolute = f"{base_url}{download_path}"

        return success_response(
            data={
                "download_url": download_path,
                "download_url_absolute": download_url_absolute,
            },
            message="Export PDF task created"
        )
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)

