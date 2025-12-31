"""
User Settings Middleware

在每个请求处理前，从请求头中获取用户 token，
然后将该用户的配置临时应用到 Flask 的 g 对象中，
供 AI 服务使用。
"""
import logging
from flask import request, g, current_app
from models import Settings

logger = logging.getLogger(__name__)


def load_user_settings():
    """
    在每个请求前执行：从请求头获取用户 token，加载用户配置
    将配置存储在 g.user_settings 中
    """
    # 从请求头获取用户 token
    user_token = request.headers.get('X-User-Token')
    
    if user_token:
        try:
            # 获取用户的配置
            settings = Settings.get_settings(user_token)
            g.user_settings = settings
            
            # 临时将用户配置应用到 app.config（仅在请求上下文中有效）
            # 这样 AI 服务就会使用用户的配置
            if settings:
                if settings.ai_provider_format:
                    g.original_ai_provider_format = current_app.config.get('AI_PROVIDER_FORMAT')
                    current_app.config['AI_PROVIDER_FORMAT'] = settings.ai_provider_format
                
                if settings.api_base_url is not None:
                    g.original_api_base = current_app.config.get('GOOGLE_API_BASE')
                    current_app.config['GOOGLE_API_BASE'] = settings.api_base_url
                    current_app.config['OPENAI_API_BASE'] = settings.api_base_url
                
                if settings.api_key is not None:
                    g.original_api_key = current_app.config.get('GOOGLE_API_KEY')
                    current_app.config['GOOGLE_API_KEY'] = settings.api_key
                    current_app.config['OPENAI_API_KEY'] = settings.api_key
                
                # 应用其他用户特定配置
                if settings.text_model:
                    g.original_text_model = current_app.config.get('TEXT_MODEL')
                    current_app.config['TEXT_MODEL'] = settings.text_model
                
                if settings.image_model:
                    g.original_image_model = current_app.config.get('IMAGE_MODEL')
                    current_app.config['IMAGE_MODEL'] = settings.image_model
                
                if settings.mineru_api_base:
                    g.original_mineru_api_base = current_app.config.get('MINERU_API_BASE')
                    current_app.config['MINERU_API_BASE'] = settings.mineru_api_base
                
                if settings.mineru_token is not None:
                    g.original_mineru_token = current_app.config.get('MINERU_TOKEN')
                    current_app.config['MINERU_TOKEN'] = settings.mineru_token
                
                if settings.image_caption_model:
                    g.original_image_caption_model = current_app.config.get('IMAGE_CAPTION_MODEL')
                    current_app.config['IMAGE_CAPTION_MODEL'] = settings.image_caption_model
                
                if settings.output_language:
                    g.original_output_language = current_app.config.get('OUTPUT_LANGUAGE')
                    current_app.config['OUTPUT_LANGUAGE'] = settings.output_language
                
                if settings.max_description_workers:
                    g.original_max_description_workers = current_app.config.get('MAX_DESCRIPTION_WORKERS')
                    current_app.config['MAX_DESCRIPTION_WORKERS'] = settings.max_description_workers
                
                if settings.max_image_workers:
                    g.original_max_image_workers = current_app.config.get('MAX_IMAGE_WORKERS')
                    current_app.config['MAX_IMAGE_WORKERS'] = settings.max_image_workers
                
                if settings.image_resolution:
                    g.original_image_resolution = current_app.config.get('DEFAULT_RESOLUTION')
                    current_app.config['DEFAULT_RESOLUTION'] = settings.image_resolution
                
                if settings.image_aspect_ratio:
                    g.original_image_aspect_ratio = current_app.config.get('DEFAULT_ASPECT_RATIO')
                    current_app.config['DEFAULT_ASPECT_RATIO'] = settings.image_aspect_ratio
                
                logger.debug(f"Loaded settings for user: {user_token[:8]}...")
        except Exception as e:
            logger.error(f"Failed to load user settings: {e}")
    else:
        # 没有 user_token，使用默认配置
        g.user_settings = None
        logger.debug("No user token provided, using default settings")


def restore_default_settings(response):
    """
    请求处理完成后执行：恢复默认配置
    注意：由于 Flask 的请求上下文在请求结束后会被清理，
    实际上 app.config 的修改只在当前请求中有效。
    但为了保险起见，我们还是显式恢复。
    """
    try:
        # 恢复原始配置
        if hasattr(g, 'original_ai_provider_format'):
            current_app.config['AI_PROVIDER_FORMAT'] = g.original_ai_provider_format
        
        if hasattr(g, 'original_api_base'):
            if g.original_api_base is not None:
                current_app.config['GOOGLE_API_BASE'] = g.original_api_base
                current_app.config['OPENAI_API_BASE'] = g.original_api_base
            else:
                current_app.config.pop('GOOGLE_API_BASE', None)
                current_app.config.pop('OPENAI_API_BASE', None)
        
        if hasattr(g, 'original_api_key'):
            if g.original_api_key is not None:
                current_app.config['GOOGLE_API_KEY'] = g.original_api_key
                current_app.config['OPENAI_API_KEY'] = g.original_api_key
            else:
                current_app.config.pop('GOOGLE_API_KEY', None)
                current_app.config.pop('OPENAI_API_KEY', None)
        
        # 恢复其他配置...
        if hasattr(g, 'original_text_model'):
            current_app.config['TEXT_MODEL'] = g.original_text_model
        
        if hasattr(g, 'original_image_model'):
            current_app.config['IMAGE_MODEL'] = g.original_image_model
        
        if hasattr(g, 'original_mineru_api_base'):
            current_app.config['MINERU_API_BASE'] = g.original_mineru_api_base
        
        if hasattr(g, 'original_mineru_token'):
            current_app.config['MINERU_TOKEN'] = g.original_mineru_token
        
        if hasattr(g, 'original_image_caption_model'):
            current_app.config['IMAGE_CAPTION_MODEL'] = g.original_image_caption_model
        
        if hasattr(g, 'original_output_language'):
            current_app.config['OUTPUT_LANGUAGE'] = g.original_output_language
        
        if hasattr(g, 'original_max_description_workers'):
            current_app.config['MAX_DESCRIPTION_WORKERS'] = g.original_max_description_workers
        
        if hasattr(g, 'original_max_image_workers'):
            current_app.config['MAX_IMAGE_WORKERS'] = g.original_max_image_workers
        
        if hasattr(g, 'original_image_resolution'):
            current_app.config['DEFAULT_RESOLUTION'] = g.original_image_resolution
        
        if hasattr(g, 'original_image_aspect_ratio'):
            current_app.config['DEFAULT_ASPECT_RATIO'] = g.original_image_aspect_ratio
        
    except Exception as e:
        logger.error(f"Failed to restore default settings: {e}")
    
    return response


