"""Runtime provider configuration helpers.

This module merges environment defaults with admin-managed SystemConfig overrides so
payment/storage providers can be switched at runtime without redeploying.
"""
from __future__ import annotations

import copy
import os
from typing import Any, Dict, List, Optional

from services.provider_metadata import (
    PAYMENT_PROVIDER_CAPABILITIES,
    PAYMENT_PROVIDER_LABELS,
    STORAGE_PROVIDER_LABELS,
)


DEFAULT_PAYMENT_PROVIDERS = ['stripe', 'paypal', 'xunhupay', 'lemon_squeezy', 'wechatpay']
DEFAULT_STORAGE_PROVIDERS = ['local', 'r2', 'oss']


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or str(value).strip() == '':
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _env_str(name: str, default: str = '') -> str:
    value = os.getenv(name)
    if value is None:
        return default
    return str(value).strip()


def _parse_csv_env(name: str) -> List[str]:
    value = _env_str(name)
    if not value:
        return []
    return [item.strip().lower() for item in value.split(',') if item.strip()]


def _deep_merge(base: Any, override: Any) -> Any:
    if isinstance(base, dict) and isinstance(override, dict):
        merged = {k: copy.deepcopy(v) for k, v in base.items()}
        for key, value in override.items():
            if key in merged:
                merged[key] = _deep_merge(merged[key], value)
            else:
                merged[key] = copy.deepcopy(value)
        return merged
    if override is None:
        return copy.deepcopy(base)
    return copy.deepcopy(override)


def _load_system_config():
    try:
        from models import SystemConfig
        return SystemConfig.get_instance()
    except Exception:
        return None


def load_env_payment_provider_configs() -> Dict[str, Dict[str, Any]]:
    return {
        'stripe': {
            'secret_key': _env_str('STRIPE_SECRET_KEY'),
            'webhook_secret': _env_str('STRIPE_WEBHOOK_SECRET'),
            'portal_configuration_id': _env_str('STRIPE_PORTAL_CONFIGURATION_ID'),
            'portal_return_url': _env_str('STRIPE_PORTAL_RETURN_URL', _env_str('FRONTEND_URL', 'http://localhost:5173').rstrip('/') + '/settings'),
            'price_ids': {
                'starter': _env_str('STRIPE_PRICE_STARTER'),
                'basic': _env_str('STRIPE_PRICE_BASIC'),
                'standard': _env_str('STRIPE_PRICE_STANDARD'),
                'pro': _env_str('STRIPE_PRICE_PRO'),
                'enterprise': _env_str('STRIPE_PRICE_ENTERPRISE'),
            },
            'subscription_price_ids': {
                'pro_monthly': _env_str('STRIPE_SUB_PRICE_PRO_MONTHLY'),
                'team_monthly': _env_str('STRIPE_SUB_PRICE_TEAM_MONTHLY'),
                'enterprise_monthly': _env_str('STRIPE_SUB_PRICE_ENTERPRISE_MONTHLY'),
            },
        },
        'paypal': {
            'client_id': _env_str('PAYPAL_CLIENT_ID'),
            'client_secret': _env_str('PAYPAL_CLIENT_SECRET'),
            'webhook_id': _env_str('PAYPAL_WEBHOOK_ID'),
            'mode': _env_str('PAYPAL_MODE', 'sandbox') or 'sandbox',
            'brand_name': _env_str('PAYPAL_BRAND_NAME', 'Banana Slides') or 'Banana Slides',
            'currency': _env_str('PAYPAL_CURRENCY', 'USD') or 'USD',
            'plan_ids': {
                'pro_monthly': _env_str('PAYPAL_PLAN_PRO_MONTHLY'),
                'team_monthly': _env_str('PAYPAL_PLAN_TEAM_MONTHLY'),
                'enterprise_monthly': _env_str('PAYPAL_PLAN_ENTERPRISE_MONTHLY'),
            },
        },
        'xunhupay': {
            'app_id': _env_str('XUNHUPAY_APP_ID'),
            'app_secret': _env_str('XUNHUPAY_APP_SECRET'),
        },
        'lemon_squeezy': {
            'api_key': _env_str('LEMON_SQUEEZY_API_KEY'),
            'store_id': _env_str('LEMON_SQUEEZY_STORE_ID'),
            'webhook_secret': _env_str('LEMON_SQUEEZY_WEBHOOK_SECRET'),
            'variant_ids': {
                'starter': _env_str('LS_VARIANT_STARTER'),
                'basic': _env_str('LS_VARIANT_BASIC'),
                'standard': _env_str('LS_VARIANT_STANDARD'),
                'pro': _env_str('LS_VARIANT_PRO'),
                'enterprise': _env_str('LS_VARIANT_ENTERPRISE'),
            },
        },
        'wechatpay': {
            'mch_id': _env_str('WECHATPAY_MCH_ID'),
            'app_id': _env_str('WECHATPAY_APP_ID'),
            'api_v3_key': _env_str('WECHATPAY_API_V3_KEY'),
            'private_key': _env_str('WECHATPAY_PRIVATE_KEY'),
            'cert_serial_no': _env_str('WECHATPAY_CERT_SERIAL_NO'),
            'wxpay_public_key_id': _env_str('WECHATPAY_WXPAY_PUBLIC_KEY_ID'),
            'wxpay_public_key': _env_str('WECHATPAY_WXPAY_PUBLIC_KEY'),
        },
    }


