"""
Template Controller - handles template-related endpoints
"""
import logging
from flask import Blueprint, request, current_app
from models import db, Project, UserTemplate, Page
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


# ========== Page-Level Template Endpoints ==========

@template_bp.route('/<project_id>/pages/<page_id>/template', methods=['POST'])
def upload_page_template(project_id, page_id):
    """
    POST /api/projects/{project_id}/pages/{page_id}/template - Upload page-level template

    Content-Type: multipart/form-data
    Form: template_image=@file.png
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        page = Page.query.get(page_id)
        if not page or page.project_id != project_id:
            return not_found('Page')

        if 'template_image' not in request.files:
            return bad_request("No file uploaded")

        file = request.files['template_image']

        if file.filename == '':
            return bad_request("No file selected")

        if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
            return bad_request("Invalid file type. Allowed types: png, jpg, jpeg, gif, webp")

        # Save page template
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_path = file_service.save_page_template(file, project_id, page_id)

        # Update page
        page.template_image_path = file_path
        page.updated_at = datetime.utcnow()

        db.session.commit()

        return success_response({
            'page_id': page_id,
            'template_image_url': f'/files/{project_id}/page_templates/{file_path.split("/")[-1]}'
        })

    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/pages/<page_id>/template', methods=['DELETE'])
def delete_page_template(project_id, page_id):
    """
    DELETE /api/projects/{project_id}/pages/{page_id}/template - Delete page-level template
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        page = Page.query.get(page_id)
        if not page or page.project_id != project_id:
            return not_found('Page')

        if not page.template_image_path:
            return bad_request("No template to delete")

        # Delete template file
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_service.delete_page_template(project_id, page_id)

        # Update page
        page.template_image_path = None
        page.updated_at = datetime.utcnow()

        db.session.commit()

        return success_response(message="Page template deleted successfully")

    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/templates/batch', methods=['POST'])
def upload_batch_templates(project_id):
    """
    POST /api/projects/{project_id}/templates/batch - Upload multiple page templates

    Content-Type: multipart/form-data
    Form: templates=@file1.png, @file2.png, ...

    Templates are assigned to pages in order by order_index.
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        # Get all uploaded files
        files = request.files.getlist('templates')
        if not files or len(files) == 0:
            return bad_request("No files uploaded")

        # Validate all files first
        for file in files:
            if file.filename == '':
                continue
            if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
                return bad_request(f"Invalid file type: {file.filename}. Allowed types: png, jpg, jpeg, gif, webp")

        # Get pages ordered by order_index
        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

        if not pages:
            return bad_request("Project has no pages. Create outline first.")

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        results = []

        # Assign templates to pages in order
        for i, file in enumerate(files):
            if file.filename == '':
                continue

            if i >= len(pages):
                # More templates than pages - skip extra templates
                break

            page = pages[i]

            # Save page template
            file_path = file_service.save_page_template(file, project_id, page.id)

            # Update page
            page.template_image_path = file_path
            page.updated_at = datetime.utcnow()

            results.append({
                'page_id': page.id,
                'order_index': page.order_index,
                'template_image_url': f'/files/{project_id}/page_templates/{file_path.split("/")[-1]}'
            })

        db.session.commit()

        return success_response({
            'message': f'Successfully uploaded {len(results)} templates',
            'bindings': results,
            'total_pages': len(pages),
            'templates_bound': len(results)
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error uploading batch templates: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/pending-templates', methods=['POST'])
def upload_pending_templates(project_id):
    """
    POST /api/projects/{project_id}/pending-templates - Upload pending templates

    Upload templates before outline generation. These will be used during
    outline generation for AI reference, then auto-associated with pages.

    Content-Type: multipart/form-data
    Form: templates=@file1.png, @file2.png, ...
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        # Get all uploaded files
        files = request.files.getlist('templates')
        if not files or len(files) == 0:
            return bad_request("No files uploaded")

        # Validate all files first
        valid_files = []
        for file in files:
            if file.filename == '':
                continue
            if not allowed_file(file.filename, current_app.config['ALLOWED_EXTENSIONS']):
                return bad_request(f"Invalid file type: {file.filename}. Allowed types: png, jpg, jpeg, gif, webp")
            valid_files.append(file)

        if not valid_files:
            return bad_request("No valid files uploaded")

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])

        # Clear existing pending templates first
        file_service.clear_pending_templates(project_id)

        results = []
        for i, file in enumerate(valid_files):
            # Save pending template
            file_path = file_service.save_pending_template(file, project_id, i)
            results.append({
                'order_index': i,
                'file_path': file_path,
                'filename': file.filename
            })

        return success_response({
            'message': f'Successfully uploaded {len(results)} pending templates',
            'templates': results
        })

    except Exception as e:
        logger.error(f"Error uploading pending templates: {str(e)}", exc_info=True)
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/pending-templates', methods=['GET'])
def get_pending_templates(project_id):
    """
    GET /api/projects/{project_id}/pending-templates - Get pending templates
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        templates = file_service.get_pending_templates(project_id)

        return success_response({
            'templates': [
                {
                    'order_index': t['order_index'],
                    'file_url': f'/files/{t["relative_path"]}'
                }
                for t in templates
            ]
        })

    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/pending-templates', methods=['DELETE'])
def delete_pending_templates(project_id):
    """
    DELETE /api/projects/{project_id}/pending-templates - Clear pending templates
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        file_service.clear_pending_templates(project_id)

        return success_response(message="Pending templates cleared successfully")

    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


@template_bp.route('/<project_id>/page-templates', methods=['GET'])
def get_page_templates(project_id):
    """
    GET /api/projects/{project_id}/page-templates - Get all page template bindings
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return not_found('Project')

        pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

        templates = []
        for page in pages:
            templates.append({
                'page_id': page.id,
                'order_index': page.order_index,
                'template_image_path': page.template_image_path,
                'template_image_url': f'/files/{project_id}/page_templates/{page.template_image_path.split("/")[-1]}' if page.template_image_path else None,
                'part': page.part
            })

        return success_response({
            'bindings': templates,
            'total_pages': len(pages),
            'pages_with_templates': sum(1 for t in templates if t['template_image_url'])
        })

    except Exception as e:
        return error_response('SERVER_ERROR', str(e), 500)


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

