"""
Template Controller - handles template-related endpoints
"""
import logging
from flask import Blueprint, request, current_app
from models import db, Project, UserTemplate
from utils import success_response, error_response, not_found, bad_request, allowed_file
from services import FileService
from datetime import datetime

logger = logging.getLogger(__name__)

template_bp = Blueprint('templates', __name__, url_prefix='/api/projects')
user_template_bp = Blueprint('user_templates', __name__, url_prefix='/api/user-templates')


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
        
        # Create template record with file_path already set
        template = UserTemplate(
            id=template_id,
            name=name,
            file_path=file_path,
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