def load_env_storage_provider_configs() -> Dict[str, Dict[str, Any]]:
    return {
        'local': {
            'upload_folder': _env_str('UPLOAD_FOLDER', 'uploads'),
        },
        'r2': {
            'account_id': _env_str('R2_ACCOUNT_ID'),
            'bucket': _env_str('R2_BUCKET'),
            'access_key_id': _env_str('R2_ACCESS_KEY_ID'),
            'secret_access_key': _env_str('R2_SECRET_ACCESS_KEY'),
            'public_base_url': _env_str('R2_PUBLIC_BASE_URL'),
            'region': _env_str('R2_REGION', 'auto') or 'auto',
            'endpoint_url': _env_str('R2_ENDPOINT_URL'),
            'signed_url_ttl': _env_int('R2_SIGNED_URL_TTL', 3600),
        },
        'oss': {
            'bucket': _env_str('ALIYUN_OSS_BUCKET'),
            'endpoint': _env_str('ALIYUN_OSS_ENDPOINT'),
            'access_key_id': _env_str('ALIYUN_OSS_ACCESS_KEY_ID'),
            'access_key_secret': _env_str('ALIYUN_OSS_ACCESS_KEY_SECRET'),
            'public_base_url': _env_str('ALIYUN_OSS_PUBLIC_BASE_URL'),
            'signed_url_ttl': _env_int('ALIYUN_OSS_SIGNED_URL_TTL', 3600),
        },
    }


def _default_payment_provider_from_env() -> str:
    explicit = _env_str('BILLING_PROVIDER').lower()
    if explicit:
        return explicit
    env_configs = load_env_payment_provider_configs()
    if env_configs['stripe'].get('secret_key'):
        return 'stripe'
    if env_configs['paypal'].get('client_id') and env_configs['paypal'].get('client_secret'):
        return 'paypal'
    if env_configs['lemon_squeezy'].get('api_key') and env_configs['lemon_squeezy'].get('store_id'):
        return 'lemon_squeezy'
    if env_configs['xunhupay'].get('app_id') and env_configs['xunhupay'].get('app_secret'):
        return 'xunhupay'
    if env_configs['wechatpay'].get('mch_id') and env_configs['wechatpay'].get('private_key'):
        return 'wechatpay'
    return 'stripe'


def _enabled_payment_providers_from_env(default_provider: str) -> List[str]:
    explicit = _parse_csv_env('ENABLED_PAYMENT_PROVIDERS')
    if explicit:
        providers = explicit
    else:
        providers = [default_provider]
    if default_provider and default_provider not in providers:
        providers.insert(0, default_provider)
    return [provider for provider in providers if provider in DEFAULT_PAYMENT_PROVIDERS]


def get_payment_runtime_settings() -> Dict[str, Any]:
    env_configs = load_env_payment_provider_configs()
    default_provider = _default_payment_provider_from_env()
    enabled_providers = _enabled_payment_providers_from_env(default_provider)
    provider_configs = env_configs

    system_config = _load_system_config()
    if system_config:
        provider_configs = _deep_merge(env_configs, system_config.get_payment_provider_configs(raw=True) or {})
        cfg_default = (system_config.default_payment_provider or '').strip().lower()
        if cfg_default:
            default_provider = cfg_default
        cfg_enabled = system_config.get_enabled_payment_providers()
        if cfg_enabled:
            enabled_providers = [provider.strip().lower() for provider in cfg_enabled if provider]

    enabled_providers = [provider for provider in enabled_providers if provider in DEFAULT_PAYMENT_PROVIDERS]
    if default_provider and default_provider not in enabled_providers:
        enabled_providers.insert(0, default_provider)
    if not enabled_providers:
        enabled_providers = [default_provider or 'stripe']

    return {
        'default_provider': default_provider or 'stripe',
        'enabled_providers': enabled_providers,
        'providers': provider_configs,
    }


