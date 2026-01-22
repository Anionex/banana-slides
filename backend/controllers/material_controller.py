"""
Material Controller - handles standalone material image generation
"""
from flask import Blueprint, request, current_app, send_file
from models import db, Project, Material, Task
from utils import success_response, error_response, not_found, bad_request
from services import FileService
from services.ai_service_manager import get_ai_service
from services.task_manager import task_manager, generate_material_image_task
from pathlib import Path
from werkzeug.utils import secure_filename
from typing import Optional
import tempfile
import shutil
import time
import zipfile
import io


material_bp = Blueprint('materials', __name__, url_prefix='/api/projects')
material_global_bp = Blueprint('materials_global', __name__, url_prefix='/api/materials')

ALLOWED_MATERIAL_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'}


def _build_material_query(filter_project_id: str):
    """Build common material query with project validation."""
    query = Material.query

    if filter_project_id == 'all':
        return query, None
    if filter_project_id == 'none':
        return query.filter(Material.project_id.is_(None)), None

    project = Project.query.get(filter_project_id)
    if not project:
        return None, not_found('Project')

    return query.filter(Material.project_id == filter_project_id), None


def _get_materials_list(filter_project_id: str):
    """
    Common logic to get materials list.
    Returns (materials_list, error_response)
    """
    query, error = _build_material_query(filter_project_id)
    if error:
        return None, error
    
    materials = query.order_by(Material.created_at.desc()).all()
    materials_list = [material.to_dict() for material in materials]
    
    return materials_list, None


def _handle_material_upload(default_project_id: Optional[str] = None):
    """
    Common logic to handle material upload.
    Returns Flask response object.
    """
    try:
        raw_project_id = request.args.get('project_id', default_project_id)
        target_project_id, error = _resolve_target_project_id(raw_project_id)
        if error:
            return error

        file = request.files.get('file')
        material, error = _save_material_file(file, target_project_id)
        if error:
            return error

        return success_response(material.to_dict(), status_code=201)
    
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


def _resolve_target_project_id(raw_project_id: Optional[str], allow_none: bool = True):
    """
    Normalize project_id from request.
    Returns (project_id | None, error_response | None)
    """
    if allow_none and (raw_project_id is None or raw_project_id == 'none'):
        return None, None

    if raw_project_id == 'all':
        return None, bad_request("project_id cannot be 'all' when uploading materials")

    if raw_project_id:
        project = Project.query.get(raw_project_id)
        if not project:
            return None, not_found('Project')

    return raw_project_id, None


def _save_material_file(file, target_project_id: Optional[str]):
    """Shared logic for saving uploaded material files to disk and DB."""
    if not file or not file.filename:
        return None, bad_request("file is required")

    filename = secure_filename(file.filename)
    file_ext = Path(filename).suffix.lower()
    if file_ext not in ALLOWED_MATERIAL_EXTENSIONS:
        return None, bad_request(f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_MATERIAL_EXTENSIONS))}")

    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    if target_project_id:
        materials_dir = file_service._get_materials_dir(target_project_id)
    else:
        materials_dir = file_service.upload_folder / "materials"
        materials_dir.mkdir(exist_ok=True, parents=True)

    timestamp = int(time.time() * 1000)
    base_name = Path(filename).stem
    unique_filename = f"{base_name}_{timestamp}{file_ext}"

    filepath = materials_dir / unique_filename
    file.save(str(filepath))

    relative_path = str(filepath.relative_to(file_service.upload_folder))
    if target_project_id:
        image_url = file_service.get_file_url(target_project_id, 'materials', unique_filename)
    else:
        image_url = f"/files/materials/{unique_filename}"

    material = Material(
        project_id=target_project_id,
        filename=unique_filename,
        relative_path=relative_path,
        url=image_url
    )

    try:
        db.session.add(material)
        db.session.commit()
        return material, None
    except Exception:
        db.session.rollback()
        raise


