"""Settings Controller - handles application settings endpoints"""

import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager
from flask import Blueprint, request, current_app, g
from PIL import Image
from models import db, Settings, Task
from utils import success_response, error_response, bad_request
from utils.auth import optional_auth, require_auth
from config import Config, PROJECT_ROOT
from services.ai_service import AIService
from services.file_parser_service import FileParserService
from services.ai_providers.ocr.baidu_accurate_ocr_provider import create_baidu_accurate_ocr_provider
from services.ai_providers.image.baidu_inpainting_provider import create_baidu_inpainting_provider
from services.ai_providers import LAZYLLM_VENDORS
from services.task_manager import task_manager

logger = logging.getLogger(__name__)
ALLOWED_PROVIDER_FORMATS = {"openai", "gemini", "lazyllm"} | LAZYLLM_VENDORS
ALLOWED_SMS_PROVIDERS = {"mock", "tencent", "aliyun", "dysmsapi", "dypnsapi"}
USER_SYSTEM_CONFIG_FIELDS = {
    "jwt_secret_key",
    "admin_init_phone",
    "admin_init_username",
    "admin_init_password",
    "sms_provider",
    "sms_access_key_id",
    "sms_access_key_secret",
    "sms_sign_name",
    "sms_template_code",
    "sms_endpoint",
    "sms_code_ttl_minutes",
    "sms_rate_limit_per_day",
    "sms_mock_code",
    "wechat_pay_enabled",
    "wechat_pay_mock",
    "wechat_pay_app_id",
    "wechat_pay_mch_id",
    "wechat_pay_serial_no",
    "wechat_pay_private_key",
    "wechat_pay_api_v3_key",
    "wechat_pay_gateway_url",
    "wechat_pay_notify_url",
    "wechat_pay_order_expire_minutes",
}
USER_SYSTEM_RESPONSE_FIELDS = USER_SYSTEM_CONFIG_FIELDS | {
    "jwt_secret_key_length",
    "jwt_secret_key_masked",
    "admin_init_password_length",
    "admin_init_password_masked",
    "sms_access_key_secret_length",
    "sms_access_key_secret_masked",
    "wechat_pay_private_key_length",
    "wechat_pay_private_key_masked",
    "wechat_pay_api_v3_key_length",
    "wechat_pay_api_v3_key_masked",
}

settings_bp = Blueprint(
    "settings", __name__, url_prefix="/api/settings"
)


class SettingsValidationError(ValueError):
    """Raised when settings payload validation fails."""


def _normalize_optional_str(value):
    if value is None:
        return None
    return str(value).strip() or None


