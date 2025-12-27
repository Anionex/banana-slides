"""
Export Controller - handles file export endpoints
"""
from flask import Blueprint, request, current_app
from models import db, Project, Page, Task
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


@export_bp.route('/<project_id>/export/editable-pptx', methods=['POST'])
def export_editable_pptx(project_id):
    """
    POST /api/projects/{project_id}/export/editable-pptx - Export Editable PPTX (Async)
    
    🆕 现在使用新的递归分析方法（支持任意尺寸、递归子图分析）
    
    This endpoint creates an async task that:
    1. 递归分析图片（支持任意尺寸和分辨率）
    2. 转换为PDF并上传MinerU识别
    3. 提取元素bbox和生成clean background（inpainting）
    4. 递归处理图片/图表中的子元素
    5. 创建可编辑PPTX
    
    Request body (JSON):
        {
            "filename": "optional_custom_name.pptx",
            "max_depth": 2,      // 可选，递归深度（默认2）
            "max_workers": 4     // 可选，并发数（默认4）
        }
    
    Returns:
        JSON with task_id, e.g.
        {
            "success": true,
            "data": {
                "task_id": "uuid-here",
                "method": "recursive_analysis",
                "max_depth": 2,
                "max_workers": 4
            },
            "message": "Export task created"
        }
    
    Poll /api/projects/{project_id}/tasks/{task_id} for progress and download URL
    """
    try:
        import uuid
        import logging
        
        logger = logging.getLogger(__name__)
        
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Check if pages have generated images
        has_images = any(page.generated_image_path for page in pages)
        if not has_images:
            return bad_request("No generated images found for project")
        
        # Get parameters from request body
        data = request.get_json() or {}
        filename = data.get('filename', f'presentation_editable_{project_id}.pptx')
        if not filename.endswith('.pptx'):
            filename += '.pptx'
        
        # 🆕 递归分析参数
        max_depth = data.get('max_depth', 2)
        max_workers = data.get('max_workers', 4)
        
        # Validate parameters
        if not isinstance(max_depth, int) or max_depth < 0 or max_depth > 5:
            return bad_request("max_depth must be an integer between 0 and 5")
        
        if not isinstance(max_workers, int) or max_workers < 1 or max_workers > 16:
            return bad_request("max_workers must be an integer between 1 and 16")
        
        # Create task record (使用新的任务类型)
        task = Task(
            project_id=project_id,
            task_type='EXPORT_EDITABLE_PPTX',  # 保持任务类型不变，便于前端兼容
            status='PENDING'
        )
        db.session.add(task)
        db.session.commit()
        
        logger.info(f"Created export task {task.id} for project {project_id} (recursive analysis: depth={max_depth}, workers={max_workers})")
        
        # Get services
        from services.file_service import FileService
        from services.task_manager import task_manager, export_editable_pptx_with_recursive_analysis_task
        
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        # Get Flask app instance for background task
        app = current_app._get_current_object()
        
        # 🆕 使用新的递归分析任务（注意：不需要 ai_service，使用 ImageEditabilityService）
        task_manager.submit_task(
            task.id,
            export_editable_pptx_with_recursive_analysis_task,
            project_id=project_id,
            filename=filename,
            file_service=file_service,
            max_depth=max_depth,
            max_workers=max_workers,
            app=app
        )
        
        logger.info(f"Submitted recursive export task {task.id} to task manager")
        
        return success_response(
            data={
                "task_id": task.id,
                "method": "recursive_analysis",
                "max_depth": max_depth,
                "max_workers": max_workers
            },
            message="Export task created (using recursive analysis)"
        )
    
    except Exception as e:
        logger.exception("Error creating export task")
        return error_response('SERVER_ERROR', str(e), 500)


@export_bp.route('/<project_id>/export/editable-pptx-recursive', methods=['POST'])
def export_editable_pptx_recursive(project_id):
    """
    POST /api/projects/{project_id}/export/editable-pptx-recursive - 递归分析导出可编辑PPTX（新架构）
    
    使用新的ImageEditabilityService进行递归版面分析，支持：
    - 任意尺寸和分辨率的图片
    - 递归分析图片中的子图和图表
    - 智能坐标映射和元素提取
    
    Request body (JSON):
        {
            "filename": "optional_custom_name.pptx",
            "max_depth": 2,  # 可选，最大递归深度（默认2）
            "max_workers": 4  # 可选，并发处理数（默认4）
        }
    
    Returns:
        JSON with task_id
    """
    try:
        import uuid
        import logging
        
        logger = logging.getLogger(__name__)
        
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get all completed pages
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
        
        if not pages:
            return bad_request("No pages found for project")
        
        # Check if pages have generated images
        has_images = any(page.generated_image_path for page in pages)
        if not has_images:
            return bad_request("No generated images found for project")
        
        # Get parameters from request body
        data = request.get_json() or {}
        filename = data.get('filename', f'presentation_recursive_{project_id}.pptx')
        if not filename.endswith('.pptx'):
            filename += '.pptx'
        
        max_depth = data.get('max_depth', 2)
        max_workers = data.get('max_workers', 4)
        
        # Validate parameters
        if not isinstance(max_depth, int) or max_depth < 0 or max_depth > 5:
            return bad_request("max_depth must be an integer between 0 and 5")
        
        if not isinstance(max_workers, int) or max_workers < 1 or max_workers > 16:
            return bad_request("max_workers must be an integer between 1 and 16")
        
        # Create task record
        task = Task(
            project_id=project_id,
            task_type='EXPORT_EDITABLE_PPTX_RECURSIVE',
            status='PENDING'
        )
        db.session.add(task)
        db.session.commit()
        
        logger.info(f"Created recursive export task {task.id} for project {project_id} (depth={max_depth}, workers={max_workers})")
        
        # Get services
        from services.file_service import FileService
        from services.task_manager import task_manager, export_editable_pptx_with_recursive_analysis_task
        
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        # Get Flask app instance for background task
        app = current_app._get_current_object()
        
        # Submit background task（注意：不需要 ai_service，使用 ImageEditabilityService）
        task_manager.submit_task(
            task.id,
            export_editable_pptx_with_recursive_analysis_task,
            project_id=project_id,
            filename=filename,
            file_service=file_service,
            max_depth=max_depth,
            max_workers=max_workers,
            app=app
        )
        
        logger.info(f"Submitted recursive export task {task.id} to task manager")
        
        return success_response(
            data={
                "task_id": task.id,
                "method": "recursive_analysis",
                "max_depth": max_depth,
                "max_workers": max_workers
            },
            message="Recursive export task created"
        )
    
    except Exception as e:
        logger.exception("Error creating recursive export task")
        return error_response('SERVER_ERROR', str(e), 500)

