"""Settings Controller - handles application settings endpoints"""

import logging
from flask import Blueprint, request, current_app
from models import db, Settings
from utils import success_response, error_response, bad_request
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

settings_bp = Blueprint(
    "settings", __name__, url_prefix="/api/settings"
)


# 防止 http://backend:5000/api/settings/ 不加末尾的 / 会返回重定向问题.
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

        # Update API configuration
        if "api_base_url" in data:
            settings.api_base_url = data["api_base_url"]

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
            if aspect_ratio not in ["16:9", "4:3", "1:1"]:
                return bad_request(
                    "Aspect ratio must be 16:9, 4:3, or 1:1"
                )
            settings.image_aspect_ratio = aspect_ratio

        settings.updated_at = datetime.utcnow()
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

        # Reset to default values
        settings.api_base_url = None
        settings.api_key = None
        settings.image_resolution = "2K"
        settings.image_aspect_ratio = "16:9"
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
    if settings.api_base_url:
        current_app.config["GOOGLE_API_BASE"] = settings.api_base_url
        logger.info(
            f"Updated GOOGLE_API_BASE to: {settings.api_base_url}"
        )

    if settings.api_key:
        current_app.config["GOOGLE_API_KEY"] = settings.api_key
        logger.info("Updated GOOGLE_API_KEY")

    # TODO: Add image_resolution and image_aspect_ratio sync when implemented
    # current_app.config['DEFAULT_RESOLUTION'] = settings.image_resolution
    # current_app.config['DEFAULT_ASPECT_RATIO'] = settings.image_aspect_ratio
