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
from models import db, Settings, Task
from utils import success_response, error_response, bad_request
from config import Config, PROJECT_ROOT
from services.ai_service import AIService
from services.file_parser_service import FileParserService
from services.ai_providers.ocr.baidu_accurate_ocr_provider import create_baidu_accurate_ocr_provider
from services.ai_providers.image.baidu_inpainting_provider import create_baidu_inpainting_provider
from services.task_manager import task_manager

logger = logging.getLogger(__name__)
ALLOWED_PROVIDER_FORMATS = {"openai", "gemini", "lazyllm"}

settings_bp = Blueprint(
    "settings", __name__, url_prefix="/api/settings"
)


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

        if settings_override.get("baidu_ocr_api_key"):
            original_values["BAIDU_OCR_API_KEY"] = current_app.config.get("BAIDU_OCR_API_KEY")
            current_app.config["BAIDU_OCR_API_KEY"] = settings_override["baidu_ocr_api_key"]

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
        if "baidu_ocr_api_key" in data:
            settings.baidu_ocr_api_key = data["baidu_ocr_api_key"] or None

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
        # - If "lazyllm" -> keep API base/key empty (uses source-specific env keys)
        # - Otherwise (default "gemini") -> use GOOGLE_API_BASE / GOOGLE_API_KEY
        settings.ai_provider_format = Config.AI_PROVIDER_FORMAT

        if (Config.AI_PROVIDER_FORMAT or "").lower() == "openai":
            default_api_base = Config.OPENAI_API_BASE or None
            default_api_key = Config.OPENAI_API_KEY or None
        elif (Config.AI_PROVIDER_FORMAT or "").lower() == "lazyllm":
            default_api_base = None
            default_api_key = None
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
        # 重置推理模式配置
        settings.enable_text_reasoning = False
        settings.text_thinking_budget = 1024
        settings.enable_image_reasoning = False
        settings.image_thinking_budget = 1024
        settings.baidu_ocr_api_key = Config.BAIDU_OCR_API_KEY or None
        settings.text_model_source = getattr(Config, 'TEXT_MODEL_SOURCE', None)
        settings.image_model_source = getattr(Config, 'IMAGE_MODEL_SOURCE', None)
        settings.image_caption_model_source = getattr(Config, 'IMAGE_CAPTION_MODEL_SOURCE', None)
        from services.ai_providers.lazyllm_env import collect_env_lazyllm_api_keys
        settings.lazyllm_api_keys = collect_env_lazyllm_api_keys()
        # 重置 per-model API 凭证
        for model_type in ('text', 'image', 'image_caption'):
            setattr(settings, f'{model_type}_api_key', None)
            setattr(settings, f'{model_type}_api_base_url', None)
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


