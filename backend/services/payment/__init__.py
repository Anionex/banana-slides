"""
Payment service package
支付服务包 - 支持虎皮椒（国内）和 Lemon Squeezy（国际）
"""
import os
from typing import Optional

from .base import PaymentProvider, PaymentResult, CreditPackage, PaymentStatus
from .xunhupay import XunhuPayProvider
from .lemon_squeezy import LemonSqueezyProvider

# 可用的积分套餐
CREDIT_PACKAGES = [
    CreditPackage(
        id='starter',
        name='入门包',
        credits=100,
        price_cny=9.9,
        price_usd=1.49,
        description='适合体验用户'
    ),
    CreditPackage(
        id='basic',
        name='基础包',
        credits=500,
        price_cny=39.9,
        price_usd=5.99,
        description='适合轻度用户'
    ),
    CreditPackage(
        id='standard',
        name='标准包',
        credits=1500,
        price_cny=99.9,
        price_usd=14.99,
        bonus_credits=100,
        description='最受欢迎'
    ),
    CreditPackage(
        id='pro',
        name='专业包',
        credits=5000,
        price_cny=299.9,
        price_usd=44.99,
        bonus_credits=500,
        description='适合重度用户'
    ),
    CreditPackage(
        id='enterprise',
        name='企业包',
        credits=20000,
        price_cny=999.9,
        price_usd=149.99,
        bonus_credits=3000,
        description='适合团队使用'
    ),
]


def get_payment_provider(provider_type: Optional[str] = None) -> PaymentProvider:
    """
    Get the appropriate payment provider based on configuration.
    
    Args:
        provider_type: 'xunhupay' or 'lemon_squeezy', auto-detect if None
        
    Returns:
        PaymentProvider instance
    """
    if provider_type is None:
        # Auto-detect based on available credentials
        if os.getenv('XUNHUPAY_APP_ID') and os.getenv('XUNHUPAY_APP_SECRET'):
            provider_type = 'xunhupay'
        elif os.getenv('LEMON_SQUEEZY_API_KEY'):
            provider_type = 'lemon_squeezy'
        else:
            # Default to xunhupay for development
            provider_type = 'xunhupay'
    
    if provider_type == 'xunhupay':
        return XunhuPayProvider()
    elif provider_type == 'lemon_squeezy':
        return LemonSqueezyProvider()
    else:
        raise ValueError(f"Unknown payment provider: {provider_type}")


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
    """Get a credit package by ID."""
    for package in get_all_packages():
        if package.id == package_id:
            return package
    return None


__all__ = [
    'PaymentProvider',
    'PaymentResult',
    'PaymentStatus',
    'CreditPackage',
    'XunhuPayProvider',
    'LemonSqueezyProvider',
    'get_payment_provider',
    'get_credit_package',
    'get_all_packages',
    'CREDIT_PACKAGES',
]
