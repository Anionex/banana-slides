"""
Settings Controller - API configuration management
"""
import os
from flask import Blueprint, request, jsonify
from models import db
from models.settings import Settings

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')


@settings_bp.route('/api-config', methods=['GET'])
def get_api_config():
    """Get current API configuration"""
    try:
        # Get from database or fall back to environment variables
        config = {
            'text_api_key': Settings.get_value('GOOGLE_API_KEY', os.getenv('GOOGLE_API_KEY', '')),
            'text_api_base': Settings.get_value('GOOGLE_API_BASE', os.getenv('GOOGLE_API_BASE', '')),
            'image_api_key': Settings.get_value('GOOGLE_IMAGE_API_KEY', os.getenv('GOOGLE_IMAGE_API_KEY', '')),
            'image_api_base': Settings.get_value('GOOGLE_IMAGE_API_BASE', os.getenv('GOOGLE_IMAGE_API_BASE', '')),
        }

        # Mask API keys for security (show only last 8 characters)
        if config['text_api_key']:
            config['text_api_key_masked'] = '***' + config['text_api_key'][-8:] if len(config['text_api_key']) > 8 else '***'
        if config['image_api_key']:
            config['image_api_key_masked'] = '***' + config['image_api_key'][-8:] if len(config['image_api_key']) > 8 else '***'

        return jsonify(config), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api-config', methods=['PUT'])
def update_api_config():
    """Update API configuration"""
    try:
        data = request.json

        # Update settings in database
        if 'text_api_key' in data:
            Settings.set_value('GOOGLE_API_KEY', data['text_api_key'])
        if 'text_api_base' in data:
            Settings.set_value('GOOGLE_API_BASE', data['text_api_base'])
        if 'image_api_key' in data:
            Settings.set_value('GOOGLE_IMAGE_API_KEY', data['image_api_key'])
        if 'image_api_base' in data:
            Settings.set_value('GOOGLE_IMAGE_API_BASE', data['image_api_base'])

        return jsonify({'message': 'API configuration updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api-presets', methods=['GET'])
def get_api_presets():
    """Get predefined API configuration presets"""
    presets = [
        {
            'id': 'relay_apipro',
            'name': '🚀 Maynor 中转API（推荐）',
            'description': '统一使用 https://apipro.maynor1024.live/ 作为中转服务，稳定可靠，支持文本和图片生成。推荐模型：gemini-2.0-flash-exp',
            'config': {
                'text_api_base': 'https://apipro.maynor1024.live',
                'image_api_base': 'https://apipro.maynor1024.live',
                'requires_key': True,
                'key_format': 'sk-xxx（文本和图片使用相同的Key）',
                'get_key_url': 'https://apipro.maynor1024.live/',
                'recommended_model': 'gemini-2.0-flash-exp',
                'warning': '请确保API Key支持图片生成功能'
            }
        },
        {
            'id': 'official',
            'name': '🌐 官方 Google API',
            'description': '直接使用 Google Gemini 官方API，需要自己的 API Key',
            'config': {
                'text_api_base': 'https://generativelanguage.googleapis.com',
                'image_api_base': 'https://generativelanguage.googleapis.com',
                'requires_key': True,
                'key_format': 'AIza...',
                'get_key_url': 'https://aistudio.google.com/app/apikey',
            }
        },
        {
            'id': 'hybrid_apipro',
            'name': '🔀 混合模式（官方文本 + 中转图片）',
            'description': '文本使用官方Google API，图片使用中转API。需要两个不同的 API Key',
            'config': {
                'text_api_base': 'https://generativelanguage.googleapis.com',
                'image_api_base': 'https://apipro.maynor1024.live',
                'requires_key': True,
                'key_format': '文本：AIza... / 图片：sk-xxx'
            }
        },
    ]

    return jsonify(presets), 200
