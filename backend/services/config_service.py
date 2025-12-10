"""
Configuration service for managing user-specific and system-wide configurations
Implements priority: User Settings > System Defaults (.env)
"""
import os
import logging
from typing import Optional, Any
from flask import g, has_request_context

from models.user_settings import UserSettings
from services.encryption_service import encryption_service

logger = logging.getLogger(__name__)


class ConfigService:
    """
    Service for retrieving configuration values with user override support
    """
    
    @staticmethod
    def get_user_settings() -> Optional[UserSettings]:
        """
        Get the current user's settings from request context
        
        Returns:
            UserSettings object or None if no authenticated user
        """
        if has_request_context() and hasattr(g, 'current_user') and g.current_user:
            return g.current_user.settings
        return None
    
    @staticmethod
    def get_google_api_key(user_settings: Optional[UserSettings] = None) -> str:
        """
        Get Google API key, preferring user's custom key if set
        
        Args:
            user_settings: Optional UserSettings to check
            
        Returns:
            The API key to use
        """
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.google_api_key_encrypted:
            try:
                return encryption_service.decrypt(settings.google_api_key_encrypted)
            except Exception as e:
                logger.warning(f"Failed to decrypt user's Google API key: {e}")
        
        # Fall back to system default
        return os.getenv('GOOGLE_API_KEY', '')
    
    @staticmethod
    def get_google_api_base(user_settings: Optional[UserSettings] = None) -> str:
        """Get Google API base URL"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.google_api_base:
            return settings.google_api_base
        
        return os.getenv('GOOGLE_API_BASE', 'https://generativelanguage.googleapis.com')
    
    @staticmethod
    def get_mineru_token(user_settings: Optional[UserSettings] = None) -> str:
        """Get MinerU API token"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.mineru_token_encrypted:
            try:
                return encryption_service.decrypt(settings.mineru_token_encrypted)
            except Exception as e:
                logger.warning(f"Failed to decrypt user's MinerU token: {e}")
        
        return os.getenv('MINERU_TOKEN', '')
    
    @staticmethod
    def get_mineru_api_base(user_settings: Optional[UserSettings] = None) -> str:
        """Get MinerU API base URL"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.mineru_api_base:
            return settings.mineru_api_base
        
        return os.getenv('MINERU_API_BASE', 'https://mineru.net')
    
    @staticmethod
    def get_image_caption_model(user_settings: Optional[UserSettings] = None) -> str:
        """Get image caption model name"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.image_caption_model:
            return settings.image_caption_model
        
        return os.getenv('IMAGE_CAPTION_MODEL', 'gemini-2.5-flash')
    
    @staticmethod
    def get_max_description_workers(user_settings: Optional[UserSettings] = None) -> int:
        """Get max description workers count"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.max_description_workers is not None:
            return settings.max_description_workers
        
        return int(os.getenv('MAX_DESCRIPTION_WORKERS', '5'))
    
    @staticmethod
    def get_max_image_workers(user_settings: Optional[UserSettings] = None) -> int:
        """Get max image workers count"""
        settings = user_settings or ConfigService.get_user_settings()
        
        if settings and settings.max_image_workers is not None:
            return settings.max_image_workers
        
        return int(os.getenv('MAX_IMAGE_WORKERS', '8'))
    
    @staticmethod
    def get_all_config(user_settings: Optional[UserSettings] = None) -> dict:
        """
        Get all configuration values with current effective values
        
        Returns:
            Dictionary of all config values with source indicators
        """
        settings = user_settings or ConfigService.get_user_settings()
        
        return {
            'google_api_key': {
                'is_set': bool(ConfigService.get_google_api_key(settings)),
                'source': 'user' if (settings and settings.google_api_key_encrypted) else 'system',
            },
            'google_api_base': {
                'value': ConfigService.get_google_api_base(settings),
                'source': 'user' if (settings and settings.google_api_base) else 'system',
            },
            'mineru_token': {
                'is_set': bool(ConfigService.get_mineru_token(settings)),
                'source': 'user' if (settings and settings.mineru_token_encrypted) else 'system',
            },
            'mineru_api_base': {
                'value': ConfigService.get_mineru_api_base(settings),
                'source': 'user' if (settings and settings.mineru_api_base) else 'system',
            },
            'image_caption_model': {
                'value': ConfigService.get_image_caption_model(settings),
                'source': 'user' if (settings and settings.image_caption_model) else 'system',
            },
            'max_description_workers': {
                'value': ConfigService.get_max_description_workers(settings),
                'source': 'user' if (settings and settings.max_description_workers is not None) else 'system',
            },
            'max_image_workers': {
                'value': ConfigService.get_max_image_workers(settings),
                'source': 'user' if (settings and settings.max_image_workers is not None) else 'system',
            },
        }


# Singleton instance
config_service = ConfigService()
