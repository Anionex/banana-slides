"""Settings Controller - handles application settings endpoints"""

import logging
import shutil
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from flask import Blueprint, request, current_app
from PIL import Image
from models import db, Settings
from utils import success_response, error_response, bad_request
from config import Config, PROJECT_ROOT
from services.ai_service import AIService
from services.file_parser_service import FileParserService
from services.ai_providers.ocr.baidu_accurate_ocr_provider import create_baidu_accurate_ocr_provider
from services.ai_providers.image.baidu_inpainting_provider import create_baidu_inpainting_provider

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
        # 重置推理模式配置
        settings.enable_text_reasoning = False
        settings.text_thinking_budget = 1024
        settings.enable_image_reasoning = False
        settings.image_thinking_budget = 1024
        settings.baidu_ocr_api_key = Config.BAIDU_OCR_API_KEY or None
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


@settings_bp.route("/tests/<test_name>", methods=["POST"], strict_slashes=False)
def run_settings_test(test_name: str):
    """
    POST /api/settings/tests/<test_name> - Run service test
    """
    try:
        if test_name == "baidu-ocr":
            api_key = current_app.config.get("BAIDU_OCR_API_KEY") or Config.BAIDU_OCR_API_KEY
            api_secret = current_app.config.get("BAIDU_OCR_API_SECRET") or Config.BAIDU_OCR_API_SECRET
            if not api_key:
                return bad_request("未配置 BAIDU_OCR_API_KEY，无法测试百度 OCR")

            provider = create_baidu_accurate_ocr_provider(api_key, api_secret)
            if not provider:
                return bad_request("百度 OCR Provider 初始化失败，请检查配置")

            test_image_path = _get_test_image_path()
            result = provider.recognize(str(test_image_path), language_type="CHN_ENG")
            recognized_text = provider.get_full_text(result, separator=" ")

            return success_response(
                {
                    "recognized_text": recognized_text,
                    "words_result_num": result.get("words_result_num", 0),
                },
                "百度 OCR 测试成功"
            )

        if test_name == "text-model":
            ai_service = AIService()
            reply = ai_service.text_provider.generate_text("请只回复 OK。", thinking_budget=64)
            return success_response(
                {"reply": reply.strip()},
                "文本模型测试成功"
            )

        if test_name == "caption-model":
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

                parser = FileParserService(
                    mineru_token=current_app.config.get("MINERU_TOKEN", ""),
                    mineru_api_base=current_app.config.get("MINERU_API_BASE", ""),
                    google_api_key=current_app.config.get("GOOGLE_API_KEY", ""),
                    google_api_base=current_app.config.get("GOOGLE_API_BASE", ""),
                    openai_api_key=current_app.config.get("OPENAI_API_KEY", ""),
                    openai_api_base=current_app.config.get("OPENAI_API_BASE", ""),
                    image_caption_model=current_app.config.get("IMAGE_CAPTION_MODEL", Config.IMAGE_CAPTION_MODEL),
                    provider_format=current_app.config.get("AI_PROVIDER_FORMAT", "gemini"),
                )

                image_url = f"/files/mineru/{extract_id}/{image_path.name}"
                caption = parser._generate_single_caption(image_url).strip()

                if not caption:
                    return error_response(
                        "CAPTION_TEST_FAILED",
                        "图片识别模型返回空结果，请检查 API Key、模型名称或服务状态",
                        502
                    )

                return success_response(
                    {"caption": caption},
                    "图片识别模型测试成功"
                )
            finally:
                if image_path.exists():
                    image_path.unlink()
                if image_dir.exists():
                    try:
                        image_dir.rmdir()
                    except OSError:
                        pass

        if test_name == "baidu-inpaint":
            api_key = current_app.config.get("BAIDU_OCR_API_KEY") or Config.BAIDU_OCR_API_KEY
            api_secret = current_app.config.get("BAIDU_OCR_API_SECRET") or Config.BAIDU_OCR_API_SECRET
            if not api_key:
                return bad_request("未配置 BAIDU_OCR_API_KEY，无法测试百度图像修复")

            provider = create_baidu_inpainting_provider(api_key, api_secret)
            if not provider:
                return bad_request("百度图像修复 Provider 初始化失败，请检查配置")

            test_image_path = _get_test_image_path()
            with Image.open(test_image_path) as image:
                width, height = image.size
                rect_width = max(1, int(width * 0.3))
                rect_height = max(1, int(height * 0.3))
                left = max(0, int(width * 0.35))
                top = max(0, int(height * 0.35))
                rectangles = [
                    {
                        "left": left,
                        "top": top,
                        "width": min(rect_width, width - left),
                        "height": min(rect_height, height - top),
                    }
                ]
                result = provider.inpaint(image, rectangles)

            if result is None:
                return error_response(
                    "INPAINT_TEST_FAILED",
                    "百度图像修复返回空结果，请检查配置或服务状态",
                    502
                )

            return success_response(
                {"image_size": result.size},
                "百度图像修复测试成功"
            )

        if test_name == "image-model":
            ai_service = AIService()
            test_image_path = _get_test_image_path()
            prompt = "生成一张简洁、明亮、适合演示文稿的背景图。"
            result = ai_service.generate_image(
                prompt=prompt,
                ref_image_path=str(test_image_path),
                aspect_ratio="16:9",
                resolution=current_app.config.get("DEFAULT_RESOLUTION", "1K")
            )

            if result is None:
                return error_response(
                    "IMAGE_MODEL_TEST_FAILED",
                    "图像生成模型返回空结果，请检查模型配置或服务状态",
                    502
                )

            return success_response(
                {"image_size": result.size},
                "图像生成模型测试成功"
            )

        if test_name == "mineru-pdf":
            mineru_token = current_app.config.get("MINERU_TOKEN", "")
            mineru_api_base = current_app.config.get("MINERU_API_BASE", "")
            if not mineru_token:
                return bad_request("未配置 MINERU_TOKEN，无法测试 MinerU 解析")

            parser = FileParserService(
                mineru_token=mineru_token,
                mineru_api_base=mineru_api_base,
                google_api_key=current_app.config.get("GOOGLE_API_KEY", ""),
                google_api_base=current_app.config.get("GOOGLE_API_BASE", ""),
                openai_api_key=current_app.config.get("OPENAI_API_KEY", ""),
                openai_api_base=current_app.config.get("OPENAI_API_BASE", ""),
                image_caption_model=current_app.config.get("IMAGE_CAPTION_MODEL", Config.IMAGE_CAPTION_MODEL),
                provider_format=current_app.config.get("AI_PROVIDER_FORMAT", "gemini"),
            )

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
                    return error_response("MINERU_TEST_FAILED", error, 502)

                upload_error = parser._upload_file(str(tmp_file), upload_url)
                if upload_error:
                    return error_response("MINERU_TEST_FAILED", upload_error, 502)

                markdown_content, extract_id, poll_error = parser._poll_result(batch_id, max_wait_time=60)
                if poll_error:
                    return error_response("MINERU_TEST_FAILED", poll_error, 502)

                content_preview = (markdown_content or "").strip()[:120]
                return success_response(
                    {
                        "batch_id": batch_id,
                        "extract_id": extract_id,
                        "content_preview": content_preview,
                    },
                    "MinerU 解析测试成功"
                )
            finally:
                if tmp_file and tmp_file.exists():
                    tmp_file.unlink()

        return bad_request(f"未知测试类型: {test_name}")

    except Exception as e:
        logger.error(f"Settings test failed: {str(e)}", exc_info=True)
        return error_response(
            "SETTINGS_TEST_ERROR",
            f"服务测试失败: {str(e)}",
            500
        )
