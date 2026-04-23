"""File Controller - handles static file serving."""
import mimetypes
from pathlib import Path
import os

from flask import Blueprint, current_app, Response, send_from_directory

from middlewares.auth import authenticate_request
from models import Material, Project, UserTemplate
from services.storage import get_storage, LocalStorage
from utils import error_response, not_found
from utils.path_utils import find_file_with_prefix
from werkzeug.utils import secure_filename

file_bp = Blueprint('files', __name__, url_prefix='/files')


def _serve_from_storage(relative_path):
    """Serve a file via storage backend: local uses send_from_directory, cloud streams."""
    storage = get_storage()
    if isinstance(storage, LocalStorage):
        absolute = Path(storage.get_absolute_path(relative_path))
        if not absolute.exists():
            return not_found('File')
        return send_from_directory(str(absolute.parent), absolute.name)

    stream, content_length = storage.get_file_stream(relative_path)
    if stream is None:
        return not_found('File')

    content_type = mimetypes.guess_type(relative_path)[0] or 'application/octet-stream'
    headers = {'Content-Length': str(content_length)} if content_length else {}
    return Response(stream, content_type=content_type, headers=headers)


def _get_owned_project(project_id, user_id):
    return Project.query.filter(
        Project.id == project_id,
        Project.user_id == user_id,
    ).first()


@file_bp.route('/<project_id>/<file_type>/<filename>', methods=['GET'])
def serve_file(project_id, file_type, filename):
    """
    GET /files/{project_id}/{type}/{filename} - Serve static files
    
    Args:
        project_id: Project UUID
        file_type: 'template' or 'pages'
        filename: File name
    """
    try:
        user, auth_error = authenticate_request(allow_query=True)
        if auth_error:
            return auth_error

        if file_type not in ['template', 'pages', 'materials', 'exports']:
            return not_found('File')

        project = _get_owned_project(project_id, user.id)
        if not project:
            return not_found('File')

        relative_path = os.path.join(project_id, file_type, filename)
        return _serve_from_storage(relative_path)

    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@file_bp.route('/user-templates/<template_id>/<filename>', methods=['GET'])
def serve_user_template(template_id, filename):
    """
    GET /files/user-templates/{template_id}/{filename} - Serve user template files
    
    Args:
        template_id: Template UUID
        filename: File name
    """
    try:
        user, auth_error = authenticate_request(allow_query=True)
        if auth_error:
            return auth_error

        template = UserTemplate.query.filter(
            UserTemplate.id == template_id,
            UserTemplate.user_id == user.id,
        ).first()
        if not template:
            return not_found('File')

        requested_name = secure_filename(filename)
        original_name = os.path.basename(template.file_path)
        thumb_name = os.path.basename(template.thumb_path) if template.thumb_path else None

        if requested_name == original_name:
            relative_path = template.file_path
        elif thumb_name and requested_name == thumb_name:
            relative_path = template.thumb_path
        else:
            return not_found('File')

        return _serve_from_storage(relative_path)
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@file_bp.route('/materials/<filename>', methods=['GET'])
def serve_global_material(filename):
    """
    GET /files/materials/{filename} - Serve global material files (not bound to a project)
    
    Args:
        filename: File name
    """
    try:
        user, auth_error = authenticate_request(allow_query=True)
        if auth_error:
            return auth_error

        safe_filename = secure_filename(filename)
        material = Material.query.filter(
            Material.user_id == user.id,
            Material.project_id.is_(None),
            Material.filename == safe_filename,
        ).first()
        if not material:
            return not_found('File')

        return _serve_from_storage(material.relative_path)
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@file_bp.route('/mineru/<extract_id>/<path:filepath>', methods=['GET'])
def serve_mineru_file(extract_id, filepath):
    """
    GET /files/mineru/{extract_id}/{filepath} - Serve MinerU extracted files.

    Args:
        extract_id: Extract UUID
        filepath: Relative file path within the extract
    """
    try:
        root_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'mineru_files', extract_id)
        full_path = Path(root_dir) / filepath

        # This prevents path traversal attacks
        resolved_root_dir = Path(root_dir).resolve()
        
        try:
            # Check if the path is trying to escape the root directory
            resolved_full_path = full_path.resolve()
            if not str(resolved_full_path).startswith(str(resolved_root_dir)):
                return error_response('INVALID_PATH', 'Invalid file path', 403)
        except Exception:
            # If we can't resolve the path at all, it's invalid
            return error_response('INVALID_PATH', 'Invalid file path', 403)

        # Try to find file with prefix matching
        matched_path = find_file_with_prefix(full_path)
        
        if matched_path is not None:
            # Additional security check for matched path
            try:
                resolved_matched_path = matched_path.resolve(strict=True)
                
                # Verify the matched file is still within the root directory
                if not str(resolved_matched_path).startswith(str(resolved_root_dir)):
                    return error_response('INVALID_PATH', 'Invalid file path', 403)
            except FileNotFoundError:
                return not_found('File')
            except Exception:
                return error_response('INVALID_PATH', 'Invalid file path', 403)
            
            return send_from_directory(str(matched_path.parent), matched_path.name)

        return not_found('File')
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)
