"""
File Controller - handles static file serving
"""
from flask import Blueprint, send_from_directory, current_app
from utils import error_response, not_found
from utils.path_utils import find_file_with_prefix
import os
from pathlib import Path
from werkzeug.utils import secure_filename

file_bp = Blueprint('files', __name__, url_prefix='/files')


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
        if file_type not in ['template', 'pages', 'materials', 'exports']:
            return not_found('File')

        safe_project_id = secure_filename(project_id)
        safe_filename = secure_filename(filename)
        if not safe_project_id or not safe_filename:
            return not_found('File')

        # Construct file path with path containment check
        upload_folder = Path(current_app.config['UPLOAD_FOLDER']).resolve()
        file_dir = upload_folder / safe_project_id / file_type
        file_path = (file_dir / safe_filename).resolve()

        if not str(file_path).startswith(str(upload_folder)):
            return error_response('INVALID_PATH', 'Invalid file path', 403)

        if not file_path.exists():
            return not_found('File')

        # Serve file
        return send_from_directory(str(file_dir), safe_filename)

    except Exception as e:
        current_app.logger.error(f"Error serving file: {e}")
        return error_response('SERVER_ERROR', 'Failed to serve file', 500)


@file_bp.route('/user-templates/<template_id>/<filename>', methods=['GET'])
def serve_user_template(template_id, filename):
    """
    GET /files/user-templates/{template_id}/{filename} - Serve user template files

    Args:
        template_id: Template UUID
        filename: File name
    """
    try:
        safe_template_id = secure_filename(template_id)
        safe_filename = secure_filename(filename)
        if not safe_template_id or not safe_filename:
            return not_found('File')

        # Construct file path with path containment check
        upload_folder = Path(current_app.config['UPLOAD_FOLDER']).resolve()
        file_dir = upload_folder / 'user-templates' / safe_template_id
        file_path = (file_dir / safe_filename).resolve()

        if not str(file_path).startswith(str(upload_folder)):
            return error_response('INVALID_PATH', 'Invalid file path', 403)

        if not file_path.exists():
            return not_found('File')

        # Serve file
        return send_from_directory(str(file_dir), safe_filename)

    except Exception as e:
        current_app.logger.error(f"Error serving user template: {e}")
        return error_response('SERVER_ERROR', 'Failed to serve file', 500)


@file_bp.route('/materials/<filename>', methods=['GET'])
def serve_global_material(filename):
    """
    GET /files/materials/{filename} - Serve global material files (not bound to a project)
    
    Args:
        filename: File name
    """
    try:
        safe_filename = secure_filename(filename)
        # Construct file path
        file_dir = os.path.join(
            current_app.config['UPLOAD_FOLDER'],
            'materials'
        )
        
        # Check if directory exists
        if not os.path.exists(file_dir):
            return not_found('File')
        
        # Check if file exists
        file_path = os.path.join(file_dir, safe_filename)
        if not os.path.exists(file_path):
            return not_found('File')
        
        # Serve file
        return send_from_directory(file_dir, safe_filename)
    
    except Exception as e:
        current_app.logger.error(f"Error serving global material: {e}")
        return error_response('SERVER_ERROR', 'Failed to serve file', 500)


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
        current_app.logger.error(f"Error serving mineru file: {e}")
        return error_response('SERVER_ERROR', 'Failed to serve file', 500)

