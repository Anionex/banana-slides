"""
Reference File Controller - handles file upload and parsing
"""
import os
import logging
import re
import uuid
from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from pathlib import Path
from config import Config
from datetime import datetime
from urllib.parse import unquote
import threading

from models import db, ReferenceFile, Project
from utils.response import success_response, error_response, bad_request, not_found
from services.file_parser_service import FileParserService

logger = logging.getLogger(__name__)

reference_file_bp = Blueprint('reference_file', __name__)


def _allowed_file(filename: str, allowed_extensions: set) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions


def _get_file_type(filename: str) -> str:
    """Get file type from filename"""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return 'unknown'


def _parse_file_async(file_id: str, file_path: str, filename: str, app):
    """
    Parse file asynchronously in background
    
    Args:
        file_id: Reference file ID
        file_path: Path to the uploaded file
        filename: Original filename
        app: Flask app instance (for app context)
    """
    with app.app_context():
        try:
            reference_file = ReferenceFile.query.get(file_id)
            if not reference_file:
                logger.error(f"Reference file {file_id} not found")
                return
            
            # Update status to parsing
            reference_file.parse_status = 'parsing'
            db.session.commit()
            
            # Initialize parser service
            parser = FileParserService(
                mineru_token=current_app.config['MINERU_TOKEN'],
                mineru_api_base=current_app.config['MINERU_API_BASE'],
                google_api_key=current_app.config.get('GOOGLE_API_KEY', ''),
                google_api_base=current_app.config.get('GOOGLE_API_BASE', ''),
                openai_api_key=current_app.config.get('OPENAI_API_KEY', ''),
                openai_api_base=current_app.config.get('OPENAI_API_BASE', ''),
                image_caption_model=current_app.config['IMAGE_CAPTION_MODEL'],
                provider_format=current_app.config.get('AI_PROVIDER_FORMAT', 'gemini')
            )
            
            # Parse file
            logger.info(f"Starting to parse file: {filename}")
            batch_id, markdown_content, extract_id, error_message, failed_image_count = parser.parse_file(file_path, filename)
            
            # Update database
            reference_file.mineru_batch_id = batch_id
            if error_message:
                reference_file.parse_status = 'failed'
                reference_file.error_message = error_message
                logger.error(f"File parsing failed: {error_message}")
            else:
                reference_file.parse_status = 'completed'
                reference_file.markdown_content = markdown_content
                if failed_image_count > 0:
                    logger.warning(f"File parsing completed: {filename}, but {failed_image_count} images failed to generate captions")
                else:
                    logger.info(f"File parsing completed: {filename}")
            
            reference_file.updated_at = datetime.utcnow()
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Error in async file parsing: {str(e)}", exc_info=True)
            try:
                reference_file = ReferenceFile.query.get(file_id)
                if reference_file:
                    reference_file.parse_status = 'failed'
                    reference_file.error_message = f"Parsing error: {str(e)}"
                    reference_file.updated_at = datetime.utcnow()
                    db.session.commit()
            except Exception as db_error:
                logger.error(f"Failed to update error status: {str(db_error)}")


