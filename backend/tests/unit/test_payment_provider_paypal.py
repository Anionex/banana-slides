"""PayPal provider unit tests with lightweight stubs."""

from __future__ import annotations

import importlib
import sys
import types


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


def _load_provider_module(monkeypatch):
    fake_models = types.ModuleType('models')
    fake_models.db = _FakeDB()
    fake_models.User = _FakeUser
    fake_models.PaymentOrder = _FakePaymentOrder
    monkeypatch.setitem(sys.modules, 'models', fake_models)

    fake_credits = types.ModuleType('services.credits_service')

    class _CreditOperation:
        PURCHASE = 'purchase'

    class _CreditsService:
        @staticmethod
        def add_credits(**_kwargs):
            return True, None

    fake_credits.CreditOperation = _CreditOperation
    fake_credits.CreditsService = _CreditsService
    monkeypatch.setitem(sys.modules, 'services.credits_service', fake_credits)

    import services.payment.paypal_provider as provider_module

    return importlib.reload(provider_module)


class TestPayPalProvider:
    def test_create_order_returns_approval_url(self, monkeypatch):
        provider_module = _load_provider_module(monkeypatch)
        from services.payment.base import CreditPackage

        provider = provider_module.PayPalProvider({
            'client_id': 'paypal-client-id',
            'client_secret': 'paypal-client-secret',
            'mode': 'sandbox',
            'currency': 'USD',
        })

        monkeypatch.setattr(provider, '_request', lambda method, path, **kwargs: {
            'id': 'ORDER123',
            'links': [{'rel': 'approve', 'href': 'https://www.paypal.com/checkoutnow?token=ORDER123'}],
        })

        package = CreditPackage(
            id='starter',
            name='Starter Credits',
            credits=100,
            price_cny=9.9,
            price_usd=1.99,
            description='Starter',
        )
        result = provider.create_order(
            user_id='user_123',
            package=package,
            notify_url='https://api.example.com/api/payment/webhook',
            return_url='https://app.example.com/pricing?canceled=true',
            success_url='https://app.example.com/pricing?success=true',
        )

        assert result.success is True
        assert result.external_order_id == 'ORDER123'
        assert result.payment_url.startswith('https://www.paypal.com/checkoutnow')

    def test_create_subscription_checkout_requires_plan_mapping(self, monkeypatch):
        provider_module = _load_provider_module(monkeypatch)
        from services.payment.base import SubscriptionPlan

        provider = provider_module.PayPalProvider({
            'client_id': 'paypal-client-id',
            'client_secret': 'paypal-client-secret',
            'mode': 'sandbox',
            'currency': 'USD',
            'plan_ids': {},
        })

        plan = SubscriptionPlan(
            id='pro_monthly',
            name='Pro',
            price_usd=19.0,
            interval='month',
            monthly_credits=3000,
            description='Pro plan',
            features=['3000 credits'],
        )
        result = provider.create_subscription_checkout(_FakeUser(), plan)

        assert result.success is False
        assert 'plan mapping missing' in (result.error_message or '').lower()

    def test_verify_webhook_calls_paypal_signature_endpoint(self, monkeypatch):
        provider_module = _load_provider_module(monkeypatch)

        provider = provider_module.PayPalProvider({
            'client_id': 'paypal-client-id',
            'client_secret': 'paypal-client-secret',
            'webhook_id': 'wh_123',
            'mode': 'sandbox',
            'currency': 'USD',
        })

        monkeypatch.setattr(provider, '_request', lambda method, path, **kwargs: {'verification_status': 'SUCCESS'})

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