def _normalize_optional_bool(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return bool(value)


def _set_runtime_value(config_key: str, env_names: tuple[str, ...], value):
    if value is None:
        current_app.config.pop(config_key, None)
        for env_name in env_names:
            os.environ.pop(env_name, None)
        return

    current_app.config[config_key] = value
    env_value = value
    if isinstance(value, bool):
        env_value = "1" if value else "0"
    else:
        env_value = str(value)
    for env_name in env_names:
        os.environ[env_name] = env_value


def _serialize_settings_for_request(settings: Settings):
    user = getattr(g, "current_user", None)
    include_defaults = not (
        user is not None
        and hasattr(user, "uses_private_runtime_settings")
        and user.uses_private_runtime_settings()
    )
    data = settings.to_dict(include_defaults=include_defaults)
    if user is not None and user.uses_private_runtime_settings():
        for field in USER_SYSTEM_RESPONSE_FIELDS:
            data.pop(field, None)
    return data


def _validate_request_scope_for_settings_payload(payload: dict | None):
    """Prevent private/internal settings from reading or writing platform-only config."""
    if not payload:
        return
    user = getattr(g, "current_user", None)
    if user is not None and user.uses_private_runtime_settings():
        forbidden_fields = sorted(USER_SYSTEM_CONFIG_FIELDS.intersection(payload.keys()))
        if forbidden_fields:
            raise SettingsValidationError("User system configuration is only available to admins")


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


def _apply_settings_updates(settings: Settings, data: dict):
    """Validate and apply settings payload to a settings row."""
    if not data:
        raise SettingsValidationError("Request body is required")

    if "ai_provider_format" in data:
        provider_format = data["ai_provider_format"]
        if provider_format in (None, ""):
            settings.ai_provider_format = None
        elif provider_format not in ALLOWED_PROVIDER_FORMATS:
            allowed_values = "', '".join(sorted(ALLOWED_PROVIDER_FORMATS))
            raise SettingsValidationError(
                f"AI provider format must be one of '{allowed_values}'"
            )
        else:
            settings.ai_provider_format = provider_format

    if "api_base_url" in data:
        raw_base_url = data["api_base_url"]
        if raw_base_url is None:
            settings.api_base_url = None
        else:
            value = str(raw_base_url).strip()
            settings.api_base_url = value if value != "" else None

    if "api_key" in data:
        settings.api_key = data["api_key"]

    if "image_resolution" in data:
        resolution = data["image_resolution"]
        if resolution in (None, ""):
            settings.image_resolution = None
        elif resolution not in ["1K", "2K", "4K"]:
            raise SettingsValidationError("Resolution must be 1K, 2K, or 4K")
        else:
            settings.image_resolution = resolution

    if "image_aspect_ratio" in data:
        settings.image_aspect_ratio = data["image_aspect_ratio"]

    if "max_description_workers" in data:
        workers = int(data["max_description_workers"])
        if workers < 1 or workers > 20:
            raise SettingsValidationError(
                "Max description workers must be between 1 and 20"
            )
        settings.max_description_workers = workers

    if "max_image_workers" in data:
        workers = int(data["max_image_workers"])
        if workers < 1 or workers > 20:
            raise SettingsValidationError(
                "Max image workers must be between 1 and 20"
            )
        settings.max_image_workers = workers

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
        if language not in ["zh", "en", "ja", "auto"]:
            raise SettingsValidationError(
                "Output language must be 'zh', 'en', 'ja', or 'auto'"
            )
        settings.output_language = language

    if "description_generation_mode" in data:
        mode = data["description_generation_mode"]
        if mode not in ("streaming", "parallel"):
            raise SettingsValidationError(
                "description_generation_mode must be 'streaming' or 'parallel'"
            )
        settings.description_generation_mode = mode

    if "description_extra_fields" in data:
        fields = data["description_extra_fields"]
        if not isinstance(fields, list) or not fields:
            raise SettingsValidationError(
                "description_extra_fields must be a non-empty array of strings"
            )
        if len(fields) > 10:
            raise SettingsValidationError("description_extra_fields allows at most 10 items")
        if not all(isinstance(f, str) and f.strip() for f in fields):
            raise SettingsValidationError("Each extra field must be a non-empty string")
        settings.description_extra_fields = json.dumps(
            [f.strip() for f in fields], ensure_ascii=False
        )

    if "image_prompt_extra_fields" in data:
        fields = data["image_prompt_extra_fields"]
        if not isinstance(fields, list):
            raise SettingsValidationError(
                "image_prompt_extra_fields must be an array of strings"
            )
        settings.image_prompt_extra_fields = json.dumps(
            [f.strip() for f in fields if isinstance(f, str) and f.strip()],
            ensure_ascii=False,
        )

    if "enable_text_reasoning" in data:
        settings.enable_text_reasoning = bool(data["enable_text_reasoning"])

    if "text_thinking_budget" in data:
        budget = int(data["text_thinking_budget"])
        if budget < 1 or budget > 8192:
            raise SettingsValidationError("Text thinking budget must be between 1 and 8192")
        settings.text_thinking_budget = budget

    if "enable_image_reasoning" in data:
        settings.enable_image_reasoning = bool(data["enable_image_reasoning"])

    if "image_thinking_budget" in data:
        budget = int(data["image_thinking_budget"])
        if budget < 1 or budget > 8192:
            raise SettingsValidationError("Image thinking budget must be between 1 and 8192")
        settings.image_thinking_budget = budget

    if "baidu_api_key" in data:
        settings.baidu_api_key = data["baidu_api_key"] or None

    if "text_model_source" in data:
        settings.text_model_source = (data["text_model_source"] or "").strip() or None

    if "image_model_source" in data:
        settings.image_model_source = (data["image_model_source"] or "").strip() or None

    if "image_caption_model_source" in data:
        settings.image_caption_model_source = (data["image_caption_model_source"] or "").strip() or None

    for model_type in ("text", "image", "image_caption"):
        key_field = f"{model_type}_api_key"
        base_field = f"{model_type}_api_base_url"

        if key_field in data:
            setattr(settings, key_field, data[key_field] or None)

        if base_field in data:
            setattr(settings, base_field, (data[base_field] or "").strip() or None)

    if "lazyllm_api_keys" in data:
        keys_data = data["lazyllm_api_keys"]
        if isinstance(keys_data, dict):
            existing = settings.get_lazyllm_api_keys_dict()
            for vendor, key in keys_data.items():
                if key:
                    existing[vendor] = key
            settings.lazyllm_api_keys = json.dumps(existing) if existing else None
        elif keys_data is None:
            settings.lazyllm_api_keys = None

    if "jwt_secret_key" in data:
        settings.jwt_secret_key = data["jwt_secret_key"] or None

    if "admin_init_phone" in data:
        settings.admin_init_phone = _normalize_optional_str(data["admin_init_phone"])

    if "admin_init_username" in data:
        settings.admin_init_username = _normalize_optional_str(data["admin_init_username"])

    if "admin_init_password" in data:
        settings.admin_init_password = data["admin_init_password"] or None

    if "sms_provider" in data:
        provider = _normalize_optional_str(data["sms_provider"])
        if provider and provider not in ALLOWED_SMS_PROVIDERS:
            allowed_values = "', '".join(sorted(ALLOWED_SMS_PROVIDERS))
            raise SettingsValidationError(
                f"SMS provider must be one of '{allowed_values}'"
            )
        settings.sms_provider = provider

    for field in (
        "sms_access_key_id",
        "sms_access_key_secret",
        "sms_sign_name",
        "sms_template_code",
        "sms_endpoint",
        "sms_mock_code",
        "wechat_pay_app_id",
        "wechat_pay_mch_id",
        "wechat_pay_serial_no",
        "wechat_pay_private_key",
        "wechat_pay_api_v3_key",
        "wechat_pay_gateway_url",
        "wechat_pay_notify_url",
    ):
        if field in data:
            setattr(settings, field, data[field] or None)

    for field in ("sms_code_ttl_minutes", "sms_rate_limit_per_day", "wechat_pay_order_expire_minutes"):
        if field in data:
            raw_value = data[field]
            if raw_value in (None, ""):
                setattr(settings, field, None)
            else:
                number = int(raw_value)
                if number < 1:
                    raise SettingsValidationError(f"{field} must be greater than 0")
                setattr(settings, field, number)

    for field in ("wechat_pay_enabled", "wechat_pay_mock"):
        if field in data:
            setattr(settings, field, _normalize_optional_bool(data[field]))

    settings.updated_at = datetime.now(timezone.utc)


def _reset_settings_values(settings: Settings):
    """Reset a settings row to environment defaults via NULL/initial values."""
    settings.ai_provider_format = None
    settings.api_base_url = None
    settings.api_key = None
    settings.text_model = None
    settings.image_model = None
    settings.mineru_api_base = None
    settings.mineru_token = None
    settings.image_caption_model = None
    settings.output_language = None
    settings.enable_text_reasoning = False
    settings.text_thinking_budget = 1024
    settings.enable_image_reasoning = False
    settings.image_thinking_budget = 1024
    settings.description_generation_mode = None
    settings.description_extra_fields = None
    settings.image_prompt_extra_fields = None
    settings.baidu_api_key = None
    settings.text_model_source = None
    settings.image_model_source = None
    settings.image_caption_model_source = None
    settings.lazyllm_api_keys = None
    for model_type in ("text", "image", "image_caption"):
        setattr(settings, f"{model_type}_api_key", None)
        setattr(settings, f"{model_type}_api_base_url", None)
    settings.image_resolution = None
    settings.image_aspect_ratio = None
    settings.max_description_workers = None
    settings.max_image_workers = None
    settings.jwt_secret_key = None
    settings.admin_init_phone = None
    settings.admin_init_username = None
    settings.admin_init_password = None
    settings.sms_provider = None
    settings.sms_access_key_id = None
    settings.sms_access_key_secret = None
    settings.sms_sign_name = None
    settings.sms_template_code = None
    settings.sms_endpoint = None
    settings.sms_code_ttl_minutes = None
    settings.sms_rate_limit_per_day = None
    settings.sms_mock_code = None
    settings.wechat_pay_enabled = None
    settings.wechat_pay_mock = None
    settings.wechat_pay_app_id = None
    settings.wechat_pay_mch_id = None
    settings.wechat_pay_serial_no = None
    settings.wechat_pay_private_key = None
    settings.wechat_pay_api_v3_key = None
    settings.wechat_pay_gateway_url = None
    settings.wechat_pay_notify_url = None
    settings.wechat_pay_order_expire_minutes = None
    settings.updated_at = datetime.now(timezone.utc)


def _build_test_settings_payload(base_settings: Settings) -> dict:
    """Build the base test payload from a settings row."""
    test_settings = {}
    if base_settings.api_key:
        test_settings["api_key"] = base_settings.api_key
    if base_settings.api_base_url:
        test_settings["api_base_url"] = base_settings.api_base_url
    if base_settings.ai_provider_format:
        test_settings["ai_provider_format"] = base_settings.ai_provider_format
    if base_settings.text_model:
        test_settings["text_model"] = base_settings.text_model
    if base_settings.image_model:
        test_settings["image_model"] = base_settings.image_model
    if base_settings.image_caption_model:
        test_settings["image_caption_model"] = base_settings.image_caption_model
    if current_app.config.get("IMAGE_CAPTION_MODEL_SOURCE"):
        test_settings["image_caption_model_source"] = current_app.config.get(
            "IMAGE_CAPTION_MODEL_SOURCE"
        )
    for model_type in ("text", "image", "image_caption"):
        for suffix in ("model_source", "api_key", "api_base_url"):
            attr = f"{model_type}_{suffix}"
            val = getattr(base_settings, attr, None)
            if val:
                test_settings[attr] = val
    if base_settings.mineru_api_base:
        test_settings["mineru_api_base"] = base_settings.mineru_api_base
    if base_settings.mineru_token:
        test_settings["mineru_token"] = base_settings.mineru_token
    if base_settings.baidu_api_key:
        test_settings["baidu_api_key"] = base_settings.baidu_api_key
    if base_settings.image_resolution:
        test_settings["image_resolution"] = base_settings.image_resolution
    test_settings["enable_text_reasoning"] = base_settings.enable_text_reasoning
    test_settings["text_thinking_budget"] = base_settings.text_thinking_budget
    test_settings["enable_image_reasoning"] = base_settings.enable_image_reasoning
    test_settings["image_thinking_budget"] = base_settings.image_thinking_budget
    return test_settings


def create_settings_test_task(test_name: str, base_settings: Settings, override_settings=None):
    """Start an async settings test using the provided settings scope."""
    if test_name not in TEST_FUNCTIONS:
        raise SettingsValidationError(f"Unknown test type: {test_name}")

    test_settings = _build_test_settings_payload(base_settings)
    override_settings = override_settings or {}
    if override_settings:
        logger.info(f"Applying test setting overrides: {list(override_settings.keys())}")
        test_settings.update(override_settings)

    task = Task(
        project_id='settings-test',
        task_type=f'TEST_{test_name.upper().replace("-", "_")}',
        status='PENDING'
    )
    db.session.add(task)
    db.session.commit()

    task_manager.submit_task(
        task.id,
        _run_test_async,
        test_name,
        test_settings,
        current_app._get_current_object()
    )

    logger.info(f"Started test task {task.id} for {test_name}")
    return success_response({'task_id': task.id, 'status': 'PENDING'}, '娴嬭瘯浠诲姟宸插惎鍔?')


@settings_bp.route("/", methods=["GET"], strict_slashes=False)
@require_auth
def get_settings():
    """
    GET /api/settings - Get application settings
    """
    try:
        settings = Settings.get_settings(getattr(g, "current_user", None))
        return success_response(_serialize_settings_for_request(settings))
    except Exception as e:
        logger.error(f"Error getting settings: {str(e)}")
        return error_response(
            "GET_SETTINGS_ERROR",
            f"Failed to get settings: {str(e)}",
            500,
        )


@settings_bp.route("/", methods=["PUT"], strict_slashes=False)
@require_auth
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
        _validate_request_scope_for_settings_payload(data)

        settings = Settings.get_settings(getattr(g, "current_user", None))
        _apply_settings_updates(settings, data)
        db.session.commit()

        request_user = getattr(g, "current_user", None)
        if request_user is None or request_user.uses_platform_shared_settings():
            _sync_settings_to_config(settings)

        logger.info("Settings updated successfully")
        return success_response(
            _serialize_settings_for_request(settings), "Settings updated successfully"
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
@require_auth
def reset_settings():
    """
    POST /api/settings/reset - Reset settings to default values
    """
    try:
        settings = Settings.get_settings(getattr(g, "current_user", None))
        _reset_settings_values(settings)

        db.session.commit()

        request_user = getattr(g, "current_user", None)
        if request_user is None or request_user.uses_platform_shared_settings():
            _sync_settings_to_config(settings)

        logger.info("Settings reset to defaults")
        return success_response(
            _serialize_settings_for_request(settings), "Settings reset to defaults"
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting settings: {str(e)}")
        return error_response(
            "RESET_SETTINGS_ERROR",
            f"Failed to reset settings: {str(e)}",
            500,
        )


@settings_bp.route("/active-config", methods=["GET"], strict_slashes=False)
@require_auth
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
@require_auth
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
        # 获取当前设置
        settings = Settings.get_settings(getattr(g, "current_user", None))
        if not settings:
            return success_response({
                "available": False,
                "message": "用户设置未找到"
            })

        # 准备设置覆盖字典
        settings_override = {}
        if settings.api_key:
            settings_override["api_key"] = settings.api_key
        if settings.api_base_url:
            settings_override["api_base_url"] = settings.api_base_url
        if settings.ai_provider_format:
            settings_override["ai_provider_format"] = settings.ai_provider_format
        if settings.text_model:
            settings_override["text_model"] = settings.text_model

        # 使用上下文管理器临时应用用户配置进行验证
        with temporary_settings_override(settings_override):
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


def _sync_settings_to_config(settings: Settings):
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

    defaults = Settings._get_config_defaults()
    runtime_value_map = {
        "JWT_SECRET_KEY": ("JWT_SECRET_KEY", settings.jwt_secret_key, defaults.get("jwt_secret_key")),
        "ADMIN_INIT_PHONE": ("ADMIN_INIT_PHONE", settings.admin_init_phone, defaults.get("admin_init_phone")),
        "ADMIN_INIT_USERNAME": ("ADMIN_INIT_USERNAME", settings.admin_init_username, defaults.get("admin_init_username")),
        "ADMIN_INIT_PASSWORD": ("ADMIN_INIT_PASSWORD", settings.admin_init_password, defaults.get("admin_init_password")),
        "SMS_PROVIDER": ("SMS_PROVIDER", settings.sms_provider, defaults.get("sms_provider")),
        "SMS_ACCESS_KEY_ID": ("SMS_ACCESS_KEY_ID", settings.sms_access_key_id, defaults.get("sms_access_key_id")),
        "SMS_SECRET_ID": ("SMS_SECRET_ID", settings.sms_access_key_id, defaults.get("sms_access_key_id")),
        "SMS_ACCESS_KEY_SECRET": ("SMS_ACCESS_KEY_SECRET", settings.sms_access_key_secret, defaults.get("sms_access_key_secret")),
        "SMS_SECRET_KEY": ("SMS_SECRET_KEY", settings.sms_access_key_secret, defaults.get("sms_access_key_secret")),
        "SMS_SIGN_NAME": ("SMS_SIGN_NAME", settings.sms_sign_name, defaults.get("sms_sign_name")),
        "SMS_TEMPLATE_CODE": ("SMS_TEMPLATE_CODE", settings.sms_template_code, defaults.get("sms_template_code")),
        "SMS_TEMPLATE_ID": ("SMS_TEMPLATE_ID", settings.sms_template_code, defaults.get("sms_template_code")),
        "SMS_ENDPOINT": ("SMS_ENDPOINT", settings.sms_endpoint, defaults.get("sms_endpoint")),
        "SMS_CODE_TTL_MINUTES": ("SMS_CODE_TTL_MINUTES", settings.sms_code_ttl_minutes, defaults.get("sms_code_ttl_minutes")),
        "SMS_RATE_LIMIT_PER_DAY": ("SMS_RATE_LIMIT_PER_DAY", settings.sms_rate_limit_per_day, defaults.get("sms_rate_limit_per_day")),
        "SMS_MOCK_CODE": ("SMS_MOCK_CODE", settings.sms_mock_code, defaults.get("sms_mock_code")),
        "WECHAT_PAY_ENABLED": ("WECHAT_PAY_ENABLED", settings.wechat_pay_enabled, defaults.get("wechat_pay_enabled")),
        "WECHAT_PAY_MOCK": ("WECHAT_PAY_MOCK", settings.wechat_pay_mock, defaults.get("wechat_pay_mock")),
        "WECHAT_PAY_APP_ID": ("WECHAT_PAY_APP_ID", settings.wechat_pay_app_id, defaults.get("wechat_pay_app_id")),
        "WECHAT_PAY_MCH_ID": ("WECHAT_PAY_MCH_ID", settings.wechat_pay_mch_id, defaults.get("wechat_pay_mch_id")),
        "WECHAT_PAY_SERIAL_NO": ("WECHAT_PAY_SERIAL_NO", settings.wechat_pay_serial_no, defaults.get("wechat_pay_serial_no")),
        "WECHAT_PAY_PRIVATE_KEY": ("WECHAT_PAY_PRIVATE_KEY", settings.wechat_pay_private_key, defaults.get("wechat_pay_private_key")),
        "WECHAT_PAY_API_V3_KEY": ("WECHAT_PAY_API_V3_KEY", settings.wechat_pay_api_v3_key, defaults.get("wechat_pay_api_v3_key")),
        "WECHAT_PAY_GATEWAY_URL": ("WECHAT_PAY_GATEWAY_URL", settings.wechat_pay_gateway_url, defaults.get("wechat_pay_gateway_url")),
        "WECHAT_PAY_NOTIFY_URL": ("WECHAT_PAY_NOTIFY_URL", settings.wechat_pay_notify_url, defaults.get("wechat_pay_notify_url")),
        "WECHAT_PAY_ORDER_EXPIRE_MINUTES": ("WECHAT_PAY_ORDER_EXPIRE_MINUTES", settings.wechat_pay_order_expire_minutes, defaults.get("wechat_pay_order_expire_minutes")),
    }
    for config_key, (_, current_value, default_value) in runtime_value_map.items():
        current_app.config[config_key] = current_value if current_value is not None else default_value

    _set_runtime_value("JWT_SECRET_KEY", ("JWT_SECRET_KEY",), settings.jwt_secret_key if settings.jwt_secret_key is not None else defaults.get("jwt_secret_key"))
    _set_runtime_value("ADMIN_INIT_PHONE", ("ADMIN_INIT_PHONE",), settings.admin_init_phone if settings.admin_init_phone is not None else defaults.get("admin_init_phone"))
    _set_runtime_value("ADMIN_INIT_USERNAME", ("ADMIN_INIT_USERNAME",), settings.admin_init_username if settings.admin_init_username is not None else defaults.get("admin_init_username"))
    _set_runtime_value("ADMIN_INIT_PASSWORD", ("ADMIN_INIT_PASSWORD",), settings.admin_init_password if settings.admin_init_password is not None else defaults.get("admin_init_password"))
    _set_runtime_value("SMS_PROVIDER", ("sms.provider", "SMS_PROVIDER"), settings.sms_provider if settings.sms_provider is not None else defaults.get("sms_provider"))
    _set_runtime_value("SMS_ACCESS_KEY_ID", ("sms.access_key_id", "SMS_ACCESS_KEY_ID", "SMS_SECRET_ID"), settings.sms_access_key_id if settings.sms_access_key_id is not None else defaults.get("sms_access_key_id"))
    _set_runtime_value("SMS_ACCESS_KEY_SECRET", ("sms.access_key_secret", "SMS_ACCESS_KEY_SECRET", "SMS_SECRET_KEY"), settings.sms_access_key_secret if settings.sms_access_key_secret is not None else defaults.get("sms_access_key_secret"))
    _set_runtime_value("SMS_SIGN_NAME", ("sms.sign_name", "SMS_SIGN_NAME"), settings.sms_sign_name if settings.sms_sign_name is not None else defaults.get("sms_sign_name"))
    _set_runtime_value("SMS_TEMPLATE_CODE", ("sms.template_code", "SMS_TEMPLATE_CODE", "SMS_TEMPLATE_ID"), settings.sms_template_code if settings.sms_template_code is not None else defaults.get("sms_template_code"))
    _set_runtime_value("SMS_ENDPOINT", ("sms.endpoint", "SMS_ENDPOINT"), settings.sms_endpoint if settings.sms_endpoint is not None else defaults.get("sms_endpoint"))
    _set_runtime_value("SMS_CODE_TTL_MINUTES", ("sms.code_ttl_minutes", "SMS_CODE_TTL_MINUTES"), settings.sms_code_ttl_minutes if settings.sms_code_ttl_minutes is not None else defaults.get("sms_code_ttl_minutes"))
    _set_runtime_value("SMS_RATE_LIMIT_PER_DAY", ("sms.rate_limit_per_day", "SMS_RATE_LIMIT_PER_DAY"), settings.sms_rate_limit_per_day if settings.sms_rate_limit_per_day is not None else defaults.get("sms_rate_limit_per_day"))
    _set_runtime_value("SMS_MOCK_CODE", ("sms.mock_code", "SMS_MOCK_CODE"), settings.sms_mock_code if settings.sms_mock_code is not None else defaults.get("sms_mock_code"))
    _set_runtime_value("WECHAT_PAY_ENABLED", ("pay.wechat.enabled", "WECHAT_PAY_ENABLED"), settings.wechat_pay_enabled if settings.wechat_pay_enabled is not None else defaults.get("wechat_pay_enabled"))
    _set_runtime_value("WECHAT_PAY_MOCK", ("pay.wechat.mock", "WECHAT_PAY_MOCK"), settings.wechat_pay_mock if settings.wechat_pay_mock is not None else defaults.get("wechat_pay_mock"))
    _set_runtime_value("WECHAT_PAY_APP_ID", ("pay.wechat.app_id", "WECHAT_PAY_APP_ID"), settings.wechat_pay_app_id if settings.wechat_pay_app_id is not None else defaults.get("wechat_pay_app_id"))
    _set_runtime_value("WECHAT_PAY_MCH_ID", ("pay.wechat.mch_id", "WECHAT_PAY_MCH_ID"), settings.wechat_pay_mch_id if settings.wechat_pay_mch_id is not None else defaults.get("wechat_pay_mch_id"))
    _set_runtime_value("WECHAT_PAY_SERIAL_NO", ("pay.wechat.serial_no", "WECHAT_PAY_SERIAL_NO"), settings.wechat_pay_serial_no if settings.wechat_pay_serial_no is not None else defaults.get("wechat_pay_serial_no"))
    _set_runtime_value("WECHAT_PAY_PRIVATE_KEY", ("pay.wechat.private_key", "WECHAT_PAY_PRIVATE_KEY"), settings.wechat_pay_private_key if settings.wechat_pay_private_key is not None else defaults.get("wechat_pay_private_key"))
    _set_runtime_value("WECHAT_PAY_API_V3_KEY", ("pay.wechat.api_v3_key", "WECHAT_PAY_API_V3_KEY"), settings.wechat_pay_api_v3_key if settings.wechat_pay_api_v3_key is not None else defaults.get("wechat_pay_api_v3_key"))
    _set_runtime_value("WECHAT_PAY_GATEWAY_URL", ("pay.wechat.gateway_url", "WECHAT_PAY_GATEWAY_URL"), settings.wechat_pay_gateway_url if settings.wechat_pay_gateway_url is not None else defaults.get("wechat_pay_gateway_url"))
    _set_runtime_value("WECHAT_PAY_NOTIFY_URL", ("pay.wechat.notify_url", "WECHAT_PAY_NOTIFY_URL"), settings.wechat_pay_notify_url if settings.wechat_pay_notify_url is not None else defaults.get("wechat_pay_notify_url"))
    _set_runtime_value("WECHAT_PAY_ORDER_EXPIRE_MINUTES", ("pay.wechat.order_expire_minutes", "WECHAT_PAY_ORDER_EXPIRE_MINUTES"), settings.wechat_pay_order_expire_minutes if settings.wechat_pay_order_expire_minutes is not None else defaults.get("wechat_pay_order_expire_minutes"))
    
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
    settings = Settings.get_settings(getattr(g, "current_user", None))
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
                    task.status = 'COMPLETED'
                    task.completed_at = datetime.now(timezone.utc)
                    task.set_progress({
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
@require_auth
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
        # 从数据库加载已保存的全局设置作为基础
        global_settings = Settings.get_settings(getattr(g, "current_user", None))

        # 构建基础测试设置（使用数据库中已保存的值）
        test_settings = {}
        if global_settings.api_key:
            test_settings["api_key"] = global_settings.api_key
        if global_settings.api_base_url:
            test_settings["api_base_url"] = global_settings.api_base_url
        if global_settings.ai_provider_format:
            test_settings["ai_provider_format"] = global_settings.ai_provider_format
        if global_settings.text_model:
            test_settings["text_model"] = global_settings.text_model
        if global_settings.image_model:
            test_settings["image_model"] = global_settings.image_model
        if global_settings.image_caption_model:
            test_settings["image_caption_model"] = global_settings.image_caption_model
        if current_app.config.get("IMAGE_CAPTION_MODEL_SOURCE"):
            test_settings["image_caption_model_source"] = current_app.config.get("IMAGE_CAPTION_MODEL_SOURCE")
        # Per-model provider sources and credentials
        for model_type in ('text', 'image', 'image_caption'):
            for suffix in ('model_source', 'api_key', 'api_base_url'):
                attr = f'{model_type}_{suffix}'
                val = getattr(global_settings, attr, None)
                if val:
                    test_settings[attr] = val
        if global_settings.mineru_api_base:
            test_settings["mineru_api_base"] = global_settings.mineru_api_base
        if global_settings.mineru_token:
            test_settings["mineru_token"] = global_settings.mineru_token
        if global_settings.baidu_api_key:
            test_settings["baidu_api_key"] = global_settings.baidu_api_key
        if global_settings.image_resolution:
            test_settings["image_resolution"] = global_settings.image_resolution
        # 推理模式设置
        test_settings["enable_text_reasoning"] = global_settings.enable_text_reasoning
        test_settings["text_thinking_budget"] = global_settings.text_thinking_budget
        test_settings["enable_image_reasoning"] = global_settings.enable_image_reasoning
        test_settings["image_thinking_budget"] = global_settings.image_thinking_budget

        # 应用前端发送的覆盖参数（如果有的话，用于测试未保存的配置）
        override_settings = request.get_json() or {}
        if override_settings:
            logger.info(f"Applying test setting overrides: {list(override_settings.keys())}")
            test_settings.update(override_settings)

        # 创建任务记录（使用特殊的 project_id='settings-test'）
        task = Task(
            project_id='settings-test',  # 特殊标记，表示这是设置测试任务
            task_type=f'TEST_{test_name.upper().replace("-", "_")}',
            status='PENDING'
        )
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
@require_auth
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
        task = Task.query.get(task_id)
        if not task:
            return error_response("TASK_NOT_FOUND", "测试任务不存在", 404)
        if task.project_id != 'settings-test':
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
            progress = task.get_progress()
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