@material_bp.route('/<project_id>/materials/generate', methods=['POST'])
def generate_material_image(project_id):
    """
    POST /api/projects/{project_id}/materials/generate - Generate a standalone material image

    Supports multipart/form-data:
    - prompt: Text-to-image prompt (passed directly to the model without modification)
    - ref_image: Main reference image (optional)
    - extra_images: Additional reference images (multiple files, optional)
    
    Note: project_id can be 'none' to generate global materials (not associated with any project)
    """
    try:
        # 支持 'none' 作为特殊值，表示生成全局素材
        if project_id != 'none':
            project = Project.query.get(project_id)
            if not project:
                return not_found('Project')
        else:
            project = None
            project_id = None  # 设置为None表示全局素材

        # Parse request data (prioritize multipart for file uploads)
        if request.is_json:
            data = request.get_json() or {}
            prompt = data.get('prompt', '').strip()
            ref_file = None
            extra_files = []
        else:
            data = request.form.to_dict()
            prompt = (data.get('prompt') or '').strip()
            ref_file = request.files.get('ref_image')
            extra_files = request.files.getlist('extra_images') or []

        if not prompt:
            return bad_request("prompt is required")

        # 处理project_id：对于全局素材，使用'global'作为Task的project_id
        # Task模型要求project_id不能为null，但Material可以
        task_project_id = project_id if project_id is not None else 'global'
        
        # 验证project_id（如果不是'global'）
        if task_project_id != 'global':
            project = Project.query.get(task_project_id)
            if not project:
                return not_found('Project')

        # Initialize services
        ai_service = get_ai_service()
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])

        # 创建临时目录保存参考图片（后台任务会清理）
        temp_dir = Path(tempfile.mkdtemp(dir=current_app.config['UPLOAD_FOLDER']))
        temp_dir_str = str(temp_dir)

        try:
            ref_path = None
            # Save main reference image to temp directory if provided
            if ref_file and ref_file.filename:
                ref_filename = secure_filename(ref_file.filename or 'ref.png')
                ref_path = temp_dir / ref_filename
                ref_file.save(str(ref_path))
                ref_path_str = str(ref_path)
            else:
                ref_path_str = None

            # Save additional reference images to temp directory
            additional_ref_images = []
            for extra in extra_files:
                if not extra or not extra.filename:
                    continue
                extra_filename = secure_filename(extra.filename)
                extra_path = temp_dir / extra_filename
                extra.save(str(extra_path))
                additional_ref_images.append(str(extra_path))

            # Create async task for material generation
            task = Task(
                project_id=task_project_id,
                task_type='GENERATE_MATERIAL',
                status='PENDING'
            )
            task.set_progress({
                'total': 1,
                'completed': 0,
                'failed': 0
            })
            db.session.add(task)
            db.session.commit()

            # Get app instance for background task
            app = current_app._get_current_object()

            # Submit background task
            task_manager.submit_task(
                task.id,
                generate_material_image_task,
                task_project_id,  # 传递给任务函数，它会处理'global'的情况
                prompt,
                ai_service,
                file_service,
                ref_path_str,
                additional_ref_images if additional_ref_images else None,
                current_app.config['DEFAULT_ASPECT_RATIO'],
                current_app.config['DEFAULT_RESOLUTION'],
                temp_dir_str,
                app
            )

            # Return task_id immediately (不再清理temp_dir，由后台任务清理)
            return success_response({
                'task_id': task.id,
                'status': 'PENDING'
            }, status_code=202)
        
        except Exception as e:
            # Clean up temp directory on error
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            raise

    except Exception as e:
        db.session.rollback()
        return error_response('AI_SERVICE_ERROR', str(e), 503)


@material_bp.route('/<project_id>/materials', methods=['GET'])
def list_materials(project_id):
    """
    GET /api/projects/{project_id}/materials - List materials for a specific project
    
    Returns:
        List of material images with filename, url, and metadata for the specified project
    """
    try:
        materials_list, error = _get_materials_list(project_id)
        if error:
            return error
        
        return success_response({
            "materials": materials_list,
            "count": len(materials_list)
        })
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@material_bp.route('/<project_id>/materials/upload', methods=['POST'])
def upload_material(project_id):
    """
    POST /api/projects/{project_id}/materials/upload - Upload a material image
    
    Supports multipart/form-data:
    - file: Image file (required)
    - project_id: Optional query parameter, defaults to path parameter if not provided
    
    Returns:
        Material info with filename, url, and metadata
    """
    return _handle_material_upload(default_project_id=project_id)


