"""
Template Controller - handles template-related endpoints
"""
import base64
import logging
import struct
import zlib
from flask import Blueprint, request, current_app
from models import db, Project, UserTemplate, UserStyleTemplate
from utils import success_response, error_response, not_found, bad_request, allowed_file
from services import FileService
from services.template_candidate_semantics import (
    build_template_candidate_prompt,
    build_template_candidate_usage_note,
)
from datetime import datetime

logger = logging.getLogger(__name__)

template_bp = Blueprint('templates', __name__, url_prefix='/api/projects')
user_template_bp = Blueprint('user_templates', __name__, url_prefix='/api/user-templates')
user_style_template_bp = Blueprint('user_style_templates', __name__, url_prefix='/api/user-style-templates')


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    chunk = chunk_type + data
    return struct.pack('!I', len(data)) + chunk + struct.pack('!I', zlib.crc32(chunk) & 0xFFFFFFFF)



def _build_mock_candidate_data_url(style_prompt: str, aspect_ratio: str | None, index: int) -> str:
    palettes = [
        ((255, 247, 237), (251, 146, 60), (124, 45, 18)),
        ((239, 246, 255), (96, 165, 250), (30, 58, 138)),
        ((245, 243, 255), (167, 139, 250), (76, 29, 149)),
        ((236, 253, 245), (52, 211, 153), (6, 95, 70)),
        ((254, 242, 242), (248, 113, 113), (153, 27, 27)),
    ]
    width = 96
    height = 72
    background, accent, text_color = palettes[index % len(palettes)]
    prompt_bytes = style_prompt.strip().encode('utf-8')
    prompt_seed = sum(prompt_bytes) % height if prompt_bytes else 0
    ratio_seed = sum((aspect_ratio or '').encode('utf-8')) % width if aspect_ratio else 0

    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            pixel = background

            if 6 <= x < width - 6 and 6 <= y < height - 6:
                pixel = (255, 255, 255)
            if 6 <= x < width - 6 and 6 <= y < 18:
                pixel = tuple(min(255, int(channel * 0.82 + 255 * 0.18)) for channel in accent)
            if width - 22 <= x < width - 8 and 10 <= y < 24:
                pixel = tuple(min(255, int(channel * 0.70 + background[i] * 0.30)) for i, channel in enumerate(accent))
            if 10 <= x < 28 and 10 <= y < 12:
                pixel = accent
            if 10 <= x < 38 and 15 <= y < 18:
                pixel = text_color
            if 10 <= x < 45 and 22 <= y < 24:
                pixel = tuple(min(255, text_color[i] + 20) for i in range(3))
            if 10 <= x < 42 and 28 + (prompt_seed % 3) <= y < 31 + (prompt_seed % 3):
                pixel = text_color
            if 10 <= x < 36 and 34 + (ratio_seed % 4) <= y < 36 + (ratio_seed % 4):
                pixel = tuple(min(255, text_color[i] + 35) for i in range(3))
            if 10 <= x < 44 and 55 <= y < 63:
                pixel = tuple(min(255, int(channel * 0.35 + 255 * 0.65)) for channel in accent)
            if 45 <= x < 85 and 26 <= y < 34:
                pixel = tuple(min(255, int(channel * 0.45 + 255 * 0.55)) for channel in accent)
            if 45 <= x < 62 and 38 <= y < 62:
                pixel = tuple(min(255, int(channel * 0.28 + 255 * 0.72)) for channel in accent)
            if 66 <= x < 85 and 38 <= y < 49:
                pixel = tuple(min(255, int(channel * 0.18 + 255 * 0.82)) for channel in accent)
            if 66 <= x < 85 and 52 <= y < 63:
                pixel = tuple(min(255, int(channel * 0.52 + 255 * 0.48)) for channel in accent)

            rows.extend(pixel)

    png_data = b''.join([
        b'\x89PNG\r\n\x1a\n',
        _png_chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 2, 0, 0, 0)),
        _png_chunk(b'IDAT', zlib.compress(bytes(rows), level=9)),
        _png_chunk(b'IEND', b''),
    ])

    encoded_png = base64.b64encode(png_data).decode('ascii')
    return f'data:image/png;base64,{encoded_png}'