@settings_bp.route("/verify", methods=["POST"], strict_slashes=False)
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
        settings = Settings.get_settings()
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
                if provider_format == "lazyllm":
                    source = current_app.config.get("TEXT_MODEL_SOURCE", Config.TEXT_MODEL_SOURCE).upper()
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
    
    # Sync AI provider format (always sync, has default value)
    if settings.ai_provider_format:
        old_format = current_app.config.get("AI_PROVIDER_FORMAT")
        if old_format != settings.ai_provider_format:
            ai_config_changed = True
            logger.info(f"AI provider format changed: {old_format} -> {settings.ai_provider_format}")
        current_app.config["AI_PROVIDER_FORMAT"] = settings.ai_provider_format
    
    # Sync API configuration (sync to both GOOGLE_* and OPENAI_* to ensure DB settings override env vars)
    if settings.api_base_url is not None:
        old_base = current_app.config.get("GOOGLE_API_BASE")
        if old_base != settings.api_base_url:
            ai_config_changed = True
            logger.info(f"API base URL changed: {old_base} -> {settings.api_base_url}")
        current_app.config["GOOGLE_API_BASE"] = settings.api_base_url
        current_app.config["OPENAI_API_BASE"] = settings.api_base_url
    else:
        # Remove overrides, fall back to env variables or defaults
        if "GOOGLE_API_BASE" in current_app.config or "OPENAI_API_BASE" in current_app.config:
            ai_config_changed = True
            logger.info("API base URL cleared, falling back to defaults")
        current_app.config.pop("GOOGLE_API_BASE", None)
        current_app.config.pop("OPENAI_API_BASE", None)

    if settings.api_key is not None:
        old_key = current_app.config.get("GOOGLE_API_KEY")
        # Compare actual values to detect any change (but don't log the keys for security)
        if old_key != settings.api_key:
            ai_config_changed = True
            logger.info("API key updated")
        current_app.config["GOOGLE_API_KEY"] = settings.api_key
        current_app.config["OPENAI_API_KEY"] = settings.api_key
    else:
        # Remove overrides, fall back to env variables or defaults
        if "GOOGLE_API_KEY" in current_app.config or "OPENAI_API_KEY" in current_app.config:
            ai_config_changed = True
            logger.info("API key cleared, falling back to defaults")
        current_app.config.pop("GOOGLE_API_KEY", None)
        current_app.config.pop("OPENAI_API_KEY", None)
    
    # Check model changes
    if settings.text_model is not None:
        old_model = current_app.config.get("TEXT_MODEL")
        if old_model != settings.text_model:
            ai_config_changed = True
            logger.info(f"Text model changed: {old_model} -> {settings.text_model}")
        current_app.config["TEXT_MODEL"] = settings.text_model
    
    if settings.image_model is not None:
        old_model = current_app.config.get("IMAGE_MODEL")
        if old_model != settings.image_model:
            ai_config_changed = True
            logger.info(f"Image model changed: {old_model} -> {settings.image_model}")
        current_app.config["IMAGE_MODEL"] = settings.image_model

    # Sync image generation settings
    current_app.config["DEFAULT_RESOLUTION"] = settings.image_resolution
    current_app.config["DEFAULT_ASPECT_RATIO"] = settings.image_aspect_ratio

    # Sync worker settings
    current_app.config["MAX_DESCRIPTION_WORKERS"] = settings.max_description_workers
    current_app.config["MAX_IMAGE_WORKERS"] = settings.max_image_workers
    logger.info(f"Updated worker settings: desc={settings.max_description_workers}, img={settings.max_image_workers}")

    # Sync MinerU settings (optional, fall back to Config defaults if None)
    if settings.mineru_api_base:
        current_app.config["MINERU_API_BASE"] = settings.mineru_api_base
        logger.info(f"Updated MINERU_API_BASE to: {settings.mineru_api_base}")
    if settings.mineru_token is not None:
        current_app.config["MINERU_TOKEN"] = settings.mineru_token
        logger.info("Updated MINERU_TOKEN from settings")
    if settings.image_caption_model:
        current_app.config["IMAGE_CAPTION_MODEL"] = settings.image_caption_model
        logger.info(f"Updated IMAGE_CAPTION_MODEL to: {settings.image_caption_model}")
    if settings.output_language:
        current_app.config["OUTPUT_LANGUAGE"] = settings.output_language
        logger.info(f"Updated OUTPUT_LANGUAGE to: {settings.output_language}")
    
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
    
    # Sync Baidu OCR settings
    if settings.baidu_ocr_api_key:
        current_app.config["BAIDU_OCR_API_KEY"] = settings.baidu_ocr_api_key
        logger.info("Updated BAIDU_OCR_API_KEY from settings")

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
    api_key = current_app.config.get("BAIDU_OCR_API_KEY") or Config.BAIDU_OCR_API_KEY
    if not api_key:
        raise ValueError("未配置 BAIDU_OCR_API_KEY")
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
        global_settings = Settings.get_settings()

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
        if global_settings.baidu_ocr_api_key:
            test_settings["baidu_ocr_api_key"] = global_settings.baidu_ocr_api_key
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