@material_global_bp.route('', methods=['GET'])
def list_all_materials():
    """
    GET /api/materials - Global materials endpoint for complex queries
    
    Query params:
        - project_id: Filter by project_id
          * 'all' (default): Get all materials regardless of project
          * 'none': Get only materials without a project (global materials)
          * <project_id>: Get materials for specific project
    
    Returns:
        List of material images with filename, url, and metadata
    """
    try:
        filter_project_id = request.args.get('project_id', 'all')
        materials_list, error = _get_materials_list(filter_project_id)
        if error:
            return error
        
        return success_response({
            "materials": materials_list,
            "count": len(materials_list)
        })
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@material_global_bp.route('/upload', methods=['POST'])
def upload_material_global():
    """
    POST /api/materials/upload - Upload a material image (global, not bound to a project)
    
    Supports multipart/form-data:
    - file: Image file (required)
    - project_id: Optional query parameter to associate with a project
    
    Returns:
        Material info with filename, url, and metadata
    """
    return _handle_material_upload(default_project_id=None)


@material_global_bp.route('/<material_id>', methods=['DELETE'])
def delete_material(material_id):
    """
    DELETE /api/materials/{material_id} - Delete a material and its file
    """
    try:
        material = Material.query.get(material_id)
        if not material:
            return not_found('Material')

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        material_path = Path(file_service.get_absolute_path(material.relative_path))

        # First, delete the database record to ensure data consistency
        db.session.delete(material)
        db.session.commit()

        # Then, attempt to delete the file. If this fails, log the error
        # but still return a success response. This leaves an orphan file,
        try:
            if material_path.exists():
                material_path.unlink(missing_ok=True)
        except OSError as e:
            current_app.logger.warning(f"Failed to delete file for material {material_id} at {material_path}: {e}")

        return success_response({"id": material_id})
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@material_global_bp.route('/associate', methods=['POST'])
def associate_materials_to_project():
    """
    POST /api/materials/associate - Associate materials to a project by URLs

    Request body (JSON):
    {
        "project_id": "project_id",
        "material_urls": ["url1", "url2", ...]
    }

    Returns:
        List of associated material IDs and count
    """
    try:
        data = request.get_json() or {}
        project_id = data.get('project_id')
        material_urls = data.get('material_urls', [])

        if not project_id:
            return bad_request("project_id is required")

        if not material_urls or not isinstance(material_urls, list):
            return bad_request("material_urls must be a non-empty array")

        # Validate project exists
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        # Find materials by URLs and update their project_id
        updated_ids = []
        materials_to_update = Material.query.filter(
            Material.url.in_(material_urls),
            Material.project_id.is_(None)
        ).all()
        for material in materials_to_update:
            material.project_id = project_id
            updated_ids.append(material.id)

        db.session.commit()

        return success_response({
            "updated_ids": updated_ids,
            "count": len(updated_ids)
        })

    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@material_global_bp.route('/download', methods=['POST'])
def download_materials_zip():
    """
    POST /api/materials/download - Download multiple materials as a zip file

    Request body (JSON):
    {
        "material_ids": ["id1", "id2", ...]
    }

    Returns:
        Zip file containing all requested materials
    """
    try:
        data = request.get_json() or {}
        material_ids = data.get('material_ids', [])

        if not material_ids or not isinstance(material_ids, list):
            return bad_request("material_ids must be a non-empty array")

        # Query materials
        materials = Material.query.filter(Material.id.in_(material_ids)).all()

        if not materials:
            return not_found('Materials')

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])

        # Create zip file in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for material in materials:
                try:
                    # Get absolute path of the material file
                    material_path = Path(file_service.get_absolute_path(material.relative_path))

                    if material_path.exists():
                        # Use original filename or material filename
                        arcname = material.filename
                        zip_file.write(str(material_path), arcname)
                except Exception as e:
                    current_app.logger.warning(f"Failed to add material {material.id} to zip: {e}")
                    continue

        zip_buffer.seek(0)

        # Generate filename with timestamp
        timestamp = int(time.time())
        zip_filename = f"materials_{timestamp}.zip"

        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )

    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)

