"""Settings Controller - handles application settings endpoints"""

import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager
from flask import Blueprint, request, current_app
from PIL import Image
from models import db, Settings, UserSettings, Task, SystemConfig
from utils import success_response, error_response, bad_request
from config import Config, PROJECT_ROOT
from services.ai_service import AIService
from services.file_parser_service import FileParserService
from services.ai_providers.ocr.baidu_accurate_ocr_provider import create_baidu_accurate_ocr_provider
from services.ai_providers.image.baidu_inpainting_provider import create_baidu_inpainting_provider
from services.ai_providers import LAZYLLM_VENDORS
from services.task_manager import task_manager
from services.runtime_settings import use_user_settings
from middlewares.auth import auth_required, admin_required, get_current_user

logger = logging.getLogger(__name__)
ALLOWED_PROVIDER_FORMATS = {"openai", "gemini", "lazyllm"} | LAZYLLM_VENDORS

settings_bp = Blueprint(
    "settings", __name__, url_prefix="/api/settings"
)

# 所有可能的设置字段（用于验证）
ALL_SETTINGS_FIELDS = {
    'ai_provider_format', 'api_base_url', 'api_key',
    'text_model', 'image_model', 'image_caption_model',
    'mineru_api_base', 'mineru_token',
    'image_resolution', 'image_aspect_ratio',
    'max_description_workers', 'max_image_workers',
    'output_language',
    'enable_text_reasoning', 'text_thinking_budget',
    'enable_image_reasoning', 'image_thinking_budget',
    'baidu_api_key'
}

# 敏感字段（不应泄露给用户请求）
SENSITIVE_FIELDS = {'api_key', 'mineru_token', 'baidu_api_key'}
NULLABLE_USER_FIELDS = {
    'api_base_url',
    'api_key',
    'text_model',
    'image_model',
    'image_caption_model',
    'mineru_api_base',
    'mineru_token',
    'baidu_api_key',
}
SENSITIVE_LENGTH_FIELDS = {
    'api_key': 'api_key_length',
    'mineru_token': 'mineru_token_length',
    'baidu_api_key': 'baidu_api_key_length',
}
TEST_REQUIREMENTS = {
    'text-model': {'editable_fields': {'api_key'}},
    'caption-model': {'editable_fields': {'api_key'}},
    'image-model': {'editable_fields': {'api_key'}},
    'mineru-pdf': {'editable_fields': {'mineru_token'}},
    'baidu-ocr': {'editable_fields': {'baidu_api_key'}},
    'baidu-inpaint': {'editable_fields': {'baidu_api_key'}},
}


def get_user_editable_fields():
    """动态获取用户可编辑字段"""
    try:
        config = SystemConfig.get_instance()
        return set(config.get_user_editable_fields())
    except Exception as e:
        logger.warning(f"Failed to get user editable fields from SystemConfig: {e}")
        # 回退到默认值
        return {'output_language', 'image_resolution', 'image_aspect_ratio'}


# 保持向后兼容的静态变量（实际使用动态获取）
USER_EDITABLE_FIELDS = {'output_language', 'image_resolution', 'image_aspect_ratio'}


def _build_non_admin_settings_response(user_settings: UserSettings) -> dict:
    """
    Build the settings payload for a non-admin user.

    Returned values follow the effective runtime priority:
    UserSettings > global Settings > .env/Config (indirectly via Settings init).

    Sensitive fields never expose inherited global secrets. The frontend can use
    `_value_sources` to show whether a field is using the user's own override or
    a global fallback.
    """
    global_settings = Settings.get_settings()
    user_fields = get_user_editable_fields()

    response = {}
    value_sources = {}

    for field_name in user_fields:
        user_value = getattr(user_settings, field_name, None)
        global_value = getattr(global_settings, field_name, None)
        uses_global_fallback = user_value is None and global_value is not None

        value_sources[field_name] = "global" if uses_global_fallback else "user"

        if field_name in SENSITIVE_FIELDS and uses_global_fallback:
            response[field_name] = None
            continue

        response[field_name] = global_value if uses_global_fallback else user_value

        if field_name in SENSITIVE_LENGTH_FIELDS:
            response[SENSITIVE_LENGTH_FIELDS[field_name]] = len(user_value) if user_value else 0

    response["_editable_fields"] = sorted(user_fields)
    response["_available_service_tests"] = _get_available_service_tests(
        user_settings=user_settings,
        editable_fields=user_fields,
    )
    response["_value_sources"] = value_sources
    response["_inherits_global_fields"] = sorted(
        [field for field, source in value_sources.items() if source == "global"]
    )
    return response


def _get_available_service_tests(user_settings: UserSettings, editable_fields: set[str]) -> list[str]:
    """Return settings tests a non-admin user may run with saved private config."""
    available_tests = []

    for test_name, requirement in TEST_REQUIREMENTS.items():
        required_fields = requirement['editable_fields']
        if not required_fields.issubset(editable_fields):
            continue

        if all(getattr(user_settings, field_name, None) for field_name in required_fields):
            available_tests.append(test_name)

    return sorted(available_tests)


def _filter_test_override_settings(data: dict) -> tuple[dict, str | None]:
    """
    Restrict non-admin test overrides to editable non-sensitive fields and only
    allow tests for services backed by saved private credentials.
    """
    if not data:
        return {}, None

    user = get_current_user()
    if user.is_admin:
        return data, None

    forbidden_sensitive_overrides = [key for key in data.keys() if key in SENSITIVE_FIELDS]
    if forbidden_sensitive_overrides:
        return {}, "敏感密钥必须先保存到个人设置后才能测试"

    editable_fields = get_user_editable_fields()
    allowed_data = {key: value for key, value in data.items() if key in editable_fields}
    return allowed_data, None


def _ensure_non_admin_test_allowed(test_name: str, user_settings: UserSettings) -> str | None:
    """Check whether a non-admin user may run the requested settings test."""
    user = get_current_user()
    if user.is_admin:
        return None

    editable_fields = get_user_editable_fields()
    available_tests = _get_available_service_tests(user_settings, editable_fields)
    if test_name not in available_tests:
        return "只有在已保存该服务的个人配置后，才允许执行对应测试"

    return None


