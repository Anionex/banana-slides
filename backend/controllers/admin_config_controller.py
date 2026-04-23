"""Admin Config Controller - manages system-wide configurations."""
from __future__ import annotations

import copy
import logging
from typing import Any, Dict

from flask import Blueprint, request

from middlewares.auth import admin_required, auth_required
from models import SystemConfig, db
from services.provider_config import (
    describe_payment_provider,
    describe_storage_backend,
    get_payment_runtime_settings,
    get_storage_runtime_settings,
)
from services.provider_metadata import PAYMENT_PROVIDER_SECRET_FIELDS, STORAGE_PROVIDER_SECRET_FIELDS
from utils import bad_request, error_response, success_response

logger = logging.getLogger(__name__)

admin_config_bp = Blueprint('admin_config', __name__, url_prefix='/api/admin/config')

KNOWN_PAYMENT_PROVIDERS = {'stripe', 'paypal', 'xunhupay', 'lemon_squeezy', 'wechatpay'}
KNOWN_STORAGE_BACKENDS = {'local', 'r2', 'oss'}


def _clean_meta_fields(value: Any):
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if key.endswith('_length'):
                continue
            cleaned[key] = _clean_meta_fields(item)
        return cleaned
    if isinstance(value, list):
        return [_clean_meta_fields(item) for item in value]
    return value


def _deep_merge(base: Any, override: Any):
    if isinstance(base, dict) and isinstance(override, dict):
        result = copy.deepcopy(base)
        for key, value in override.items():
            if key in result:
                result[key] = _deep_merge(result[key], value)
            else:
                result[key] = copy.deepcopy(value)
        return result
    return copy.deepcopy(override)


def _merge_provider_configs(existing_configs: Dict[str, Any], incoming_configs: Dict[str, Any], secret_fields_map: Dict[str, list[str]]):
    existing_configs = copy.deepcopy(existing_configs or {})
    incoming_configs = _clean_meta_fields(incoming_configs or {})

    for provider_name, provider_payload in incoming_configs.items():
        if provider_payload is None:
            existing_configs[provider_name] = {}
            continue
        if not isinstance(provider_payload, dict):
            existing_configs[provider_name] = provider_payload
            continue

        existing_provider = copy.deepcopy(existing_configs.get(provider_name) or {})
        merged_provider = _deep_merge(existing_provider, provider_payload)
        for secret_field in secret_fields_map.get(provider_name, []):
            if secret_field not in provider_payload:
                continue
            incoming_secret = provider_payload.get(secret_field)
            if incoming_secret == '':
                merged_provider[secret_field] = existing_provider.get(secret_field, '')
            elif incoming_secret is None:
                merged_provider[secret_field] = ''
            else:
                merged_provider[secret_field] = incoming_secret
        existing_configs[provider_name] = merged_provider

    return existing_configs


@admin_config_bp.route('/', methods=['GET'], strict_slashes=False)
@auth_required
@admin_required
def get_system_config():
    """GET /api/admin/config - 获取系统配置"""
    try:
        config = SystemConfig.get_instance()
        return success_response(config.to_dict())
    except Exception as exc:
        logger.error('Error getting system config: %s', exc)
        return error_response('GET_CONFIG_ERROR', 'Failed to load system config', 500)


