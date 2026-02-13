"""
Export Controller - handles file export endpoints
"""
import logging
import os
import io

from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from models import db, Project, Page, Task
from utils import (
    error_response, not_found, bad_request, success_response,
    parse_page_ids_from_query, parse_page_ids_from_body, get_filtered_pages
)
from services import ExportService, FileService
from services.ai_service_manager import get_ai_service

logger = logging.getLogger(__name__)

export_bp = Blueprint('export', __name__, url_prefix='/api/projects')


@export_bp.route('/<project_id>/export/pptx', methods=['GET'])
def export_pptx(project_id):
    """
    GET /api/projects/{project_id}/export/pptx?filename=...&page_ids=id1,id2,id3 - Export PPTX
    
    Query params:
        - filename: optional custom filename
        - page_ids: optional comma-separated page IDs to export (if not provided, exports all pages)
    
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
        
        # Get page_ids from query params and fetch filtered pages
        selected_page_ids = parse_page_ids_from_query(request)
        logger.debug(f"[export_pptx] selected_page_ids: {selected_page_ids}")
        
        pages = get_filtered_pages(project_id, selected_page_ids if selected_page_ids else None)
        logger.debug(f"[export_pptx] Exporting {len(pages)} pages")
        
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
        exports_dir = file_service._get_exports_dir(project_id)

        # Get filename from query params or use default
        filename = secure_filename(request.args.get('filename', f'presentation_{project_id}.pptx'))
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
    GET /api/projects/{project_id}/export/pdf?filename=...&page_ids=id1,id2,id3 - Export PDF
    
    Query params:
        - filename: optional custom filename
        - page_ids: optional comma-separated page IDs to export (if not provided, exports all pages)
    
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
        
        # Get page_ids from query params and fetch filtered pages
        selected_page_ids = parse_page_ids_from_query(request)
        pages = get_filtered_pages(project_id, selected_page_ids if selected_page_ids else None)
        
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
        exports_dir = file_service._get_exports_dir(project_id)

        # Get filename from query params or use default
        filename = secure_filename(request.args.get('filename', f'presentation_{project_id}.pdf'))
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
    POST /api/projects/{project_id}/export/editable-pptx - 导出可编辑PPTX（异步）
    
    使用递归分析方法（支持任意尺寸、递归子图分析）
    
    这个端点创建一个异步任务来执行以下操作：
    1. 递归分析图片（支持任意尺寸和分辨率）
    2. 转换为PDF并上传MinerU识别
    3. 提取元素bbox和生成clean background（inpainting）
    4. 递归处理图片/图表中的子元素
    5. 创建可编辑PPTX
    
    Request body (JSON):
        {
            "filename": "optional_custom_name.pptx",
            "page_ids": ["id1", "id2"],  // 可选，要导出的页面ID列表（不提供则导出所有）
            "max_depth": 1,      // 可选，递归深度（默认1=不递归，2=递归一层）
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
    
    轮询 /api/projects/{project_id}/tasks/{task_id} 获取进度和下载链接
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Get parameters from request body
        data = request.get_json() or {}
        
        # Get page_ids from request body and fetch filtered pages
        selected_page_ids = parse_page_ids_from_body(data)
        pages = get_filtered_pages(project_id, selected_page_ids if selected_page_ids else None)
        
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
        
        # 递归分析参数
        # max_depth 语义：1=只处理表层不递归，2=递归一层（处理图片/图表中的子元素）
        max_depth = data.get('max_depth', 1)  # 默认不递归，与测试脚本一致
        max_workers = data.get('max_workers', 4)
        
        # Validate parameters
        # max_depth >= 1: 至少处理表层元素
        if not isinstance(max_depth, int) or max_depth < 1 or max_depth > 5:
            return bad_request("max_depth must be an integer between 1 and 5")
        
        if not isinstance(max_workers, int) or max_workers < 1 or max_workers > 16:
            return bad_request("max_workers must be an integer between 1 and 16")
        
        # Create task record
        task = Task(
            project_id=project_id,
            task_type='EXPORT_EDITABLE_PPTX',
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
        
        # 读取项目的导出设置
        export_extractor_method = project.export_extractor_method or 'hybrid'
        export_inpaint_method = project.export_inpaint_method or 'hybrid'
        logger.info(f"Export settings: extractor={export_extractor_method}, inpaint={export_inpaint_method}")
        
        # 使用递归分析任务（不需要 ai_service，使用 ImageEditabilityService）
        task_manager.submit_task(
            task.id,
            export_editable_pptx_with_recursive_analysis_task,
            project_id=project_id,
            filename=filename,
            file_service=file_service,
            page_ids=selected_page_ids if selected_page_ids else None,
            max_depth=max_depth,
            max_workers=max_workers,
            export_extractor_method=export_extractor_method,
            export_inpaint_method=export_inpaint_method,
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
