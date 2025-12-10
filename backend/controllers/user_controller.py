"""
User controller for profile and settings management
"""
import logging
from flask import Blueprint, request, jsonify, g

from models import db
from models.user_settings import UserSettings
from services.auth_service import auth_service
from services.encryption_service import encryption_service
from services.config_service import config_service
from utils.decorators import login_required

logger = logging.getLogger(__name__)

user_bp = Blueprint('user', __name__, url_prefix='/api/user')


# ============== Profile Routes ==============

@user_bp.route('/profile', methods=['GET'])
@login_required
def get_profile():
    """
    Get current user's profile
    """
    return jsonify({
        'user': g.current_user.to_dict(include_email=True),
    }), 200


@user_bp.route('/profile', methods=['PUT'])
@login_required
def update_profile():
    """
    Update current user's profile
    
    Request body:
    {
        "username": "string" (optional),
        "avatar_url": "string" (optional)
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    user, error = auth_service.update_user_profile(
        g.current_user,
        **{k: v for k, v in data.items() if k in ['username', 'avatar_url']}
    )
    
    if error:
        return jsonify({'error': error}), 400
    
    return jsonify({
        'message': 'Profile updated',
        'user': user.to_dict(include_email=True),
    }), 200


@user_bp.route('/password', methods=['PUT'])
@login_required
def change_password():
    """
    Change current user's password
    
    Request body:
    {
        "old_password": "string",
        "new_password": "string"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    
    if not old_password or not new_password:
        return jsonify({'error': 'Both old and new passwords are required'}), 400
    
    success, error = auth_service.change_password(g.current_user, old_password, new_password)
    
    if not success:
        return jsonify({'error': error}), 400
    
    return jsonify({'message': 'Password changed successfully'}), 200


# ============== Settings Routes ==============

@user_bp.route('/settings', methods=['GET'])
@login_required
def get_settings():
    """
    Get current user's settings with effective configuration values
    """
    settings = g.current_user.settings
    
    if not settings:
        # Create default settings if not exists
        settings = UserSettings(user_id=g.current_user.id)
        db.session.add(settings)
        db.session.commit()
        g.current_user.settings = settings
    
    return jsonify({
        'settings': settings.to_dict(),
        'effective_config': config_service.get_all_config(settings),
    }), 200


@user_bp.route('/settings', methods=['PUT'])
@login_required
def update_settings():
    """
    Update current user's settings
    
    Request body (all fields optional):
    {
        "google_api_key": "string",
        "google_api_base": "string",
        "mineru_token": "string",
        "mineru_api_base": "string",
        "image_caption_model": "string",
        "max_description_workers": number,
        "max_image_workers": number
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    settings = g.current_user.settings
    
    if not settings:
        settings = UserSettings(user_id=g.current_user.id)
        db.session.add(settings)
        g.current_user.settings = settings
    
    try:
        # Handle encrypted fields
        if 'google_api_key' in data:
            value = data['google_api_key']
            if value:
                settings.google_api_key_encrypted = encryption_service.encrypt(value)
            else:
                settings.google_api_key_encrypted = None
        
        if 'mineru_token' in data:
            value = data['mineru_token']
            if value:
                settings.mineru_token_encrypted = encryption_service.encrypt(value)
            else:
                settings.mineru_token_encrypted = None
        
        # Handle plain fields
        if 'google_api_base' in data:
            settings.google_api_base = data['google_api_base'] or None
        
        if 'mineru_api_base' in data:
            settings.mineru_api_base = data['mineru_api_base'] or None
        
        if 'image_caption_model' in data:
            settings.image_caption_model = data['image_caption_model'] or None
        
        if 'max_description_workers' in data:
            value = data['max_description_workers']
            if value is not None and isinstance(value, int) and 1 <= value <= 20:
                settings.max_description_workers = value
            else:
                settings.max_description_workers = None
        
        if 'max_image_workers' in data:
            value = data['max_image_workers']
            if value is not None and isinstance(value, int) and 1 <= value <= 20:
                settings.max_image_workers = value
            else:
                settings.max_image_workers = None
        
        db.session.commit()
        
        return jsonify({
            'message': 'Settings updated',
            'settings': settings.to_dict(),
            'effective_config': config_service.get_all_config(settings),
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update settings: {e}")
        return jsonify({'error': 'Failed to update settings'}), 500


@user_bp.route('/settings/<key>', methods=['DELETE'])
@login_required
def reset_setting(key):
    """
    Reset a specific setting to use system default
    
    URL params:
        key: The setting key to reset (e.g., 'google_api_key', 'max_image_workers')
    """
    settings = g.current_user.settings
    
    if not settings:
        return jsonify({'error': 'No settings found'}), 404
    
    # Map of allowed keys to their field names
    key_mapping = {
        'google_api_key': 'google_api_key_encrypted',
        'google_api_base': 'google_api_base',
        'mineru_token': 'mineru_token_encrypted',
        'mineru_api_base': 'mineru_api_base',
        'image_caption_model': 'image_caption_model',
        'max_description_workers': 'max_description_workers',
        'max_image_workers': 'max_image_workers',
    }
    
    if key not in key_mapping:
        return jsonify({'error': f'Unknown setting key: {key}'}), 400
    
    try:
        field_name = key_mapping[key]
        setattr(settings, field_name, None)
        db.session.commit()
        
        return jsonify({
            'message': f'Setting {key} reset to system default',
            'settings': settings.to_dict(),
            'effective_config': config_service.get_all_config(settings),
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to reset setting: {e}")
        return jsonify({'error': 'Failed to reset setting'}), 500
