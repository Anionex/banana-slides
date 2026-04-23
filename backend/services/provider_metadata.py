"""Shared provider metadata for payment and storage backends."""
from __future__ import annotations

PAYMENT_PROVIDER_SECRET_FIELDS = {
    'stripe': ['secret_key', 'webhook_secret'],
    'paypal': ['client_id', 'client_secret', 'webhook_id'],
    'xunhupay': ['app_id', 'app_secret'],
    'lemon_squeezy': ['api_key', 'webhook_secret'],
}

STORAGE_PROVIDER_SECRET_FIELDS = {
    'r2': ['access_key_id', 'secret_access_key'],
    'oss': ['access_key_id', 'access_key_secret'],
}

PAYMENT_PROVIDER_LABELS = {
    'stripe': 'Stripe',
    'paypal': 'PayPal',
    'xunhupay': 'XunhuPay',
    'lemon_squeezy': 'Lemon Squeezy',
}

STORAGE_PROVIDER_LABELS = {
    'local': 'Local Storage',
    'r2': 'Cloudflare R2',
    'oss': 'Alibaba Cloud OSS',
}

PAYMENT_PROVIDER_CAPABILITIES = {
    'stripe': {
        'supports_one_time': True,
        'supports_subscription': True,
        'supports_billing_portal': True,
        'payment_methods': ['card'],
        'currencies': ['USD'],
    },
    'paypal': {
        'supports_one_time': True,
        'supports_subscription': True,
        'supports_billing_portal': False,
        'payment_methods': ['paypal'],
        'currencies': ['USD'],
    },
    'xunhupay': {
        'supports_one_time': True,
        'supports_subscription': False,
        'supports_billing_portal': False,
        'payment_methods': ['wechat', 'alipay'],
        'currencies': ['CNY'],
    },
    'lemon_squeezy': {
        'supports_one_time': True,
        'supports_subscription': False,
        'supports_billing_portal': False,
        'payment_methods': ['card'],
        'currencies': ['USD'],
    },
}