@admin_config_bp.route('/', methods=['PUT'], strict_slashes=False)
@auth_required
@admin_required
def update_system_config():
    """PUT /api/admin/config - 更新系统配置"""
    try:
        data = request.get_json()
        if not data:
            return bad_request('Request body is required')

        config = SystemConfig.get_instance()
        payment_changed = False
        storage_changed = False
        pool_changed = False

        if 'user_editable_fields' in data:
            fields = data['user_editable_fields']
            if not isinstance(fields, list):
                return bad_request('user_editable_fields must be a list')
            valid_fields = {
                'ai_provider_format', 'api_base_url', 'api_key',
                'text_model', 'image_model', 'image_caption_model',
                'mineru_api_base', 'mineru_token',
                'image_resolution', 'image_aspect_ratio',
                'max_description_workers', 'max_image_workers',
                'output_language',
                'enable_text_reasoning', 'text_thinking_budget',
                'enable_image_reasoning', 'image_thinking_budget',
                'baidu_api_key',
            }
            invalid_fields = set(fields) - valid_fields
            if invalid_fields:
                return bad_request(f"Invalid fields: {', '.join(invalid_fields)}")
            config.set_user_editable_fields(fields)

        if 'registration_bonus' in data:
            bonus = int(data['registration_bonus'])
            if bonus < 0:
                return bad_request('registration_bonus must be non-negative')
            config.registration_bonus = bonus

        if 'invitation_bonus' in data:
            bonus = int(data['invitation_bonus'])
            if bonus < 0:
                return bad_request('invitation_bonus must be non-negative')
            config.invitation_bonus = bonus

        if 'max_invitation_codes' in data:
            max_codes = int(data['max_invitation_codes'])
            if max_codes < 0 or max_codes > 100:
                return bad_request('max_invitation_codes must be between 0 and 100')
            config.max_invitation_codes = max_codes

        cost_fields = [
            'cost_generate_outline',
            'cost_generate_description',
            'cost_generate_image_1k',
            'cost_generate_image_2k',
            'cost_generate_image_4k',
            'cost_edit_image',
            'cost_generate_material',
            'cost_refine_outline',
            'cost_refine_description',
            'cost_parse_file',
            'cost_export_editable',
        ]
        for field in cost_fields:
            if field in data:
                cost = int(data[field])
                if cost < 0:
                    return bad_request(f'{field} must be non-negative')
                setattr(config, field, cost)

        existing_payment_configs = config.get_payment_provider_configs(raw=True) or {}
        existing_storage_configs = config.get_storage_provider_configs(raw=True) or {}

        if 'xunhupay_app_id' in data:
            config.xunhupay_app_id = str(data.get('xunhupay_app_id') or '')
            existing_payment_configs.setdefault('xunhupay', {})['app_id'] = config.xunhupay_app_id
            payment_changed = True

        if 'xunhupay_app_secret' in data:
            new_secret = data.get('xunhupay_app_secret')
            if new_secret == '':
                new_secret = config.xunhupay_app_secret
            elif new_secret is None:
                new_secret = ''
            config.xunhupay_app_secret = str(new_secret or '')
            existing_payment_configs.setdefault('xunhupay', {})['app_secret'] = config.xunhupay_app_secret
            payment_changed = True

        if 'enable_credits_purchase' in data:
            config.enable_credits_purchase = bool(data['enable_credits_purchase'])
        if 'enable_alipay' in data:
            config.enable_alipay = bool(data['enable_alipay'])
        if 'enable_invitation' in data:
            config.enable_invitation = bool(data['enable_invitation'])

        if 'credit_packages' in data:
            packages = data['credit_packages']
            if packages is not None and not isinstance(packages, list):
                return bad_request('credit_packages must be a list or null')
            if packages is None:
                config.credit_packages = None
            else:
                config.set_credit_packages(packages)

        if 'image_provider_pool' in data:
            pool = data['image_provider_pool']
            if pool is not None and not isinstance(pool, list):
                return bad_request('image_provider_pool must be a list or null')
            if pool is None:
                config.image_provider_pool = None
            else:
                existing_pool = config.get_image_provider_pool() or []
                existing_keys = {ch['id']: ch['api_key'] for ch in existing_pool if ch.get('id') and ch.get('api_key')}
                for channel in pool:
                    if not isinstance(channel, dict):
                        return bad_request('Each channel must be an object')
                    if not channel.get('api_key') and channel.get('id') in existing_keys:
                        channel['api_key'] = existing_keys[channel['id']]
                    if not channel.get('provider_format') or not channel.get('api_key'):
                        return bad_request('Each channel must have provider_format and api_key')
                config.set_image_provider_pool(pool)
            pool_changed = True

        if 'enabled_payment_providers' in data:
            providers = data['enabled_payment_providers']
            if not isinstance(providers, list):
                return bad_request('enabled_payment_providers must be a list')
            normalized = [str(item).strip().lower() for item in providers if str(item).strip()]
            invalid = [item for item in normalized if item not in KNOWN_PAYMENT_PROVIDERS]
            if invalid:
                return bad_request(f'Unknown payment providers: {", ".join(invalid)}')
            config.set_enabled_payment_providers(normalized)
            payment_changed = True

        if 'default_payment_provider' in data:
            default_provider = str(data.get('default_payment_provider') or '').strip().lower()
            if default_provider and default_provider not in KNOWN_PAYMENT_PROVIDERS:
                return bad_request(f'Unknown default_payment_provider: {default_provider}')
            if default_provider:
                config.default_payment_provider = default_provider
                payment_changed = True

        if 'payment_provider_configs' in data:
            incoming = data['payment_provider_configs']
            if incoming is not None and not isinstance(incoming, dict):
                return bad_request('payment_provider_configs must be an object or null')
            merged_payment = _merge_provider_configs(existing_payment_configs, incoming or {}, PAYMENT_PROVIDER_SECRET_FIELDS)
            config.set_payment_provider_configs(merged_payment)
            existing_payment_configs = merged_payment
            payment_changed = True

        if payment_changed:
            config.set_payment_provider_configs(existing_payment_configs)
            xunhu_cfg = existing_payment_configs.get('xunhupay') or {}
            config.xunhupay_app_id = xunhu_cfg.get('app_id', config.xunhupay_app_id or '')
            config.xunhupay_app_secret = xunhu_cfg.get('app_secret', config.xunhupay_app_secret or '')
            if not config.default_payment_provider:
                enabled = config.get_enabled_payment_providers()
                if enabled:
                    config.default_payment_provider = enabled[0]
            enabled = config.get_enabled_payment_providers()
            if config.default_payment_provider and config.default_payment_provider not in enabled:
                enabled.insert(0, config.default_payment_provider)
                config.set_enabled_payment_providers(enabled)

        if 'storage_backend' in data:
            storage_backend = str(data.get('storage_backend') or '').strip().lower()
            if storage_backend not in KNOWN_STORAGE_BACKENDS:
                return bad_request(f'Unknown storage_backend: {storage_backend}')
            config.storage_backend = storage_backend
            storage_changed = True

        if 'storage_provider_configs' in data:
            incoming = data['storage_provider_configs']
            if incoming is not None and not isinstance(incoming, dict):
                return bad_request('storage_provider_configs must be an object or null')
            merged_storage = _merge_provider_configs(existing_storage_configs, incoming or {}, STORAGE_PROVIDER_SECRET_FIELDS)
            config.set_storage_provider_configs(merged_storage)
            storage_changed = True

        db.session.commit()
        logger.info('System config updated successfully')

        if pool_changed:
            try:
                from services.ai_service_manager import clear_ai_service_cache
                clear_ai_service_cache()
            except Exception as exc:
                logger.warning('Failed to clear AI service cache: %s', exc)

        if storage_changed:
            try:
                from services.storage import reset_storage
                reset_storage()
            except Exception as exc:
                logger.warning('Failed to reset storage cache: %s', exc)

        return success_response(config.to_dict(), '系统配置更新成功')

    except ValueError as exc:
        return bad_request(f'Invalid value: {exc}')
    except Exception as exc:
        db.session.rollback()
        logger.error('Error updating system config: %s', exc)
        return error_response('UPDATE_CONFIG_ERROR', 'Failed to update system config', 500)