def _copy_user_settings_to_global(user_settings: UserSettings) -> Settings:
    """
    Persist an admin user's settings to the global Settings row.

    Runtime AI requests read from app.config, which is rebuilt from the global
    Settings table on restart. If admin updates only live in UserSettings,
    verification/tests can pass while post-restart runtime still uses stale
    global credentials.
    """
    global_settings = Settings.get_settings()

    field_names = [
        "ai_provider_format",
        "api_base_url",
        "api_key",
        "image_resolution",
        "image_aspect_ratio",
        "max_description_workers",
        "max_image_workers",
        "text_model",
        "image_model",
        "mineru_api_base",
        "mineru_token",
        "image_caption_model",
        "output_language",
        "enable_text_reasoning",
        "text_thinking_budget",
        "enable_image_reasoning",
        "image_thinking_budget",
        "baidu_api_key",
    ]

    for field_name in field_names:
        setattr(global_settings, field_name, getattr(user_settings, field_name))

    global_settings.updated_at = datetime.now(timezone.utc)
    logger.info(
        "Synced admin user settings to global Settings: provider=%s, api_base=%s, text_model=%s, image_model=%s",
        global_settings.ai_provider_format,
        global_settings.api_base_url,
        global_settings.text_model,
        global_settings.image_model,
    )
    return global_settings


def _restore_user_settings_to_global_defaults(user_settings: UserSettings) -> UserSettings:
    """
    Clear a user's editable overrides so the user returns to the admin/global
    configuration without mutating the global Settings row.
    """
    global_settings = Settings.get_settings()
    user_fields = get_user_editable_fields()

    for field_name in user_fields:
        if field_name in NULLABLE_USER_FIELDS:
            setattr(user_settings, field_name, None)
        else:
            setattr(user_settings, field_name, getattr(global_settings, field_name))

    user_settings.updated_at = datetime.now(timezone.utc)
    logger.info(
        "Restored non-admin user settings to global defaults for fields: %s",
        ", ".join(sorted(user_fields)),
    )
    return user_settings


@contextmanager
def temporary_settings_override(settings_override: dict):
    """
    临时应用设置覆盖的上下文管理器

    使用示例:
        with temporary_settings_override({"api_key": "test-key"}):
            # 在这里使用临时设置
            result = some_test_function()

    Args:
        settings_override: 要临时应用的设置字典

    Yields:
        None
    """
    original_values = {}

    try:
        # 应用覆盖设置
        if settings_override.get("api_key"):
            original_values["GOOGLE_API_KEY"] = current_app.config.get("GOOGLE_API_KEY")
            original_values["OPENAI_API_KEY"] = current_app.config.get("OPENAI_API_KEY")
            current_app.config["GOOGLE_API_KEY"] = settings_override["api_key"]
            current_app.config["OPENAI_API_KEY"] = settings_override["api_key"]

        if settings_override.get("api_base_url"):
            original_values["GOOGLE_API_BASE"] = current_app.config.get("GOOGLE_API_BASE")
            original_values["OPENAI_API_BASE"] = current_app.config.get("OPENAI_API_BASE")
            current_app.config["GOOGLE_API_BASE"] = settings_override["api_base_url"]
            current_app.config["OPENAI_API_BASE"] = settings_override["api_base_url"]

        if settings_override.get("ai_provider_format"):
            original_values["AI_PROVIDER_FORMAT"] = current_app.config.get("AI_PROVIDER_FORMAT")
            current_app.config["AI_PROVIDER_FORMAT"] = settings_override["ai_provider_format"]

        if settings_override.get("text_model"):
            original_values["TEXT_MODEL"] = current_app.config.get("TEXT_MODEL")
            current_app.config["TEXT_MODEL"] = settings_override["text_model"]

        if settings_override.get("image_model"):
            original_values["IMAGE_MODEL"] = current_app.config.get("IMAGE_MODEL")
            current_app.config["IMAGE_MODEL"] = settings_override["image_model"]

        if settings_override.get("image_caption_model"):
            original_values["IMAGE_CAPTION_MODEL"] = current_app.config.get("IMAGE_CAPTION_MODEL")
            current_app.config["IMAGE_CAPTION_MODEL"] = settings_override["image_caption_model"]

        # Per-model source overrides (empty string = clear, to fall back to global config)
        for source_field, config_key in [
            ("text_model_source", "TEXT_MODEL_SOURCE"),
            ("image_model_source", "IMAGE_MODEL_SOURCE"),
            ("image_caption_model_source", "IMAGE_CAPTION_MODEL_SOURCE"),
        ]:
            if source_field in settings_override:
                original_values[config_key] = current_app.config.get(config_key)
                val = settings_override[source_field]
                if val:
                    current_app.config[config_key] = val
                else:
                    current_app.config.pop(config_key, None)

        # Per-model API credentials override
        for model_type in ('text', 'image', 'image_caption'):
            prefix = model_type.upper()
            key_field = f'{model_type}_api_key'
            base_field = f'{model_type}_api_base_url'
            if settings_override.get(key_field):
                config_key = f'{prefix}_API_KEY'
                original_values[config_key] = current_app.config.get(config_key)
                current_app.config[config_key] = settings_override[key_field]
            if settings_override.get(base_field):
                config_key = f'{prefix}_API_BASE'
                original_values[config_key] = current_app.config.get(config_key)
                current_app.config[config_key] = settings_override[base_field]

        if settings_override.get("mineru_api_base"):
            original_values["MINERU_API_BASE"] = current_app.config.get("MINERU_API_BASE")
            current_app.config["MINERU_API_BASE"] = settings_override["mineru_api_base"]

        if settings_override.get("mineru_token"):
            original_values["MINERU_TOKEN"] = current_app.config.get("MINERU_TOKEN")
            current_app.config["MINERU_TOKEN"] = settings_override["mineru_token"]

        if settings_override.get("baidu_api_key"):
            original_values["BAIDU_API_KEY"] = current_app.config.get("BAIDU_API_KEY")
            current_app.config["BAIDU_API_KEY"] = settings_override["baidu_api_key"]

        if settings_override.get("image_resolution"):
            original_values["DEFAULT_RESOLUTION"] = current_app.config.get("DEFAULT_RESOLUTION")
            current_app.config["DEFAULT_RESOLUTION"] = settings_override["image_resolution"]

        if "enable_text_reasoning" in settings_override:
            original_values["ENABLE_TEXT_REASONING"] = current_app.config.get("ENABLE_TEXT_REASONING")
            current_app.config["ENABLE_TEXT_REASONING"] = settings_override["enable_text_reasoning"]

        if "text_thinking_budget" in settings_override:
            original_values["TEXT_THINKING_BUDGET"] = current_app.config.get("TEXT_THINKING_BUDGET")
            current_app.config["TEXT_THINKING_BUDGET"] = settings_override["text_thinking_budget"]

        if "enable_image_reasoning" in settings_override:
            original_values["ENABLE_IMAGE_REASONING"] = current_app.config.get("ENABLE_IMAGE_REASONING")
            current_app.config["ENABLE_IMAGE_REASONING"] = settings_override["enable_image_reasoning"]

        if "image_thinking_budget" in settings_override:
            original_values["IMAGE_THINKING_BUDGET"] = current_app.config.get("IMAGE_THINKING_BUDGET")
            current_app.config["IMAGE_THINKING_BUDGET"] = settings_override["image_thinking_budget"]

        yield

    finally:
        # 恢复原始配置
        for key, value in original_values.items():
            if value is not None:
                current_app.config[key] = value
            else:
                current_app.config.pop(key, None)