@reference_file_bp.route('/upload', methods=['POST'])
def upload_reference_file():
    """
    POST /api/reference-files/upload - Upload a reference file
    
    Supports multipart/form-data:
    - file: The file to upload (required)
    - project_id: Project ID to associate with (optional, 'none' for global files)
    
    Returns:
        Reference file information with status
    """
    try:
        # Check if file is in request
        if 'file' not in request.files:
            return bad_request("No file provided")
        
        file = request.files['file']
        
        # Get filename - handle encoding issues with non-ASCII characters
        original_filename = file.filename
        if not original_filename or original_filename == '':
            # Try to get filename from Content-Disposition header
            content_disposition = request.headers.get('Content-Disposition', '')
            if content_disposition:
                filename_match = re.search(r'filename[^;=\n]*=(([\'"]).*?\2|[^;\n]*)', content_disposition)
                if filename_match:
                    original_filename = filename_match.group(1).strip('"\'')
                    # Decode if URL encoded
                    try:
                        original_filename = unquote(original_filename)
                    except:
                        pass
        
        if not original_filename or original_filename == '':
            return bad_request("No file selected or filename could not be determined")
        
        logger.info(f"Received file upload: {original_filename}")
        
        # Check file extension
        
        allowed_extensions = current_app.config.get('ALLOWED_REFERENCE_FILE_EXTENSIONS', Config.ALLOWED_REFERENCE_FILE_EXTENSIONS)
        if not _allowed_file(original_filename, allowed_extensions):
            return bad_request(f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}")
        
        # Get project_id (optional)
        project_id = request.form.get('project_id')
        if project_id == 'none' or not project_id:
            project_id = None
        else:
            # Verify project exists
            project = Project.query.get(project_id)
            if not project:
                return not_found('Project')
        
        # Secure filename for filesystem (but keep original for database)
        # secure_filename removes non-ASCII chars, so we need to handle Chinese characters
        filename = secure_filename(original_filename)
        
        # If secure_filename removed everything (e.g., all Chinese chars), use a fallback
        if not filename or filename == '':
            # Extract extension from original filename
            ext = _get_file_type(original_filename)
            if ext == 'unknown':
                ext = 'file'
            filename = f"file_{uuid.uuid4().hex[:8]}.{ext}"
            logger.warning(f"Original filename '{original_filename}' was sanitized to '{filename}'")
        
        # Create upload directory structure
        upload_folder = current_app.config['UPLOAD_FOLDER']
        reference_files_dir = Path(upload_folder) / 'reference_files'
        reference_files_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename to avoid conflicts
        unique_id = str(uuid.uuid4())[:8]
        file_type = _get_file_type(original_filename)  # Use original filename for type detection
        unique_filename = f"{unique_id}_{filename}"
        file_path = reference_files_dir / unique_filename
        
        # Save file
        file.save(str(file_path))
        file_size = os.path.getsize(file_path)
        
        # Create database record
        reference_file = ReferenceFile(
            project_id=project_id,
            filename=original_filename,
            file_path=str(file_path.relative_to(upload_folder)),
            file_size=file_size,
            file_type=file_type,
            parse_status='pending'
        )
        
        db.session.add(reference_file)
        db.session.commit()
        
        logger.info(f"File uploaded: {original_filename} (ID: {reference_file.id})")
        
        # Lazy parsing: 不立即解析，等待用户选择确定后再解析
        # 解析将在用户选择文件并确认时触发
        
        return success_response({'file': reference_file.to_dict()})
        
    except Exception as e:
        logger.error(f"Error uploading reference file: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/<file_id>', methods=['GET'])
def get_reference_file(file_id):
    """
    GET /api/reference-files/<file_id> - Get reference file information
    
    Returns:
        Reference file information including parse status
    """
    try:
        reference_file = ReferenceFile.query.get(file_id)
        if not reference_file:
            return not_found('Reference file')
        
        # 单个文件查询时包含内容和失败计数（会在 to_dict 中根据状态判断是否计算）
        return success_response({'file': reference_file.to_dict(include_content=True, include_failed_count=True)})
        
    except Exception as e:
        logger.error(f"Error getting reference file: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/<file_id>', methods=['DELETE'])
def delete_reference_file(file_id):
    """
    DELETE /api/reference-files/<file_id> - Delete a reference file
    
    Returns:
        Success message
    """
    try:
        reference_file = ReferenceFile.query.get(file_id)
        if not reference_file:
            return not_found('Reference file')
        
        # Delete file from disk
        try:
            upload_folder = current_app.config['UPLOAD_FOLDER']
            file_path = Path(upload_folder) / reference_file.file_path
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted file from disk: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to delete file from disk: {str(e)}")
        
        # Delete from database
        db.session.delete(reference_file)
        db.session.commit()
        
        logger.info(f"Deleted reference file: {file_id}")
        
        return success_response({'message': 'File deleted successfully'})
        
    except Exception as e:
        logger.error(f"Error deleting reference file: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/project/<project_id>', methods=['GET'])
def list_project_reference_files(project_id):
    """
    GET /api/reference-files/project/<project_id> - List all reference files for a project
    
    Special values:
    - 'all': List all reference files (global + all projects)
    - 'global' or 'none': List only global files (not associated with any project)
    - project_id: List files for specific project
    
    Returns:
        List of reference files
    """
    try:
        # Special case: 'all' means list all files
        if project_id == 'all':
            reference_files = ReferenceFile.query.all()
        # Special case: 'global' or 'none' means list global files (not associated with any project)
        elif project_id in ['global', 'none']:
            reference_files = ReferenceFile.query.filter_by(project_id=None).all()
        else:
            # Verify project exists
            project = Project.query.get(project_id)
            if not project:
                return not_found('Project')
            
            reference_files = ReferenceFile.query.filter_by(project_id=project_id).all()
        
        # 列表查询时不包含 markdown_content 和失败计数，加快响应速度
        return success_response({
            'files': [f.to_dict(include_content=False) for f in reference_files]
        })
        
    except Exception as e:
        logger.error(f"Error listing reference files: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/<file_id>/parse', methods=['POST'])
def trigger_file_parse(file_id):
    """
    POST /api/reference-files/<file_id>/parse - Trigger parsing for a reference file
    
    Returns:
        Updated reference file information
    """
    try:
        reference_file = ReferenceFile.query.get(file_id)
        if not reference_file:
            return not_found('Reference file')
        
        # 如果正在解析，直接返回
        if reference_file.parse_status == 'parsing':
            return success_response({
                'file': reference_file.to_dict(),
                'message': 'File is already being parsed'
            })
        
        # 如果解析完成或失败，可以重新解析
        if reference_file.parse_status in ['completed', 'failed']:
            reference_file.parse_status = 'pending'
            reference_file.error_message = None
            # 清空之前的解析结果，以便重新解析
            reference_file.markdown_content = None
            reference_file.mineru_batch_id = None
            db.session.commit()
        
        # 获取文件路径
        upload_folder = current_app.config['UPLOAD_FOLDER']
        file_path = Path(upload_folder) / reference_file.file_path
        
        if not file_path.exists():
            return error_response('FILE_NOT_FOUND', f'File not found: {file_path}', 404)
        
        # 启动异步解析
        thread = threading.Thread(
            target=_parse_file_async,
            args=(reference_file.id, str(file_path), reference_file.filename, current_app._get_current_object())
        )
        thread.daemon = True
        thread.start()
        
        logger.info(f"Triggered parsing for file: {reference_file.filename} (ID: {file_id})")
        
        return success_response({
            'file': reference_file.to_dict(),
            'message': 'Parsing started'
        })
        
    except Exception as e:
        logger.error(f"Error triggering file parse: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/<file_id>/associate', methods=['POST'])
def associate_file_to_project(file_id):
    """
    POST /api/reference-files/<file_id>/associate - Associate a reference file to a project
    
    Request body:
    {
        "project_id": "project-id-here"
    }
    
    Returns:
        Updated reference file information
    """
    try:
        reference_file = ReferenceFile.query.get(file_id)
        if not reference_file:
            return not_found('Reference file')
        
        data = request.get_json() or {}
        project_id = data.get('project_id')
        
        if not project_id:
            return bad_request("project_id is required")
        
        # Verify project exists
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')
        
        # Update file's project_id
        reference_file.project_id = project_id
        reference_file.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Associated reference file {file_id} to project {project_id}")
        
        return success_response({'file': reference_file.to_dict()})
        
    except Exception as e:
        logger.error(f"Error associating reference file: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@reference_file_bp.route('/<file_id>/dissociate', methods=['POST'])
def dissociate_file_from_project(file_id):
    """
    POST /api/reference-files/<file_id>/dissociate - Remove a reference file from its project
    
    This sets the file's project_id to None, effectively making it a global file.
    The file itself is not deleted.
    
    Returns:
        Updated reference file information
    """
    try:
        reference_file = ReferenceFile.query.get(file_id)
        if not reference_file:
            return not_found('Reference file')
        
        # Remove project association
        reference_file.project_id = None
        reference_file.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Dissociated reference file {file_id} from project")
        
        return success_response({'file': reference_file.to_dict(), 'message': 'File removed from project'})
        
    except Exception as e:
        logger.error(f"Error dissociating reference file: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)