@template_bp.route('/<project_id>/template-candidates', methods=['POST'])
def create_template_candidates(project_id):
    """
    POST /api/projects/{project_id}/template-candidates - Generate transient slide template/style candidates.

    MVP behavior:
    - validates project existence and style_prompt
    - builds the future model prompt/usage semantics explicitly in code
    - returns 5 in-memory mock candidates that represent reusable slide templates
    - response shape is async-friendly for future slow path

    Important semantic contract for issue #406:
    - candidates are template/style references, not generic illustrations
    - selecting one must still go through the existing project template upload flow
    - downstream generation should consume the selected result as project.template_image_path
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        data = request.get_json(silent=True) or {}
        style_prompt = (data.get('style_prompt') or '').strip()
        if not style_prompt:
            return bad_request('style_prompt is required')

        aspect_ratio = data.get('aspect_ratio')
        semantic_prompt = build_template_candidate_prompt(style_prompt, aspect_ratio)
        usage_note = build_template_candidate_usage_note()
        candidates = [
            {
                'candidate_id': f'{project_id}-candidate-{index + 1}',
                'image_url': _build_mock_candidate_data_url(style_prompt, aspect_ratio, index),
            }
            for index in range(5)
        ]

        return success_response({
            'status': 'COMPLETED',
            'task_id': None,
            'prompt': semantic_prompt,
            'usage': usage_note,
            'candidates': candidates,
        })
    except Exception as e:
        logger.error(f'Failed to create template candidates: {str(e)}', exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/template', methods=['POST'])
def upload_template(project_id):
    """
    POST /api/projects/{project_id}/template - Upload template image
    
    Content-Type: multipart/form-data
    Form: template_image=@file.png
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        # Check if file is in request
        if 'template_image' not in request.files:
            return bad_request("No file uploaded")
        
        file = request.files['template_image']
        
        if file.filename == '':
            return bad_request("No file selected")
        
        # Validate file extension
        if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
            return bad_request("Invalid file type. Allowed types: png, jpg, jpeg, gif, webp")
        
        # Save template
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_path = file_service.save_template_image(file, project_id)
        
        # Update project
        project.template_image_path = file_path
        project.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return success_response({
            'template_image_url': f'/files/{project_id}/template/{file_path.split("/")[-1]}'
        })
    
    except ValueError as e:
        db.session.rollback()
        return bad_request(str(e))
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/template', methods=['DELETE'])
def delete_template(project_id):
    """
    DELETE /api/projects/{project_id}/template - Delete template
    """
    try:
        project = Project.query.get(project_id)
        
        if not project:
            return not_found('Project')
        
        if not project.template_image_path:
            return bad_request("No template to delete")
        
        # Delete template file
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_service.delete_template(project_id)
        
        # Update project
        project.template_image_path = None
        project.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return success_response(message="Template deleted successfully")
    
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/templates', methods=['GET'])
def get_system_templates():
    """
    GET /api/templates - Get system preset templates
    
    Note: This is a placeholder for future implementation
    """
    # TODO: Implement system templates
    templates = []
    
    return success_response({
        'templates': templates
    })


# ========== User Template Endpoints ==========

@user_template_bp.route('', methods=['POST'])
def upload_user_template():
    """
    POST /api/user-templates - Upload user template image

    Content-Type: multipart/form-data
    Form: template_image=@file.png
    Optional: name=Template Name
    """
    try:
        # Check if file is in request
        if 'template_image' not in request.files:
            return bad_request("No file uploaded")

        file = request.files['template_image']

        if file.filename == '':
            return bad_request("No file selected")

        # Validate file extension
        if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
            return bad_request("Invalid file type. Allowed types: png, jpg, jpeg, gif, webp")

        # Get optional name
        name = request.form.get('name', None)

        # Get file size before saving
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning

        # Generate template ID first
        import uuid
        template_id = str(uuid.uuid4())

        # Save template file first (using the generated ID)
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_path = file_service.save_user_template(file, template_id)

        # Generate thumbnail for faster loading
        thumb_path = file_service.save_user_template_thumbnail(template_id, file_path)

        # Create template record with file_path already set
        template = UserTemplate(
            id=template_id,
            name=name,
            file_path=file_path,
            thumb_path=thumb_path,
            file_size=file_size
        )
        db.session.add(template)
        db.session.commit()

        return success_response(template.to_dict())
    
    except ValueError as e:
        db.session.rollback()
        return bad_request(str(e))
    except Exception as e:
        import traceback
        db.session.rollback()
        error_msg = str(e)
        logger.error(f"Error uploading user template: {error_msg}", exc_info=True)
        # 在开发环境中返回详细错误，生产环境返回通用错误
        if current_app.config.get('DEBUG', False):
            return error_response('SERVER_ERROR', f"{error_msg}\n{traceback.format_exc()}", 500)
        else:
            return error_response('SERVER_ERROR', error_msg, 500)


@user_template_bp.route('', methods=['GET'])
def list_user_templates():
    """
    GET /api/user-templates - Get list of user templates
    """
    try:
        templates = UserTemplate.query.order_by(UserTemplate.created_at.desc()).all()
        
        return success_response({
            'templates': [template.to_dict() for template in templates]
        })
    
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@user_template_bp.route('/<template_id>', methods=['DELETE'])
def delete_user_template(template_id):
    """
    DELETE /api/user-templates/{template_id} - Delete user template
    """
    try:
        template = UserTemplate.query.get(template_id)
        
        if not template:
            return not_found('UserTemplate')
        
        # Delete template file
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_service.delete_user_template(template_id)

        # Delete template record
        db.session.delete(template)
        db.session.commit()

        return success_response(message="Template deleted successfully")

    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


# ========== User Style Template Endpoints ==========

@user_style_template_bp.route('', methods=['POST'])
def create_user_style_template():
    try:
        data = request.get_json()
        if not data:
            return bad_request("Request body is required")

        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        if not name or not description:
            return bad_request("Name and description are required")

        import uuid
        template = UserStyleTemplate(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            color=data.get('color'),
        )
        db.session.add(template)
        db.session.commit()
        return success_response(template.to_dict())
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@user_style_template_bp.route('', methods=['GET'])
def list_user_style_templates():
    try:
        templates = UserStyleTemplate.query.order_by(UserStyleTemplate.created_at.desc()).all()
        return success_response({
            'templates': [t.to_dict() for t in templates]
        })
    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@user_style_template_bp.route('/<template_id>', methods=['DELETE'])
def delete_user_style_template(template_id):
    try:
        template = UserStyleTemplate.query.get(template_id)
        if not template:
            return not_found('UserStyleTemplate')
        db.session.delete(template)
        db.session.commit()
        return success_response(message="Style template deleted successfully")
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)