@settings_bp.route("/", methods=["GET"], strict_slashes=False)
@auth_required
def get_settings():
    """
    GET /api/settings - Get user-specific application settings
    Non-admin users only receive fields allowed by SystemConfig.user_editable_fields.
    """
    try:
        user = get_current_user()
        settings = UserSettings.get_or_create_for_user(user.id)
        settings_dict = settings.to_dict()

        if not user.is_admin:
            settings_dict = _build_non_admin_settings_response(settings)

        return success_response(settings_dict)
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        return error_response(
            "GET_SETTINGS_ERROR",
            f"Failed to get settings: {str(e)}",
            500,
        )


@settings_bp.route("/", methods=["PUT"], strict_slashes=False)
@auth_required
def update_settings():
    """
    PUT /api/settings - Update user-specific application settings
    Non-admin users can only update fields allowed by SystemConfig.user_editable_fields.

    Request Body:
        {
            "api_base_url": "https://api.example.com",
            "api_key": "your-api-key",
            "image_resolution": "2K",
            "image_aspect_ratio": "16:9"
        }
    """
    try:
        user = get_current_user()
        data = request.get_json()
        if not data:
            return bad_request("Request body is required")

        # Non-admin users: filter to only user editable fields
        if not user.is_admin:
            user_fields = get_user_editable_fields()
            data = {k: v for k, v in data.items() if k in user_fields}
            if not data:
                return bad_request("No editable fields provided")

        settings = UserSettings.get_or_create_for_user(user.id)

        # Update AI provider format configuration
        if "ai_provider_format" in data:
            provider_format = data["ai_provider_format"]
            if provider_format not in ALLOWED_PROVIDER_FORMATS:
                allowed_values = "', '".join(sorted(ALLOWED_PROVIDER_FORMATS))
                return bad_request(f"AI provider format must be one of '{allowed_values}'")
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

        # Update description generation mode
        if "description_generation_mode" in data:
            mode = data["description_generation_mode"]
            if mode not in ("streaming", "parallel"):
                return bad_request("description_generation_mode must be 'streaming' or 'parallel'")
            settings.description_generation_mode = mode

        # Update description extra fields
        if "description_extra_fields" in data:
            fields = data["description_extra_fields"]
            if not isinstance(fields, list) or not fields:
                return bad_request("description_extra_fields must be a non-empty array of strings")
            if len(fields) > 10:
                return bad_request("description_extra_fields allows at most 10 items")
            if not all(isinstance(f, str) and f.strip() for f in fields):
                return bad_request("Each extra field must be a non-empty string")
            settings.description_extra_fields = json.dumps([f.strip() for f in fields], ensure_ascii=False)

        if "image_prompt_extra_fields" in data:
            fields = data["image_prompt_extra_fields"]
            if not isinstance(fields, list):
                return bad_request("image_prompt_extra_fields must be an array of strings")
            # 空数组表示不传任何额外字段给图片生成
            settings.image_prompt_extra_fields = json.dumps([f.strip() for f in fields if isinstance(f, str) and f.strip()], ensure_ascii=False)

        # Update reasoning mode configuration (separate for text and image)
        if "enable_text_reasoning" in data:
            settings.enable_text_reasoning = bool(data["enable_text_reasoning"])
        
        if "text_thinking_budget" in data:
            budget = int(data["text_thinking_budget"])
            if budget < 1 or budget > 8192:
                return bad_request("Text thinking budget must be between 1 and 8192")
            settings.text_thinking_budget = budget
        
        if "enable_image_reasoning" in data:
            settings.enable_image_reasoning = bool(data["enable_image_reasoning"])
        
        if "image_thinking_budget" in data:
            budget = int(data["image_thinking_budget"])
            if budget < 1 or budget > 8192:
                return bad_request("Image thinking budget must be between 1 and 8192")
            settings.image_thinking_budget = budget

        # Update Baidu OCR configuration
        if "baidu_api_key" in data:
            settings.baidu_api_key = data["baidu_api_key"] or None

        # Update per-model provider source configuration
        if "text_model_source" in data:
            settings.text_model_source = (data["text_model_source"] or "").strip() or None

        if "image_model_source" in data:
            settings.image_model_source = (data["image_model_source"] or "").strip() or None

        if "image_caption_model_source" in data:
            settings.image_caption_model_source = (data["image_caption_model_source"] or "").strip() or None

        # Update per-model API credentials (for gemini/openai per-model overrides)
        for model_type in ('text', 'image', 'image_caption'):
            key_field = f'{model_type}_api_key'
            base_field = f'{model_type}_api_base_url'

            if key_field in data:
                setattr(settings, key_field, data[key_field] or None)

            if base_field in data:
                setattr(settings, base_field, (data[base_field] or "").strip() or None)

        if "lazyllm_api_keys" in data:
            keys_data = data["lazyllm_api_keys"]
            if isinstance(keys_data, dict):
                # Merge with existing keys (only update non-empty values)
                existing = settings.get_lazyllm_api_keys_dict()
                for vendor, key in keys_data.items():
                    if key:  # Only update if a new value is provided
                        existing[vendor] = key
                settings.lazyllm_api_keys = json.dumps(existing) if existing else None
            elif keys_data is None:
                settings.lazyllm_api_keys = None

        settings.updated_at = datetime.now(timezone.utc)
        if user.is_admin:
            _copy_user_settings_to_global(settings)
        db.session.commit()

        if user.is_admin:
            # Only the global/admin settings row should drive app.config.
            _sync_settings_to_config(settings)

        logger.info("Settings updated successfully")
        response_dict = settings.to_dict()
        if not user.is_admin:
            response_dict = _build_non_admin_settings_response(settings)
        return success_response(
            response_dict, "Settings updated successfully"
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
@auth_required
def reset_settings():
    """
    POST /api/settings/reset
    - Admin: reset global settings to system/env defaults
    - Non-admin: clear personal overrides and restore admin/global settings
    """
    try:
        user = get_current_user()
        settings = UserSettings.get_or_create_for_user(user.id)

        if user.is_admin:
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
            settings.output_language = 'zh'
            settings.enable_text_reasoning = False
            settings.text_thinking_budget = 1024
            settings.enable_image_reasoning = False
            settings.image_thinking_budget = 1024
            settings.baidu_api_key = Config.BAIDU_API_KEY or None
            settings.image_resolution = Config.DEFAULT_RESOLUTION
            settings.image_aspect_ratio = Config.DEFAULT_ASPECT_RATIO
            settings.max_description_workers = Config.MAX_DESCRIPTION_WORKERS
            settings.max_image_workers = Config.MAX_IMAGE_WORKERS
            settings.updated_at = datetime.now(timezone.utc)
            _copy_user_settings_to_global(settings)
        else:
            _restore_user_settings_to_global_defaults(settings)

        db.session.commit()

        if user.is_admin:
            _sync_settings_to_config(settings)

        logger.info("Settings reset completed for user %s (admin=%s)", user.id, user.is_admin)
        response_dict = settings.to_dict()
        if not user.is_admin:
            response_dict = _build_non_admin_settings_response(settings)
        return success_response(response_dict, "Settings reset successfully")

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting settings: {str(e)}")
        return error_response(
            "RESET_SETTINGS_ERROR",
            f"Failed to reset settings: {str(e)}",
            500,
        )


@settings_bp.route("/active-config", methods=["GET"], strict_slashes=False)
def get_active_config():
    """
    GET /api/settings/active-config - Return current app.config values for AI settings.
    Useful for verifying that _sync_settings_to_config correctly restored .env defaults.
    """
    return success_response({
        "ai_provider_format": current_app.config.get("AI_PROVIDER_FORMAT"),
        "text_model": current_app.config.get("TEXT_MODEL"),
        "image_model": current_app.config.get("IMAGE_MODEL"),
        "output_language": current_app.config.get("OUTPUT_LANGUAGE"),
        "image_caption_model": current_app.config.get("IMAGE_CAPTION_MODEL"),
    })


@settings_bp.route("/verify", methods=["POST"], strict_slashes=False)
@auth_required
@admin_required
def verify_api_key():
    """
    POST /api/settings/verify - 验证模型配置是否可用
    通过调用一个轻量测试请求（thinking_budget=0）来判断

    Returns:
        {
            "data": {
                "available": true/false,
                "message": "提示信息"
            }
        }
    """
    try:
        user = get_current_user()
        settings = UserSettings.get_or_create_for_user(user.id)
        if not settings:
            return success_response({
                "available": False,
                "message": "用户设置未找到"
            })
        with use_user_settings(user.id, scope=f"verify_api_key:{user.id}"):
            from services.ai_providers import get_text_provider

            verification_model = (
                settings.text_model
                or current_app.config.get("TEXT_MODEL")
                or Config.TEXT_MODEL
                or "gemini-3-flash-preview"
            )

            # 尝试创建provider并调用一个简单的测试请求
            try:
                provider = get_text_provider(model=verification_model)
                # 调用一个简单的测试请求（思考budget=0，最小开销）
                provider.generate_text("Hello", thinking_budget=0)

                logger.info("API key verification successful")
                return success_response({
                    "available": True,
                    "message": "API key 可用"
                })

            except ValueError as ve:
                # API key未配置
                logger.warning(f"API key not configured: {str(ve)}")
                provider_format = (settings.ai_provider_format or "").lower()
                if provider_format == "lazyllm" or provider_format in LAZYLLM_VENDORS:
                    source = (provider_format if provider_format in LAZYLLM_VENDORS
                              else current_app.config.get("TEXT_MODEL_SOURCE") or Config.TEXT_MODEL_SOURCE or "unknown").upper()
                    message = f"LazyLLM API key 未配置，请设置 {source}_API_KEY"
                else:
                    message = "API key 未配置，请在设置中配置 API key 和 API Base URL"
                return success_response({
                    "available": False,
                    "message": message
                })
            except Exception as e:
                # API调用失败（可能是key无效、余额不足等）
                error_msg = str(e)
                logger.warning(f"API key verification failed: {error_msg}")

                # 根据错误信息判断具体原因
                if "401" in error_msg or "unauthorized" in error_msg.lower() or "invalid" in error_msg.lower():
                    message = "API key 无效或已过期，请在设置中检查 API key 配置"
                elif "429" in error_msg or "quota" in error_msg.lower() or "limit" in error_msg.lower():
                    message = "API 调用超限或余额不足，请在设置中检查配置"
                elif "403" in error_msg or "forbidden" in error_msg.lower():
                    message = "API 访问被拒绝，请在设置中检查 API key 权限"
                elif "timeout" in error_msg.lower():
                    message = "API 调用超时，请在设置中检查网络连接和 API Base URL"
                else:
                    message = f"API 调用失败，请在设置中检查配置: {error_msg}"

                return success_response({
                    "available": False,
                    "message": message
                })

    except Exception as e:
        logger.error(f"Error verifying API key: {str(e)}")
        return error_response(
            "VERIFY_API_KEY_ERROR",
            f"验证 API key 时出错: {str(e)}",
            500,
        )


def _sync_settings_to_config(settings):
    """Sync settings to Flask app config and clear AI service cache if needed"""
    # Track if AI-related settings changed
    ai_config_changed = False
    
    # Sync AI provider format (always sync, fall back to .env default when NULL)
    new_format = settings.ai_provider_format or Config.AI_PROVIDER_FORMAT
    old_format = current_app.config.get("AI_PROVIDER_FORMAT")
    if old_format != new_format:
        ai_config_changed = True
        logger.info(f"AI provider format changed: {old_format} -> {new_format}")
    current_app.config["AI_PROVIDER_FORMAT"] = new_format
    
    # Sync API configuration (sync to both GOOGLE_* and OPENAI_* to ensure DB settings override env vars)
    if settings.api_base_url is not None:
        old_base = current_app.config.get("GOOGLE_API_BASE")
        if old_base != settings.api_base_url:
            ai_config_changed = True
            logger.info(f"API base URL changed: {old_base} -> {settings.api_base_url}")
        current_app.config["GOOGLE_API_BASE"] = settings.api_base_url
        current_app.config["OPENAI_API_BASE"] = settings.api_base_url
    else:
        # Restore .env defaults (pop would permanently lose .env values)
        env_base_google = Config.GOOGLE_API_BASE
        env_base_openai = Config.OPENAI_API_BASE
        if current_app.config.get("GOOGLE_API_BASE") != env_base_google or current_app.config.get("OPENAI_API_BASE") != env_base_openai:
            ai_config_changed = True
            logger.info("API base URL cleared, falling back to .env defaults")
        current_app.config["GOOGLE_API_BASE"] = env_base_google
        current_app.config["OPENAI_API_BASE"] = env_base_openai

    if settings.api_key is not None:
        old_key = current_app.config.get("GOOGLE_API_KEY")
        # Compare actual values to detect any change (but don't log the keys for security)
        if old_key != settings.api_key:
            ai_config_changed = True
            logger.info("API key updated")
        current_app.config["GOOGLE_API_KEY"] = settings.api_key
        current_app.config["OPENAI_API_KEY"] = settings.api_key
    else:
        # Restore .env defaults (pop would permanently lose .env values)
        env_key_google = Config.GOOGLE_API_KEY
        env_key_openai = Config.OPENAI_API_KEY
        if current_app.config.get("GOOGLE_API_KEY") != env_key_google or current_app.config.get("OPENAI_API_KEY") != env_key_openai:
            ai_config_changed = True
            logger.info("API key cleared, falling back to .env defaults")
        current_app.config["GOOGLE_API_KEY"] = env_key_google
        current_app.config["OPENAI_API_KEY"] = env_key_openai
    
    # Check model changes
    new_text_model = settings.text_model or Config.TEXT_MODEL
    old_model = current_app.config.get("TEXT_MODEL")
    if old_model != new_text_model:
        ai_config_changed = True
        logger.info(f"Text model changed: {old_model} -> {new_text_model}")
    current_app.config["TEXT_MODEL"] = new_text_model

    new_image_model = settings.image_model or Config.IMAGE_MODEL
    old_model = current_app.config.get("IMAGE_MODEL")
    if old_model != new_image_model:
        ai_config_changed = True
        logger.info(f"Image model changed: {old_model} -> {new_image_model}")
    current_app.config["IMAGE_MODEL"] = new_image_model

    # Sync image generation settings (fall back to Config when NULL)
    current_app.config["DEFAULT_RESOLUTION"] = settings.image_resolution or Config.DEFAULT_RESOLUTION
    current_app.config["DEFAULT_ASPECT_RATIO"] = settings.image_aspect_ratio or Config.DEFAULT_ASPECT_RATIO

    # Sync worker settings (fall back to Config when NULL)
    current_app.config["MAX_DESCRIPTION_WORKERS"] = settings.max_description_workers or Config.MAX_DESCRIPTION_WORKERS
    current_app.config["MAX_IMAGE_WORKERS"] = settings.max_image_workers or Config.MAX_IMAGE_WORKERS
    logger.info(f"Updated worker settings: desc={current_app.config['MAX_DESCRIPTION_WORKERS']}, img={current_app.config['MAX_IMAGE_WORKERS']}")

    # Sync MinerU settings (fall back to Config defaults when NULL)
    current_app.config["MINERU_API_BASE"] = settings.mineru_api_base or Config.MINERU_API_BASE
    current_app.config["MINERU_TOKEN"] = settings.mineru_token if settings.mineru_token is not None else Config.MINERU_TOKEN
    current_app.config["IMAGE_CAPTION_MODEL"] = settings.image_caption_model or Config.IMAGE_CAPTION_MODEL
    current_app.config["OUTPUT_LANGUAGE"] = settings.output_language or Config.OUTPUT_LANGUAGE
    
    # Sync reasoning mode settings (separate for text and image)
    # Check if reasoning configuration changed (requires AIService cache clear)
    old_text_reasoning = current_app.config.get("ENABLE_TEXT_REASONING")
    old_text_budget = current_app.config.get("TEXT_THINKING_BUDGET")
    old_image_reasoning = current_app.config.get("ENABLE_IMAGE_REASONING")
    old_image_budget = current_app.config.get("IMAGE_THINKING_BUDGET")
    
    if (old_text_reasoning != settings.enable_text_reasoning or 
        old_text_budget != settings.text_thinking_budget or
        old_image_reasoning != settings.enable_image_reasoning or
        old_image_budget != settings.image_thinking_budget):
        ai_config_changed = True
        logger.info(f"Reasoning config changed: text={old_text_reasoning}({old_text_budget})->{settings.enable_text_reasoning}({settings.text_thinking_budget}), image={old_image_reasoning}({old_image_budget})->{settings.enable_image_reasoning}({settings.image_thinking_budget})")
    
    current_app.config["ENABLE_TEXT_REASONING"] = settings.enable_text_reasoning
    current_app.config["TEXT_THINKING_BUDGET"] = settings.text_thinking_budget
    current_app.config["ENABLE_IMAGE_REASONING"] = settings.enable_image_reasoning
    current_app.config["IMAGE_THINKING_BUDGET"] = settings.image_thinking_budget
    
    # Sync Baidu OCR settings (fall back to Config default when NULL)
    current_app.config["BAIDU_API_KEY"] = settings.baidu_api_key or Config.BAIDU_API_KEY

    # Sync per-model provider source settings
    for model_type, source_attr in [('TEXT', 'text_model_source'), ('IMAGE', 'image_model_source'), ('IMAGE_CAPTION', 'image_caption_model_source')]:
        source_val = getattr(settings, source_attr, None)
        config_key = f'{model_type}_MODEL_SOURCE'
        if source_val:
            old_source = current_app.config.get(config_key)
            if old_source != source_val:
                ai_config_changed = True
            current_app.config[config_key] = source_val
        else:
            if config_key in current_app.config:
                ai_config_changed = True
            current_app.config.pop(config_key, None)

    # Sync per-model API credentials (for gemini/openai per-model overrides)
    for model_type in ('text', 'image', 'image_caption'):
        prefix = model_type.upper()
        for suffix, setting_suffix in [('_API_KEY', '_api_key'), ('_API_BASE', '_api_base_url')]:
            config_key = f'{prefix}{suffix}'
            val = getattr(settings, f'{model_type}{setting_suffix}', None)
            if val:
                if current_app.config.get(config_key) != val:
                    ai_config_changed = True
                current_app.config[config_key] = val
            else:
                if config_key in current_app.config:
                    ai_config_changed = True
                current_app.config.pop(config_key, None)

    # Sync LazyLLM vendor API keys to environment variables
    # (lazyllm_env.py reads from os.environ via {SOURCE}_API_KEY)
    if settings.lazyllm_api_keys:
        try:
            keys = json.loads(settings.lazyllm_api_keys)
            for vendor, key in keys.items():
                if key:
                    env_key = f"{vendor.upper()}_API_KEY"
                    if os.environ.get(env_key) != key:
                        ai_config_changed = True
                    os.environ[env_key] = key
        except (json.JSONDecodeError, TypeError):
            pass
    
    # Clear AI service cache if AI-related configuration changed
    if ai_config_changed:
        try:
            from services.ai_service_manager import clear_ai_service_cache
            clear_ai_service_cache()
            logger.warning("AI configuration changed - AIService cache cleared. New providers will be created on next request.")
        except Exception as e:
            logger.error(f"Failed to clear AI service cache: {e}")


def _get_test_image_path() -> Path:
    test_image = Path(PROJECT_ROOT) / "assets" / "test_img.png"
    if not test_image.exists():
        raise FileNotFoundError("未找到 test_img.png，请确认已放在项目根目录 assets 下")
    return test_image


def _get_baidu_credentials():
    """获取百度 API 凭证"""
    api_key = current_app.config.get("BAIDU_API_KEY") or Config.BAIDU_API_KEY
    if not api_key:
        raise ValueError("未配置 BAIDU_API_KEY")
    return api_key


def _create_file_parser():
    """创建 FileParserService 实例，根据 per-model caption 配置解析正确的凭证"""
    from services.ai_providers import LAZYLLM_VENDORS

    caption_source = current_app.config.get("IMAGE_CAPTION_MODEL_SOURCE")
    global_format = current_app.config.get("AI_PROVIDER_FORMAT", "gemini")

    # Determine effective caption provider format
    if caption_source:
        source_lower = caption_source.lower()
        if source_lower == 'gemini':
            caption_format = 'gemini'
        elif source_lower == 'openai':
            caption_format = 'openai'
        elif source_lower in LAZYLLM_VENDORS:
            caption_format = 'lazyllm'
        else:
            caption_format = global_format
    else:
        caption_format = global_format

    # Resolve API credentials based on caption format
    if caption_format == 'gemini':
        google_key = current_app.config.get("IMAGE_CAPTION_API_KEY") or current_app.config.get("GOOGLE_API_KEY", "")
        google_base = current_app.config.get("IMAGE_CAPTION_API_BASE") or current_app.config.get("GOOGLE_API_BASE", "")
        openai_key = ""
        openai_base = ""
    elif caption_format == 'openai':
        google_key = ""
        google_base = ""
        openai_key = current_app.config.get("IMAGE_CAPTION_API_KEY") or current_app.config.get("OPENAI_API_KEY", "")
        openai_base = current_app.config.get("IMAGE_CAPTION_API_BASE") or current_app.config.get("OPENAI_API_BASE", "")
    else:
        # lazyllm or global fallback
        google_key = current_app.config.get("GOOGLE_API_KEY", "")
        google_base = current_app.config.get("GOOGLE_API_BASE", "")
        openai_key = current_app.config.get("OPENAI_API_KEY", "")
        openai_base = current_app.config.get("OPENAI_API_BASE", "")

    return FileParserService(
        mineru_token=current_app.config.get("MINERU_TOKEN", ""),
        mineru_api_base=current_app.config.get("MINERU_API_BASE", ""),
        google_api_key=google_key,
        google_api_base=google_base,
        openai_api_key=openai_key,
        openai_api_base=openai_base,
        image_caption_model=current_app.config.get("IMAGE_CAPTION_MODEL", Config.IMAGE_CAPTION_MODEL),
        lazyllm_image_caption_source=caption_source or getattr(
            Config, 'IMAGE_CAPTION_MODEL_SOURCE', None
        ),
        provider_format=caption_format,
    )


# 测试函数 - 每个测试一个独立函数
def _test_baidu_ocr():
    """测试百度 OCR 服务"""
    api_key = _get_baidu_credentials()
    provider = create_baidu_accurate_ocr_provider(api_key)
    if not provider:
        raise ValueError("百度 OCR Provider 初始化失败")

    test_image_path = _get_test_image_path()
    result = provider.recognize(str(test_image_path), language_type="CHN_ENG")
    recognized_text = provider.get_full_text(result, separator=" ")

    return {
        "recognized_text": recognized_text,
        "words_result_num": result.get("words_result_num", 0),
    }, "百度 OCR 测试成功"


def _test_text_model():
    """测试文本生成模型"""
    ai_service = AIService()
    reply = ai_service.text_provider.generate_text("请只回复 OK。", thinking_budget=64)
    return {"reply": reply.strip()}, "文本模型测试成功"


def _test_caption_model():
    """测试图片识别模型"""
    upload_folder = Path(current_app.config.get("UPLOAD_FOLDER", Config.UPLOAD_FOLDER))
    mineru_root = upload_folder / "mineru_files"
    mineru_root.mkdir(parents=True, exist_ok=True)
    extract_id = datetime.now(timezone.utc).strftime("test-%Y%m%d%H%M%S")
    image_dir = mineru_root / extract_id
    image_dir.mkdir(parents=True, exist_ok=True)
    image_path = image_dir / "caption_test.png"

    try:
        test_image_path = _get_test_image_path()
        shutil.copyfile(test_image_path, image_path)

        parser = _create_file_parser()
        image_url = f"/files/mineru/{extract_id}/{image_path.name}"
        caption = parser._generate_single_caption(image_url).strip()

        if not caption:
            raise ValueError("图片识别模型返回空结果")

        return {"caption": caption}, "图片识别模型测试成功"
    finally:
        if image_path.exists():
            image_path.unlink()
        if image_dir.exists():
            try:
                image_dir.rmdir()
            except OSError:
                pass


def _test_baidu_inpaint():
    """测试百度图像修复"""
    api_key = _get_baidu_credentials()
    provider = create_baidu_inpainting_provider(api_key)
    if not provider:
        raise ValueError("百度图像修复 Provider 初始化失败")

    test_image_path = _get_test_image_path()
    with Image.open(test_image_path) as image:
        width, height = image.size
        rect_width = max(1, int(width * 0.3))
        rect_height = max(1, int(height * 0.3))
        left = max(0, int(width * 0.35))
        top = max(0, int(height * 0.35))
        rectangles = [{
            "left": left,
            "top": top,
            "width": min(rect_width, width - left),
            "height": min(rect_height, height - top),
        }]
        result = provider.inpaint(image, rectangles)

    if result is None:
        raise ValueError("百度图像修复返回空结果")

    return {"image_size": result.size}, "百度图像修复测试成功"


def _test_image_model():
    """测试图像生成模型"""
    ai_service = AIService()
    test_image_path = _get_test_image_path()
    prompt = "生成一张简洁、明亮、适合演示文稿的背景图。"
    settings = Settings.get_settings()
    result = ai_service.generate_image(
        prompt=prompt,
        ref_image_path=str(test_image_path),
        aspect_ratio=settings.image_aspect_ratio or "16:9",
        resolution=settings.image_resolution or "2K"
    )

    if result is None:
        raise ValueError("图像生成模型返回空结果")

    return {"image_size": result.size}, "图像生成模型测试成功"


def _test_mineru_pdf():
    """测试 MinerU PDF 解析"""
    mineru_token = current_app.config.get("MINERU_TOKEN", "")
    if not mineru_token:
        raise ValueError("未配置 MINERU_TOKEN")

    parser = _create_file_parser()
    tmp_file = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp_file = Path(tmp.name)
        test_image_path = _get_test_image_path()
        with Image.open(test_image_path) as image:
            if image.mode != "RGB":
                image = image.convert("RGB")
            image.save(tmp_file, format="PDF")

        batch_id, upload_url, error = parser._get_upload_url("mineru-test.pdf")
        if error:
            raise ValueError(error)

        upload_error = parser._upload_file(str(tmp_file), upload_url)
        if upload_error:
            raise ValueError(upload_error)

        markdown_content, extract_id, poll_error = parser._poll_result(batch_id, max_wait_time=30)
        if poll_error:
            if "timeout" in poll_error.lower():
                return {
                    "batch_id": batch_id,
                    "status": "processing",
                    "message": "服务正常，文件正在处理中"
                }, "MinerU 服务可用（处理中）"
            else:
                raise ValueError(poll_error)
        else:
            content_preview = (markdown_content or "").strip()[:120]
            return {
                "batch_id": batch_id,
                "extract_id": extract_id,
                "content_preview": content_preview,
            }, "MinerU 解析测试成功"
    finally:
        if tmp_file and tmp_file.exists():
            tmp_file.unlink()


# 测试函数映射
TEST_FUNCTIONS = {
    "baidu-ocr": _test_baidu_ocr,
    "text-model": _test_text_model,
    "caption-model": _test_caption_model,
    "baidu-inpaint": _test_baidu_inpaint,
    "image-model": _test_image_model,
    "mineru-pdf": _test_mineru_pdf,
}


def _run_test_async(task_id: str, test_name: str, test_settings: dict, app):
    """
    在后台异步执行测试任务

    Args:
        task_id: 任务ID
        test_name: 测试名称
        test_settings: 测试设置
        app: Flask app 实例
    """
    with app.app_context():
        try:
            # 更新状态为运行中
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return

            task.status = 'PROCESSING'
            db.session.commit()

            # 应用测试设置并执行测试
            with temporary_settings_override(test_settings):
                # 查找并执行对应的测试函数
                test_func = TEST_FUNCTIONS.get(test_name)
                if not test_func:
                    raise ValueError(f"未知测试类型: {test_name}")

                result_data, message = test_func()

                # 更新任务状态为完成
                task = Task.query.get(task_id)
                if task:
                    owner_user_id = task.get_progress().get('owner_user_id')
                    task.status = 'COMPLETED'
                    task.completed_at = datetime.now(timezone.utc)
                    task.set_progress({
                        'owner_user_id': owner_user_id,
                        'result': result_data,
                        'message': message
                    })
                    db.session.commit()
                    logger.info(f"Test task {task_id} completed successfully")

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Test task {task_id} failed: {error_msg}", exc_info=True)
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = error_msg
                task.completed_at = datetime.now(timezone.utc)
                db.session.commit()



@settings_bp.route("/tests/<test_name>", methods=["POST"], strict_slashes=False)
@auth_required
def run_settings_test(test_name: str):
    """
    POST /api/settings/tests/<test_name> - 启动异步服务测试

    Request Body (optional):
        可选的设置覆盖参数，用于测试未保存的配置
        {
            "api_key": "test-key",
            "api_base_url": "https://test.api.com",
            "text_model": "test-model",
            ...
        }

    Returns:
        {
            "data": {
                "task_id": "uuid",
                "status": "PENDING"
            }
        }
    """
    try:
        user = get_current_user()
        # 从数据库加载用户已保存的设置作为基础
        user_settings = UserSettings.get_or_create_for_user(user.id)
        permission_error = _ensure_non_admin_test_allowed(test_name, user_settings)
        if permission_error:
            return error_response("SETTINGS_TEST_FORBIDDEN", permission_error, 403)

        # 构建基础测试设置（使用数据库中已保存的值）
        test_settings = {}
        if user_settings.api_key:
            test_settings["api_key"] = user_settings.api_key
        if user_settings.api_base_url:
            test_settings["api_base_url"] = user_settings.api_base_url
        if user_settings.ai_provider_format:
            test_settings["ai_provider_format"] = user_settings.ai_provider_format
        if user_settings.text_model:
            test_settings["text_model"] = user_settings.text_model
        if user_settings.image_model:
            test_settings["image_model"] = user_settings.image_model
        if user_settings.image_caption_model:
            test_settings["image_caption_model"] = user_settings.image_caption_model
        if user_settings.mineru_api_base:
            test_settings["mineru_api_base"] = user_settings.mineru_api_base
        if user_settings.mineru_token:
            test_settings["mineru_token"] = user_settings.mineru_token
        if user_settings.baidu_api_key:
            test_settings["baidu_api_key"] = user_settings.baidu_api_key
        if user_settings.image_resolution:
            test_settings["image_resolution"] = user_settings.image_resolution
        # 推理模式设置
        test_settings["enable_text_reasoning"] = user_settings.enable_text_reasoning
        test_settings["text_thinking_budget"] = user_settings.text_thinking_budget
        test_settings["enable_image_reasoning"] = user_settings.enable_image_reasoning
        test_settings["image_thinking_budget"] = user_settings.image_thinking_budget

        # 应用前端发送的覆盖参数（如果有的话，用于测试未保存的配置）
        override_settings = request.get_json() or {}
        if override_settings:
            override_settings, override_error = _filter_test_override_settings(override_settings)
            if override_error:
                return error_response("SETTINGS_TEST_FORBIDDEN", override_error, 403)
            logger.info(f"Applying test setting overrides: {list(override_settings.keys())}")
            test_settings.update(override_settings)

        # 创建任务记录（使用特殊的 project_id='settings-test'）
        task = Task(
            project_id='settings-test',  # 特殊标记，表示这是设置测试任务
            task_type=f'TEST_{test_name.upper().replace("-", "_")}',
            status='PENDING'
        )
        task.set_progress({'owner_user_id': user.id})
        db.session.add(task)
        db.session.commit()

        task_id = task.id

        # 使用 TaskManager 提交后台任务
        task_manager.submit_task(
            task_id,
            _run_test_async,
            test_name,
            test_settings,
            current_app._get_current_object()
        )

        logger.info(f"Started test task {task_id} for {test_name}")

        return success_response({
            'task_id': task_id,
            'status': 'PENDING'
        }, '测试任务已启动')

    except Exception as e:
        logger.error(f"Failed to start test: {str(e)}", exc_info=True)
        return error_response(
            "SETTINGS_TEST_ERROR",
            f"启动测试失败: {str(e)}",
            500
        )


@settings_bp.route("/tests/<task_id>/status", methods=["GET"], strict_slashes=False)
@auth_required
def get_test_status(task_id: str):
    """
    GET /api/settings/tests/<task_id>/status - 查询测试任务状态

    Returns:
        {
            "data": {
                "status": "PENDING|PROCESSING|COMPLETED|FAILED",
                "result": {...},  # 仅当 status=COMPLETED 时存在
                "error": "...",   # 仅当 status=FAILED 时存在
                "message": "..."
            }
        }
    """
    try:
        user = get_current_user()
        task = Task.query.get(task_id)
        if not task:
            return error_response("TASK_NOT_FOUND", "测试任务不存在", 404)

        progress = task.get_progress()
        if not user.is_admin and progress.get('owner_user_id') != user.id:
            return error_response("TASK_NOT_FOUND", "测试任务不存在", 404)

        # 构建响应数据
        response_data = {
            'status': task.status,
            'task_type': task.task_type,
            'created_at': task.created_at.isoformat() if task.created_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
        }

        # 如果任务完成，包含结果和消息
        if task.status == 'COMPLETED':
            response_data['result'] = progress.get('result', {})
            response_data['message'] = progress.get('message', '测试完成')

        # 如果任务失败，包含错误信息
        elif task.status == 'FAILED':
            response_data['error'] = task.error_message

        return success_response(response_data)

    except Exception as e:
        logger.error(f"Failed to get test status: {str(e)}", exc_info=True)
        return error_response(
            "GET_TEST_STATUS_ERROR",
            f"获取测试状态失败: {str(e)}",
            500
        )
