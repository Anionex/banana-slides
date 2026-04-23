#!/usr/bin/env python3
"""Standalone smoke tests for the overseas SaaS stack additions.

These tests avoid the full Flask/SQLAlchemy app bootstrap so they can run in
minimal environments. They validate the core logic added for:
- Cloudflare R2 storage
- Alibaba Cloud OSS storage
- PayPal checkout / subscription / webhook verification helpers
"""
from __future__ import annotations

import io
import os
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'backend'
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))


# ---------------------------------------------------------------------------
# Minimal dependency stubs so the smoke tests can run without installing the
# full production dependency set in this container.
# ---------------------------------------------------------------------------
class _FakeBotoClient:
    def __init__(self):
        self.storage = {}

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None):
        if hasattr(fileobj, 'seek'):
            fileobj.seek(0)
        self.storage[(bucket, key)] = fileobj.read()

    def get_object(self, Bucket=None, Key=None):
        data = self.storage[(Bucket, Key)]
        return {'Body': io.BytesIO(data)}

    def delete_object(self, Bucket=None, Key=None):
        self.storage.pop((Bucket, Key), None)
        return None

    def delete_objects(self, Bucket=None, Delete=None):
        for item in (Delete or {}).get('Objects', []):
            self.storage.pop((Bucket, item['Key']), None)
        return None

    def get_paginator(self, *_args, **_kwargs):
        client = self

        class _Paginator:
            def paginate(self, Bucket=None, Prefix=None):
                items = []
                for (bucket, key), _content in client.storage.items():
                    if bucket == Bucket and key.startswith(Prefix or ''):
                        items.append({'Key': key})
                return [{'Contents': items}]

        return _Paginator()

    def head_object(self, Bucket=None, Key=None):
        if (Bucket, Key) not in self.storage:
            raise _FakeClientError({'Error': {'Code': '404'}}, 'HeadObject')
        return {'ContentLength': len(self.storage[(Bucket, Key)])}

    def download_fileobj(self, bucket, key, handle):
        handle.write(self.storage[(bucket, key)])

    def generate_presigned_url(self, operation_name, Params=None, ExpiresIn=None):
        return f"https://signed.example.com/{Params['Key']}?ttl={ExpiresIn}"


class _FakeClientError(Exception):
    def __init__(self, response, operation_name):
        super().__init__(f'{operation_name} failed')
        self.response = response
        self.operation_name = operation_name


_fake_boto_client = _FakeBotoClient()

boto3_mod = types.ModuleType('boto3')
boto3_mod.client = lambda *args, **kwargs: _fake_boto_client
sys.modules.setdefault('boto3', boto3_mod)

botocore_mod = types.ModuleType('botocore')
config_mod = types.ModuleType('botocore.config')
exceptions_mod = types.ModuleType('botocore.exceptions')


class _FakeConfig:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


config_mod.Config = _FakeConfig
exceptions_mod.ClientError = _FakeClientError
sys.modules.setdefault('botocore', botocore_mod)
sys.modules.setdefault('botocore.config', config_mod)
sys.modules.setdefault('botocore.exceptions', exceptions_mod)


# ---------------------------------------------------------------------------
# Storage smoke tests
# ---------------------------------------------------------------------------
def test_r2_storage():
    from services.storage.r2 import R2Storage

    storage = R2Storage(
        bucket='banana-assets',
        account_id='acc_123',
        access_key_id='key_123',
        secret_access_key='secret_123',
        public_base_url='https://cdn.example.com',
    )
    saved = storage.save_file(io.BytesIO(b'hello-r2'), 'projects/demo/image.png')
    fetched = storage.get_file('projects/demo/image.png')
    public = storage.get_public_url('projects/demo/image.png')

    assert saved == 'projects/demo/image.png'
    assert fetched == b'hello-r2'
    assert public == 'https://cdn.example.com/projects/demo/image.png'


class _FakeOSSBucket:
    def __init__(self, _auth, _endpoint, _bucket_name):
        self.storage = {}

    def put_object(self, key, payload, headers=None):
        if hasattr(payload, 'seek'):
            payload.seek(0)
        self.storage[key] = payload.read() if hasattr(payload, 'read') else payload

    def get_object(self, key):
        if key not in self.storage:
            raise FileNotFoundError(key)
        return io.BytesIO(self.storage[key])

    def delete_object(self, key):
        self.storage.pop(key, None)

    def object_exists(self, key):
        return key in self.storage

    def get_object_to_file(self, key, path):
        Path(path).write_bytes(self.storage[key])

    def sign_url(self, method, key, ttl, slash_safe=True):
        return f'https://oss-signed.example.com/{key}?ttl={ttl}'


class _FakeOSSObject:
    def __init__(self, key):
        self.key = key


class _FakeObjectIterator:
    def __init__(self, bucket, prefix=''):
        self._keys = [key for key in bucket.storage if key.startswith(prefix)]

    def __iter__(self):
        for key in self._keys:
            yield _FakeOSSObject(key)


class _FakeOSSAuth:
    def __init__(self, access_key_id, access_key_secret):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret


class _FakeOSSModule:
    Auth = _FakeOSSAuth
    Bucket = _FakeOSSBucket
    ObjectIteratorV2 = _FakeObjectIterator


