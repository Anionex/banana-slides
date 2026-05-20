"""
Template Controller - handles template-related endpoints
"""
import base64
import io
import logging
from datetime import datetime

from flask import Blueprint, request, current_app
from PIL import Image, ImageDraw, ImageFont

from models import db, Project, UserTemplate
from utils import success_response, error_response, not_found, bad_request, allowed_file
from services import FileService
from services.ai_service_manager import get_ai_service
from services.template_candidate_semantics import (
    build_template_candidate_prompt,
    build_template_candidate_usage_note,
)

logger = logging.getLogger(__name__)

template_bp = Blueprint('templates', __name__, url_prefix='/api/projects')
user_template_bp = Blueprint('user_templates', __name__, url_prefix='/api/user-templates')
template_candidate_bp = Blueprint('template_candidates', __name__, url_prefix='/api')


def _normalize_candidate_count(raw_count):
    try:
        count = int(raw_count) if raw_count is not None else 5
    except (TypeError, ValueError):
        count = 5
    return max(1, min(count, 8))


def _placeholder_palette(index):
    palettes = [
        ((37, 99, 235), (224, 231, 255), (15, 23, 42)),
        ((14, 116, 144), (207, 250, 254), (22, 78, 99)),
        ((147, 51, 234), (243, 232, 255), (88, 28, 135)),
        ((234, 88, 12), (255, 237, 213), (124, 45, 18)),
        ((22, 163, 74), (220, 252, 231), (20, 83, 45)),
    ]
    return palettes[index % len(palettes)]


def _build_mock_candidate_data_url(style_prompt, index, aspect_ratio=None):
    width, height = (1600, 900)
    if aspect_ratio == '4:3':
        width, height = (1400, 1050)
    elif aspect_ratio == '9:16':
        width, height = (900, 1600)

    accent, surface, text = _placeholder_palette(index)
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    draw.rectangle([0, 0, width, height], fill='white')
    draw.rectangle([0, 0, width, int(height * 0.22)], fill=accent)
    draw.rounded_rectangle(
        [int(width * 0.06), int(height * 0.30), int(width * 0.94), int(height * 0.90)],
        radius=28,
        fill=surface,
    )
    draw.rounded_rectangle(
        [int(width * 0.09), int(height * 0.38), int(width * 0.42), int(height * 0.82)],
        radius=20,
        fill=(255, 255, 255),
    )
    draw.rounded_rectangle(
        [int(width * 0.48), int(height * 0.38), int(width * 0.88), int(height * 0.52)],
        radius=20,
        fill=(255, 255, 255),
    )
    draw.rounded_rectangle(
        [int(width * 0.48), int(height * 0.58), int(width * 0.88), int(height * 0.82)],
        radius=20,
        fill=(255, 255, 255),
    )

    prompt_preview = style_prompt.strip().replace('\n', ' ')
    if len(prompt_preview) > 72:
        prompt_preview = prompt_preview[:69] + '...'

    draw.text((int(width * 0.08), int(height * 0.08)), f'Template Candidate {index + 1}', fill='white', font=font)
    draw.text((int(width * 0.08), int(height * 0.16)), 'Slide template / style reference', fill='white', font=font)
    draw.text((int(width * 0.12), int(height * 0.42)), 'TITLE AREA', fill=text, font=font)
    draw.text((int(width * 0.12), int(height * 0.49)), 'Content + hierarchy preview', fill=text, font=font)
    draw.text((int(width * 0.12), int(height * 0.56)), prompt_preview, fill=text, font=font)
    draw.text((int(width * 0.52), int(height * 0.42)), 'Metric / chart block', fill=text, font=font)
    draw.text((int(width * 0.52), int(height * 0.62)), 'Visual / summary block', fill=text, font=font)

    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
    return f'data:image/png;base64,{encoded}'


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


@template_candidate_bp.route('/template-candidates', methods=['POST'])
def create_template_candidates():
    """POST /api/template-candidates - generate transient slide template candidates."""
    try:
        payload = request.get_json(silent=True) or {}
        style_prompt = (payload.get('style_prompt') or '').strip()
        if not style_prompt:
            return bad_request('style_prompt is required')

        count = _normalize_candidate_count(payload.get('count'))
        aspect_ratio = payload.get('aspect_ratio')

        prompt = build_template_candidate_prompt(style_prompt, count=count, aspect_ratio=aspect_ratio)
        usage = build_template_candidate_usage_note()
        candidates = []

        ai_service = get_ai_service()
        resolution = current_app.config.get('DEFAULT_RESOLUTION', '2K')
        for i in range(count):
            try:
                image = ai_service.generate_image(
                    prompt=f"{prompt}\nVariant: {i + 1}",
                    ref_image_path=None,
                    aspect_ratio=aspect_ratio or '16:9',
                    resolution=resolution,
                )
                if image is None:
                    raise RuntimeError('AI image provider returned no image')
                buffer = io.BytesIO()
                image.save(buffer, format='PNG')
                encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
                data_url = f'data:image/png;base64,{encoded}'
            except Exception as e:
                logger.warning('Falling back to mock template candidate #%s due to image generation failure: %s', i + 1, e)
                data_url = _build_mock_candidate_data_url(style_prompt, i, aspect_ratio=aspect_ratio)

            candidates.append({
                'candidate_id': f'candidate-{i+1}',
                'image_url': data_url,
                'thumb_url': data_url,
            })

        return success_response({
            'status': 'COMPLETED',
            'task_id': None,
            'prompt': prompt,
            'usage': usage,
            'candidates': candidates,
        })
    except Exception as e:
        logger.error('Failed to create template candidates: %s', e, exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)