@admin_config_bp.route('/public', methods=['GET'], strict_slashes=False)
def get_public_config():
    """GET /api/admin/config/public - Public system flags for UI rendering."""
    config = SystemConfig.get_instance()
    payment_runtime = get_payment_runtime_settings()
    storage_runtime = get_storage_runtime_settings()
    enabled = set(payment_runtime.get('enabled_providers', []))
    return success_response({
        'enable_credits_purchase': config.enable_credits_purchase,
        'enable_alipay': config.enable_alipay,
        'default_payment_provider': payment_runtime.get('default_provider', 'stripe'),
        'enabled_payment_providers': payment_runtime.get('enabled_providers', []),
        'payment_providers': [
            {
                **describe_payment_provider(name, payment_runtime.get('providers', {}).get(name, {})),
                'enabled': name in enabled,
            }
            for name in KNOWN_PAYMENT_PROVIDERS
        ],
        'storage_backend': storage_runtime.get('backend', 'local'),
        'storage_backends': [
            describe_storage_backend(name, storage_runtime.get('providers', {}).get(name, {}))
            for name in KNOWN_STORAGE_BACKENDS
        ],
    })


@admin_config_bp.route('/credit-costs', methods=['GET'], strict_slashes=False)
@auth_required
@admin_required
def get_credit_costs():
    """GET /api/admin/config/credit-costs - 获取积分消耗配置（简化接口）"""
    try:
        config = SystemConfig.get_instance()
        return success_response(config.get_credit_costs())
    except Exception as exc:
        logger.error('Error getting credit costs: %s', exc)
        return error_response('GET_COSTS_ERROR', f'获取积分配置失败: {exc}', 500)


@admin_config_bp.route('/user-policy', methods=['GET'], strict_slashes=False)
@auth_required
@admin_required
def get_user_policy():
    """GET /api/admin/config/user-policy - 获取用户策略配置"""
    try:
        config = SystemConfig.get_instance()

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
    except Exception as exc:
        logger.error('Error getting user policy: %s', exc)
        return error_response('GET_POLICY_ERROR', f'获取用户策略失败: {exc}', 500)


@admin_config_bp.route('/user-policy', methods=['PUT'], strict_slashes=False)
@auth_required
@admin_required
def update_user_policy():
    """PUT /api/admin/config/user-policy - 更新用户策略"""
    try:
        data = request.get_json()
        if not data:
            return bad_request('Request body is required')

        if 'editable_fields' not in data:
            return bad_request('editable_fields is required')

        fields = data['editable_fields']
        if not isinstance(fields, list):
            return bad_request('editable_fields must be a list')

        config = SystemConfig.get_instance()
        config.set_user_editable_fields(fields)
        db.session.commit()

        logger.info('User policy updated: %s', fields)
        return success_response({'editable_fields': fields}, '用户策略更新成功')

    except Exception as exc:
        db.session.rollback()
        logger.error('Error updating user policy: %s', exc)
        return error_response('UPDATE_POLICY_ERROR', f'更新用户策略失败: {exc}', 500)