def test_oss_storage():
    import services.storage.oss as oss_module

    oss_module.oss2 = _FakeOSSModule
    storage = oss_module.AliyunOSSStorage(
        bucket='banana-assets',
        endpoint='oss-cn-hangzhou.aliyuncs.com',
        access_key_id='akid',
        access_key_secret='aksecret',
        public_base_url='https://assets.example.com',
    )
    saved = storage.save_file(io.BytesIO(b'hello-oss'), 'exports/demo.pdf')
    fetched = storage.get_file('exports/demo.pdf')
    listed = storage.list_files('exports')
    public = storage.get_public_url('exports/demo.pdf')

    assert saved == 'exports/demo.pdf'
    assert fetched == b'hello-oss'
    assert listed == ['exports/demo.pdf']
    assert public == 'https://assets.example.com/exports/demo.pdf'


# ---------------------------------------------------------------------------
# PayPal smoke tests with stubbed DB / ORM dependencies
# ---------------------------------------------------------------------------
class _FakeUser:
    def __init__(self, user_id='user_123', email='founder@example.com'):
        self.id = user_id
        self.email = email
        self.username = 'founder'
        self.subscription_plan = 'free'
        self.subscription_expires_at = None
        self.billing_provider = None
        self.paypal_payer_id = None
        self.paypal_subscription_id = None


class _FakePaymentOrder:
    pass


class _FakeSession:
    def add(self, *_args, **_kwargs):
        return None

    def commit(self):
        return None

    def flush(self):
        return None


class _FakeDB:
    session = _FakeSession()


def _install_paypal_stubs():
    models_mod = types.ModuleType('models')
    models_mod.db = _FakeDB()
    models_mod.User = _FakeUser
    models_mod.PaymentOrder = _FakePaymentOrder
    sys.modules['models'] = models_mod

    credits_mod = types.ModuleType('services.credits_service')

    class _CreditOperation:
        PURCHASE = 'purchase'

    class _CreditsService:
        @staticmethod
        def add_credits(**_kwargs):
            return True, None

    credits_mod.CreditsService = _CreditsService
    credits_mod.CreditOperation = _CreditOperation
    sys.modules['services.credits_service'] = credits_mod


def test_paypal_provider_checkout_and_verification():
    _install_paypal_stubs()
    from services.payment.base import CreditPackage, SubscriptionPlan
    from services.payment.paypal_provider import PayPalProvider

    provider = PayPalProvider({
        'client_id': 'paypal-client-id',
        'client_secret': 'paypal-client-secret',
        'webhook_id': 'wh_123',
        'mode': 'sandbox',
        'brand_name': 'Banana Slides',
        'currency': 'USD',
        'plan_ids': {'pro_monthly': 'P-PLAN123'},
    })

    def fake_request(method, path, **kwargs):
        if path == '/v2/checkout/orders':
            return {
                'id': 'ORDER123',
                'links': [{'rel': 'approve', 'href': 'https://www.paypal.com/checkoutnow?token=ORDER123'}],
            }
        if path == '/v1/billing/subscriptions':
            return {
                'id': 'I-SUB123',
                'links': [{'rel': 'approve', 'href': 'https://www.paypal.com/webapps/billing/subscriptions?ba_token=I-SUB123'}],
            }
        if path == '/v1/notifications/verify-webhook-signature':
            return {'verification_status': 'SUCCESS'}
        raise AssertionError(f'unexpected PayPal path: {path}')

    provider._request = fake_request  # type: ignore[assignment]

    package = CreditPackage(
        id='starter',
        name='Starter Credits',
        credits=100,
        price_cny=9.9,
        price_usd=1.99,
        description='Starter',
    )
    order = provider.create_order(
        user_id='user_123',
        package=package,
        notify_url='https://api.example.com/api/payment/webhook',
        return_url='https://app.example.com/pricing?canceled=true',
        success_url='https://app.example.com/pricing?success=true',
    )
    assert order.success is True
    assert order.external_order_id == 'ORDER123'
    assert order.payment_url.startswith('https://www.paypal.com/checkoutnow')

    plan = SubscriptionPlan(
        id='pro_monthly',
        name='Pro',
        price_usd=19.0,
        interval='month',
        monthly_credits=3000,
        description='Pro plan',
        features=['3000 credits'],
    )
    subscription = provider.create_subscription_checkout(
        user=_FakeUser(),
        plan=plan,
        notify_url='https://api.example.com/api/payment/webhook',
        success_url='https://app.example.com/pricing?subscription=success',
        cancel_url='https://app.example.com/pricing?subscription=canceled',
    )
    assert subscription.success is True
    assert subscription.external_order_id == 'I-SUB123'
    assert subscription.payment_url.startswith('https://www.paypal.com/webapps/billing/subscriptions')

    verified = provider.verify_webhook(
        {'event_type': 'PAYMENT.CAPTURE.COMPLETED', 'resource': {'id': 'CAPTURE123'}},
        headers={
            'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
            'PAYPAL-CERT-URL': 'https://api-m.paypal.com/certs/test.pem',
            'PAYPAL-TRANSMISSION-ID': 'abc123',
            'PAYPAL-TRANSMISSION-SIG': 'signature',
            'PAYPAL-TRANSMISSION-TIME': '2026-04-22T00:00:00Z',
        },
    )
    assert verified is True


if __name__ == '__main__':
    tests = [
        ('R2 storage', test_r2_storage),
        ('Alibaba OSS storage', test_oss_storage),
        ('PayPal provider', test_paypal_provider_checkout_and_verification),
    ]
    for name, test in tests:
        test()
        print(f'[PASS] {name}')
    print('\nAll standalone smoke tests passed.')