def get_storage_runtime_settings() -> Dict[str, Any]:
    env_configs = load_env_storage_provider_configs()
    backend = _env_str('STORAGE_BACKEND', 'local').lower() or 'local'
    provider_configs = env_configs

    system_config = _load_system_config()
    if system_config:
        provider_configs = _deep_merge(env_configs, system_config.get_storage_provider_configs(raw=True) or {})
        cfg_backend = (system_config.storage_backend or '').strip().lower()
        if cfg_backend:
            backend = cfg_backend

    if backend not in DEFAULT_STORAGE_PROVIDERS:
        backend = 'local'

    return {
        'backend': backend,
        'providers': provider_configs,
    }


def payment_provider_has_core_credentials(provider_name: str, provider_cfg: Optional[Dict[str, Any]]) -> bool:
    cfg = provider_cfg or {}
    if provider_name == 'stripe':
        return bool(cfg.get('secret_key'))
    if provider_name == 'paypal':
        return bool(cfg.get('client_id') and cfg.get('client_secret'))
    if provider_name == 'xunhupay':
        return bool(cfg.get('app_id') and cfg.get('app_secret'))
    if provider_name == 'lemon_squeezy':
        return bool(cfg.get('api_key') and cfg.get('store_id'))
    if provider_name == 'wechatpay':
        return bool(cfg.get('mch_id') and cfg.get('private_key') and cfg.get('api_v3_key'))
    return False


def provider_supports_package(provider_name: str, provider_cfg: Optional[Dict[str, Any]], package_id: Optional[str] = None) -> bool:
    cfg = provider_cfg or {}
    if not payment_provider_has_core_credentials(provider_name, cfg):
        return False
    if provider_name == 'lemon_squeezy' and package_id:
        return bool((cfg.get('variant_ids') or {}).get(package_id))
    return PAYMENT_PROVIDER_CAPABILITIES.get(provider_name, {}).get('supports_one_time', False)


def provider_supports_subscription(provider_name: str, provider_cfg: Optional[Dict[str, Any]], plan_id: Optional[str] = None) -> bool:
    cfg = provider_cfg or {}
    if not payment_provider_has_core_credentials(provider_name, cfg):
        return False
    if provider_name == 'stripe':
        return True
    if provider_name == 'paypal':
        plan_ids = cfg.get('plan_ids') or {}
        if plan_id:
            return bool(plan_ids.get(plan_id))
        return any(bool(value) for value in plan_ids.values())
    return PAYMENT_PROVIDER_CAPABILITIES.get(provider_name, {}).get('supports_subscription', False)


def storage_backend_has_core_credentials(backend_name: str, backend_cfg: Optional[Dict[str, Any]]) -> bool:
    cfg = backend_cfg or {}
    if backend_name == 'local':
        return True
    if backend_name == 'r2':
        return bool(cfg.get('bucket') and (cfg.get('account_id') or cfg.get('endpoint_url')) and cfg.get('access_key_id') and cfg.get('secret_access_key'))
    if backend_name == 'oss':
        return bool(cfg.get('bucket') and cfg.get('endpoint') and cfg.get('access_key_id') and cfg.get('access_key_secret'))
    return False


def describe_payment_provider(provider_name: str, provider_cfg: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    cfg = provider_cfg or {}
    capabilities = PAYMENT_PROVIDER_CAPABILITIES.get(provider_name, {})
    return {
        'name': provider_name,
        'label': PAYMENT_PROVIDER_LABELS.get(provider_name, provider_name),
        'configured': payment_provider_has_core_credentials(provider_name, cfg),
        'supports_one_time': provider_supports_package(provider_name, cfg),
        'supports_subscription': provider_supports_subscription(provider_name, cfg),
        'supports_billing_portal': capabilities.get('supports_billing_portal', False) and payment_provider_has_core_credentials(provider_name, cfg),
        'payment_methods': list(capabilities.get('payment_methods', [])),
        'currencies': list(capabilities.get('currencies', [])),
        'mode': cfg.get('mode'),
    }


def describe_storage_backend(backend_name: str, backend_cfg: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    cfg = backend_cfg or {}
    return {
        'name': backend_name,
        'label': STORAGE_PROVIDER_LABELS.get(backend_name, backend_name),
        'configured': storage_backend_has_core_credentials(backend_name, cfg),
    }
