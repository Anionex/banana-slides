"""Admin Config Controller - manages system-wide configurations"""

import logging
from flask import Blueprint, request
from models import db, SystemConfig
from utils import success_response, error_response, bad_request
from middlewares.auth import auth_required, admin_required

logger = logging.getLogger(__name__)

admin_config_bp = Blueprint(
    "admin_config", __name__, url_prefix="/api/admin/config"
)


@admin_config_bp.route("/", methods=["GET"], strict_slashes=False)
@auth_required
@admin_required
def get_system_config():
    """
    GET /api/admin/config - 获取系统配置
    """
    try:
        config = SystemConfig.get_instance()
        return success_response(config.to_dict())
    except Exception as e:
        logger.error(f"Error getting system config: {str(e)}")
        return error_response(
            "GET_CONFIG_ERROR",
            f"获取系统配置失败: {str(e)}",
            500,
        )


@admin_config_bp.route("/", methods=["PUT"], strict_slashes=False)
@auth_required
@admin_required
def update_system_config():
    """
    PUT /api/admin/config - 更新系统配置

    Request Body:
        {
            "user_editable_fields": ["output_language", "image_resolution"],
            "registration_bonus": 50,
            "invitation_bonus": 50,
            "max_invitation_codes": 3,
            "cost_generate_outline": 5,
            "cost_generate_description": 1,
            "cost_generate_image_1k": 4,
            "cost_generate_image_2k": 8,
            "cost_generate_image_4k": 16,
            "cost_edit_image": 8,
            "cost_generate_material": 10,
            "cost_refine_outline": 2,
            "cost_refine_description": 1,
            "cost_parse_file": 5,
            "cost_export_editable": 15,
            "enable_credits_purchase": true,
            "enable_invitation": true
        }
    """
    try:
        data = request.get_json()
        if not data:
            return bad_request("Request body is required")

        config = SystemConfig.get_instance()

        # 更新用户可编辑字段
        if "user_editable_fields" in data:
            fields = data["user_editable_fields"]
            if not isinstance(fields, list):
                return bad_request("user_editable_fields must be a list")
            # 验证字段名有效性
            valid_fields = {
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
            invalid_fields = set(fields) - valid_fields
            if invalid_fields:
                return bad_request(f"Invalid fields: {', '.join(invalid_fields)}")
            config.set_user_editable_fields(fields)

        # 更新积分奖励配置
        if "registration_bonus" in data:
            bonus = int(data["registration_bonus"])
            if bonus < 0:
                return bad_request("registration_bonus must be non-negative")
            config.registration_bonus = bonus

        if "invitation_bonus" in data:
            bonus = int(data["invitation_bonus"])
            if bonus < 0:
                return bad_request("invitation_bonus must be non-negative")
            config.invitation_bonus = bonus

        if "max_invitation_codes" in data:
            max_codes = int(data["max_invitation_codes"])
            if max_codes < 0 or max_codes > 100:
                return bad_request("max_invitation_codes must be between 0 and 100")
            config.max_invitation_codes = max_codes

        # 更新积分消耗配置
        cost_fields = [
            "cost_generate_outline",
            "cost_generate_description",
            "cost_generate_image_1k",
            "cost_generate_image_2k",
            "cost_generate_image_4k",
            "cost_edit_image",
            "cost_generate_material",
            "cost_refine_outline",
            "cost_refine_description",
            "cost_parse_file",
            "cost_export_editable",
        ]
        for field in cost_fields:
            if field in data:
                cost = int(data[field])
                if cost < 0:
                    return bad_request(f"{field} must be non-negative")
                setattr(config, field, cost)

        # 更新功能开关
        if "enable_credits_purchase" in data:
            config.enable_credits_purchase = bool(data["enable_credits_purchase"])

        if "enable_invitation" in data:
            config.enable_invitation = bool(data["enable_invitation"])

        # 更新套餐配置
        if "credit_packages" in data:
            packages = data["credit_packages"]
            if packages is not None and not isinstance(packages, list):
                return bad_request("credit_packages must be a list or null")
            if packages is None:
                config.credit_packages = None
            else:
                config.set_credit_packages(packages)

        # 更新文生图渠道池
        pool_changed = False
        if "image_provider_pool" in data:
            pool = data["image_provider_pool"]
            if pool is not None and not isinstance(pool, list):
                return bad_request("image_provider_pool must be a list or null")
            if pool is None:
                config.image_provider_pool = None
            else:
                existing_pool = config.get_image_provider_pool() or []
                existing_keys = {
                    ch['id']: ch['api_key']
                    for ch in existing_pool if ch.get('id') and ch.get('api_key')
                }
                for ch in pool:
                    if not isinstance(ch, dict):
                        return bad_request("Each channel must be an object")
                    if not ch.get('api_key') and ch.get('id') in existing_keys:
                        ch['api_key'] = existing_keys[ch['id']]
                    if not ch.get('provider_format') or not ch.get('api_key'):
                        return bad_request(
                            "Each channel must have provider_format and api_key"
                        )
                config.set_image_provider_pool(pool)
            pool_changed = True

        db.session.commit()
        logger.info("System config updated successfully")

        if pool_changed:
            try:
                from services.ai_service_manager import clear_ai_service_cache
                clear_ai_service_cache()
            except Exception as e:
                logger.warning(f"Failed to clear AI service cache: {e}")

        return success_response(config.to_dict(), "系统配置更新成功")

    except ValueError as e:
        return bad_request(f"Invalid value: {str(e)}")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating system config: {str(e)}")
        return error_response(
            "UPDATE_CONFIG_ERROR",
            f"更新系统配置失败: {str(e)}",
            500,
        )


@admin_config_bp.route("/public", methods=["GET"], strict_slashes=False)
def get_public_config():
    """GET /api/admin/config/public - Public system flags for UI rendering"""
    config = SystemConfig.get_instance()
    return success_response({
        "enable_credits_purchase": config.enable_credits_purchase,
    })


@admin_config_bp.route("/credit-costs", methods=["GET"], strict_slashes=False)
@auth_required
@admin_required
def get_credit_costs():
    """
    GET /api/admin/config/credit-costs - 获取积分消耗配置（简化接口）
    """
    try:
        config = SystemConfig.get_instance()
        return success_response(config.get_credit_costs())
    except Exception as e:
        logger.error(f"Error getting credit costs: {str(e)}")
        return error_response(
            "GET_COSTS_ERROR",
            f"获取积分配置失败: {str(e)}",
            500,
        )


@admin_config_bp.route("/user-policy", methods=["GET"], strict_slashes=False)
@auth_required
@admin_required
def get_user_policy():
    """
    GET /api/admin/config/user-policy - 获取用户策略配置
    """
    try:
        config = SystemConfig.get_instance()

        # 所有可能的设置字段
        all_fields = [
            {'key': 'ai_provider_format', 'label': 'AI 提供商格式', 'category': 'api'},
            {'key': 'api_base_url', 'label': 'API Base URL', 'category': 'api'},
            {'key': 'api_key', 'label': 'API Key', 'category': 'api', 'sensitive': True},
            {'key': 'text_model', 'label': '文本模型', 'category': 'model'},
            {'key': 'image_model', 'label': '图像生成模型', 'category': 'model'},
            {'key': 'image_caption_model', 'label': '图片识别模型', 'category': 'model'},
            {'key': 'mineru_api_base', 'label': 'MinerU API Base', 'category': 'mineru'},
            {'key': 'mineru_token', 'label': 'MinerU Token', 'category': 'mineru', 'sensitive': True},
            {'key': 'image_resolution', 'label': '图像清晰度', 'category': 'image'},
            {'key': 'image_aspect_ratio', 'label': '图像宽高比', 'category': 'image'},
            {'key': 'max_description_workers', 'label': '描述生成并发数', 'category': 'performance'},
            {'key': 'max_image_workers', 'label': '图像生成并发数', 'category': 'performance'},
            {'key': 'output_language', 'label': '输出语言', 'category': 'output'},
            {'key': 'enable_text_reasoning', 'label': '文本推理模式', 'category': 'reasoning'},
            {'key': 'text_thinking_budget', 'label': '文本思考负载', 'category': 'reasoning'},
            {'key': 'enable_image_reasoning', 'label': '图像推理模式', 'category': 'reasoning'},
            {'key': 'image_thinking_budget', 'label': '图像思考负载', 'category': 'reasoning'},
            {'key': 'baidu_api_key', 'label': '百度 OCR API Key', 'category': 'ocr', 'sensitive': True},
        ]

        editable_fields = set(config.get_user_editable_fields())

        return success_response({
            'all_fields': all_fields,
            'editable_fields': list(editable_fields),
        })
    except Exception as e:
        logger.error(f"Error getting user policy: {str(e)}")
        return error_response(
            "GET_POLICY_ERROR",
            f"获取用户策略失败: {str(e)}",
            500,
        )


@admin_config_bp.route("/user-policy", methods=["PUT"], strict_slashes=False)
@auth_required
@admin_required
def update_user_policy():
    """
    PUT /api/admin/config/user-policy - 更新用户策略

    Request Body:
        {
            "editable_fields": ["output_language", "image_resolution", "image_aspect_ratio"]
        }
    """
    try:
        data = request.get_json()
        if not data:
            return bad_request("Request body is required")

        if "editable_fields" not in data:
            return bad_request("editable_fields is required")

        fields = data["editable_fields"]
        if not isinstance(fields, list):
            return bad_request("editable_fields must be a list")

        config = SystemConfig.get_instance()
        config.set_user_editable_fields(fields)
        db.session.commit()

        logger.info(f"User policy updated: {fields}")
        return success_response({
            'editable_fields': fields
        }, "用户策略更新成功")

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating user policy: {str(e)}")
        return error_response(
            "UPDATE_POLICY_ERROR",
            f"更新用户策略失败: {str(e)}",
            500,
        )
