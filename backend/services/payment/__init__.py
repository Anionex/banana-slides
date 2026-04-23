"""Payment service registry with runtime-configurable providers."""
from __future__ import annotations

from importlib import import_module
from typing import Any, Dict, List, Optional

from services.provider_config import (
    describe_payment_provider,
    get_payment_runtime_settings,
    provider_supports_package,
    provider_supports_subscription,
)

from .base import CreditPackage, PaymentProvider, PaymentResult, PaymentStatus, SubscriptionPlan

# Credit packages (one-time top-ups)
CREDIT_PACKAGES = [
    CreditPackage(
        id='starter',
        name='Starter Credits',
        credits=100,
        price_cny=9.9,
        price_usd=1.99,
        description='Quick trial pack for first-time users',
    ),
    CreditPackage(
        id='basic',
        name='Basic Credits',
        credits=500,
        price_cny=39.9,
        price_usd=7.99,
        description='Good for occasional presentations',
    ),
    CreditPackage(
        id='standard',
        name='Growth Credits',
        credits=1500,
        price_cny=99.9,
        price_usd=19.99,
        bonus_credits=150,
        description='Most popular for repeat exports',
    ),
    CreditPackage(
        id='pro',
        name='Pro Credits',
        credits=5000,
        price_cny=299.9,
        price_usd=49.99,
        bonus_credits=750,
        description='Best value for power users',
    ),
    CreditPackage(
        id='enterprise',
        name='Studio Credits',
        credits=20000,
        price_cny=999.9,
        price_usd=149.99,
        bonus_credits=3500,
        description='For agencies and high-volume teams',
    ),
]

# Recurring plans
SUBSCRIPTION_PLANS = [
    SubscriptionPlan(
        id='pro_monthly',
        name='Pro',
        price_usd=19.0,
        interval='month',
        monthly_credits=3000,
        description='For solo founders shipping frequently',
        features=['3,000 monthly credits', 'Priority image queue', 'R2 asset hosting', 'Stripe self-serve billing'],
    ),
    SubscriptionPlan(
        id='team_monthly',
        name='Team',
        price_usd=49.0,
        interval='month',
        monthly_credits=12000,
        description='For lean product and marketing teams',
        features=['12,000 monthly credits', 'Everything in Pro', 'Higher concurrency', 'Shared billing portal'],
    ),
    SubscriptionPlan(
        id='enterprise_monthly',
        name='Enterprise',
        price_usd=99.0,
        interval='month',
        monthly_credits=30000,
        description='For agencies and multi-brand workloads',
        features=['30,000 monthly credits', 'Everything in Team', 'Highest usage cap', 'Premium support'],
    ),
]


def _load_provider_class(preferred: str):
    if preferred == 'stripe':
        return getattr(import_module('.stripe_provider', __name__), 'StripeProvider')
    if preferred == 'paypal':
        return getattr(import_module('.paypal_provider', __name__), 'PayPalProvider')
    if preferred == 'xunhupay':
        return getattr(import_module('.xunhupay', __name__), 'XunhuPayProvider')
    if preferred in {'lemon_squeezy', 'lemonsqueezy'}:
        return getattr(import_module('.lemon_squeezy', __name__), 'LemonSqueezyProvider')
    raise ValueError(f'Unknown payment provider: {preferred}')


def get_payment_runtime_catalog() -> Dict[str, Any]:
    return get_payment_runtime_settings()


def get_default_payment_provider_name() -> str:
    return (get_payment_runtime_catalog().get('default_provider') or 'stripe').strip().lower()


def get_enabled_payment_provider_names() -> List[str]:
    return list(get_payment_runtime_catalog().get('enabled_providers') or [])


def get_payment_provider_descriptors() -> List[Dict[str, Any]]:
    runtime = get_payment_runtime_catalog()
    providers = runtime.get('providers') or {}
    return [
        describe_payment_provider(provider_name, providers.get(provider_name) or {})
        for provider_name in runtime.get('enabled_providers') or []
    ]


def get_supported_package_provider_names(package_id: str) -> List[str]:
    runtime = get_payment_runtime_catalog()
    providers = runtime.get('providers') or {}
    supported = []
    for provider_name in runtime.get('enabled_providers') or []:
        if provider_supports_package(provider_name, providers.get(provider_name) or {}, package_id):
            supported.append(provider_name)
    return supported


def get_supported_subscription_provider_names(plan_id: str) -> List[str]:
    runtime = get_payment_runtime_catalog()
    providers = runtime.get('providers') or {}
    supported = []
    for provider_name in runtime.get('enabled_providers') or []:
        if provider_supports_subscription(provider_name, providers.get(provider_name) or {}, plan_id):
            supported.append(provider_name)
    return supported


def get_payment_provider(provider_type: Optional[str] = None) -> PaymentProvider:
    """Return a payment provider initialized from runtime settings."""
    runtime = get_payment_runtime_catalog()
    preferred = (provider_type or runtime.get('default_provider') or 'stripe').strip().lower()
    provider_configs = runtime.get('providers') or {}
    cfg = provider_configs.get(preferred) or {}

    provider_cls = _load_provider_class(preferred)
    return provider_cls(cfg)


def get_all_packages():
    """Get credit packages, preferring DB overrides over hardcoded defaults."""
    from models import SystemConfig

    try:
        config = SystemConfig.get_instance()
        db_packages = config.get_credit_packages()
        if db_packages:
            fields = {f.name for f in CreditPackage.__dataclass_fields__.values()}
            return [CreditPackage(**{k: v for k, v in p.items() if k in fields}) for p in db_packages]
    except Exception:
        pass
    return list(CREDIT_PACKAGES)


def get_credit_package(package_id: str) -> Optional[CreditPackage]:
    for package in get_all_packages():
        if package.id == package_id:
            return package
    return None


def get_all_subscription_plans():
    return list(SUBSCRIPTION_PLANS)


def get_subscription_plan(plan_id: str) -> Optional[SubscriptionPlan]:
    for plan in SUBSCRIPTION_PLANS:
        if plan.id == plan_id:
            return plan
    return None


def __getattr__(name: str):
    if name in {'StripeProvider', 'PayPalProvider', 'XunhuPayProvider', 'LemonSqueezyProvider'}:
        mapping = {
            'StripeProvider': 'stripe',
            'PayPalProvider': 'paypal',
            'XunhuPayProvider': 'xunhupay',
            'LemonSqueezyProvider': 'lemon_squeezy',
        }
        return _load_provider_class(mapping[name])
    raise AttributeError(f'module {__name__!r} has no attribute {name!r}')


__all__ = [
    'PaymentProvider',
    'PaymentResult',
    'PaymentStatus',
    'CreditPackage',
    'SubscriptionPlan',
    'StripeProvider',
    'PayPalProvider',
    'XunhuPayProvider',
    'LemonSqueezyProvider',
    'get_payment_provider',
    'get_payment_provider_descriptors',
    'get_default_payment_provider_name',
    'get_enabled_payment_provider_names',
    'get_supported_package_provider_names',
    'get_supported_subscription_provider_names',
    'get_credit_package',
    'get_all_packages',
    'get_subscription_plan',
    'get_all_subscription_plans',
    'CREDIT_PACKAGES',
    'SUBSCRIPTION_PLANS',
]
