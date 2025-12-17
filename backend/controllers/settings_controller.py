"""Settings Controller - handles application settings endpoints"""

import logging
from flask import Blueprint, request, current_app
from models import db, Settings
from utils import success_response, error_response, bad_request
from datetime import datetime, timezone
from config import Config

logger = logging.getLogger(__name__)

settings_bp = Blueprint(
    "settings", __name__, url_prefix="/api/settings"
)


# Prevent redirect issues when trailing slash is missing
@settings_bp.route("/", methods=["GET"], strict_slashes=False)
def get_settings():
    """
    GET /api/settings - Get application settings
    """
    try:
        settings = Settings.get_settings()
        return success_response(settings.to_dict())
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        return error_response(
            "GET_SETTINGS_ERROR",
            f"Failed to get settings: {str(e)}",
            500,
        )


@settings_bp.route("/", methods=["PUT"], strict_slashes=False)
def update_settings():
    """
    PUT /api/settings - Update application settings

    Request Body:
        {
            "api_base_url": "https://api.example.com",
            "api_key": "your-api-key",
            "image_resolution": "2K",
            "image_aspect_ratio": "16:9"
        }
    """
    try:
        data = request.get_json()
        if not data:
            return bad_request("Request body is required")

        settings = Settings.get_settings()

        # Update AI provider format configuration
        if "ai_provider_format" in data:
            provider_format = data["ai_provider_format"]
            if provider_format not in ["openai", "gemini"]:
                return bad_request("AI provider format must be 'openai' or 'gemini'")
            settings.ai_provider_format = provider_format

        # Update API configuration
        if "api_base_url" in data:
            raw_base_url = data["api_base_url"]
            # Empty string from frontend means "clear override, fall back to env/default"
            if raw_base_url is None:
                settings.api_base_url = None
            else:
                value = str(raw_base_url).strip()
                settings.api_base_url = value if value != "" else None

        if "api_key" in data:
            settings.api_key = data["api_key"]

        # Update image generation configuration
        if "image_resolution" in data:
            resolution = data["image_resolution"]
            if resolution not in ["1K", "2K", "4K"]:
                return bad_request("Resolution must be 1K, 2K, or 4K")
            settings.image_resolution = resolution

        if "image_aspect_ratio" in data:
            aspect_ratio = data["image_aspect_ratio"]
            settings.image_aspect_ratio = aspect_ratio

        # Update worker configuration
        if "max_description_workers" in data:
            workers = int(data["max_description_workers"])
            if workers < 1 or workers > 20:
                return bad_request(
                    "Max description workers must be between 1 and 20"
                )
            settings.max_description_workers = workers

        if "max_image_workers" in data:
            workers = int(data["max_image_workers"])
            if workers < 1 or workers > 20:
                return bad_request(
                    "Max image workers must be between 1 and 20"
                )
            settings.max_image_workers = workers

        # Update model & MinerU configuration (optional, empty values fall back to Config)
        if "text_model" in data:
            settings.text_model = (data["text_model"] or "").strip() or None

        if "image_model" in data:
            settings.image_model = (data["image_model"] or "").strip() or None

        if "mineru_api_base" in data:
            settings.mineru_api_base = (data["mineru_api_base"] or "").strip() or None

        if "mineru_token" in data:
            settings.mineru_token = data["mineru_token"]

        if "image_caption_model" in data:
            settings.image_caption_model = (data["image_caption_model"] or "").strip() or None

        if "output_language" in data:
            language = data["output_language"]
            if language in ["zh", "en", "ja", "auto"]:
                settings.output_language = language
            else:
                return bad_request("Output language must be 'zh', 'en', 'ja', or 'auto'")

        settings.updated_at = datetime.now(timezone.utc)
        db.session.commit()

        # Sync to app.config
        _sync_settings_to_config(settings)

        logger.info("Settings updated successfully")
        return success_response(
            settings.to_dict(), "Settings updated successfully"
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating settings: {str(e)}")
        return error_response(
            "UPDATE_SETTINGS_ERROR",
            f"Failed to update settings: {str(e)}",
            500,
        )


@settings_bp.route("/reset", methods=["POST"], strict_slashes=False)
def reset_settings():
    """
    POST /api/settings/reset - Reset settings to default values
    """
    try:
        settings = Settings.get_settings()

        # Reset to default values from Config / .env
        # Priority logic:
        # - Check AI_PROVIDER_FORMAT
        # - If "openai" -> use OPENAI_API_BASE / OPENAI_API_KEY
        # - Otherwise (default "gemini") -> use GOOGLE_API_BASE / GOOGLE_API_KEY
        settings.ai_provider_format = Config.AI_PROVIDER_FORMAT

        if (Config.AI_PROVIDER_FORMAT or "").lower() == "openai":
            default_api_base = Config.OPENAI_API_BASE or None
            default_api_key = Config.OPENAI_API_KEY or None
        else:
            default_api_base = Config.GOOGLE_API_BASE or None
            default_api_key = Config.GOOGLE_API_KEY or None

        settings.api_base_url = default_api_base
        settings.api_key = default_api_key
        settings.text_model = Config.TEXT_MODEL
        settings.image_model = Config.IMAGE_MODEL
        settings.mineru_api_base = Config.MINERU_API_BASE
        settings.mineru_token = Config.MINERU_TOKEN
        settings.image_caption_model = Config.IMAGE_CAPTION_MODEL
        settings.output_language = 'zh'  # 重置为默认中文
        settings.image_resolution = Config.DEFAULT_RESOLUTION
        settings.image_aspect_ratio = Config.DEFAULT_ASPECT_RATIO
        settings.max_description_workers = Config.MAX_DESCRIPTION_WORKERS
        settings.max_image_workers = Config.MAX_IMAGE_WORKERS
        settings.updated_at = datetime.now(timezone.utc)

        db.session.commit()

        # Sync to app.config
        _sync_settings_to_config(settings)

        logger.info("Settings reset to defaults")
        return success_response(
            settings.to_dict(), "Settings reset to defaults"
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting settings: {str(e)}")
        return error_response(
            "RESET_SETTINGS_ERROR",
            f"Failed to reset settings: {str(e)}",
            500,
        )


def _sync_settings_to_config(settings: Settings):
    """Sync settings to Flask app config"""
    # Sync AI provider format (always sync, has default value)
    if settings.ai_provider_format:
        current_app.config["AI_PROVIDER_FORMAT"] = settings.ai_provider_format
        logger.info(f"Updated AI_PROVIDER_FORMAT to: {settings.ai_provider_format}")
    
    # Sync API configuration (sync to both GOOGLE_* and OPENAI_* to ensure DB settings override env vars)
    if settings.api_base_url is not None:
        current_app.config["GOOGLE_API_BASE"] = settings.api_base_url
        current_app.config["OPENAI_API_BASE"] = settings.api_base_url
        logger.info(f"Updated API_BASE to: {settings.api_base_url}")
    else:
        # Remove overrides, fall back to env variables or defaults
        current_app.config.pop("GOOGLE_API_BASE", None)
        current_app.config.pop("OPENAI_API_BASE", None)

    if settings.api_key is not None:
        current_app.config["GOOGLE_API_KEY"] = settings.api_key
        current_app.config["OPENAI_API_KEY"] = settings.api_key
        logger.info("Updated API key from settings")
    else:
        # Remove overrides, fall back to env variables or defaults
        current_app.config.pop("GOOGLE_API_KEY", None)
        current_app.config.pop("OPENAI_API_KEY", None)

    # Sync image generation settings
    current_app.config["DEFAULT_RESOLUTION"] = settings.image_resolution
    current_app.config["DEFAULT_ASPECT_RATIO"] = settings.image_aspect_ratio
    logger.info(f"Updated image settings: {settings.image_resolution}, {settings.image_aspect_ratio}")

    # Sync worker settings
    current_app.config["MAX_DESCRIPTION_WORKERS"] = settings.max_description_workers
    current_app.config["MAX_IMAGE_WORKERS"] = settings.max_image_workers
    logger.info(f"Updated worker settings: desc={settings.max_description_workers}, img={settings.max_image_workers}")

    # Sync model & MinerU settings (optional, fall back to Config defaults if None)
    if settings.text_model:
        current_app.config["TEXT_MODEL"] = settings.text_model
        logger.info(f"Updated TEXT_MODEL to: {settings.text_model}")
    if settings.image_model:
        current_app.config["IMAGE_MODEL"] = settings.image_model
        logger.info(f"Updated IMAGE_MODEL to: {settings.image_model}")
    if settings.mineru_api_base:
        current_app.config["MINERU_API_BASE"] = settings.mineru_api_base
        logger.info(f"Updated MINERU_API_BASE to: {settings.mineru_api_base}")
    if settings.mineru_token is not None:
        current_app.config["MINERU_TOKEN"] = settings.mineru_token
        logger.info("Updated MINERU_TOKEN from settings")
    if settings.image_caption_model:
        current_app.config["IMAGE_CAPTION_MODEL"] = settings.image_caption_model
        logger.info(f"Updated IMAGE_CAPTION_MODEL to: {settings.image_caption_model}")
