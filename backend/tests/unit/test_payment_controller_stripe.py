"""Stripe payment controller tests."""


class _FakePaymentResult:
    def __init__(self, **kwargs):
        self.success = kwargs.get('success', True)
        self.external_order_id = kwargs.get('external_order_id')
        self.payment_url = kwargs.get('payment_url')
        self.qr_code_url = kwargs.get('qr_code_url')
        self.error_message = kwargs.get('error_message')

    def to_dict(self):
        return {
            'success': self.success,
            'external_order_id': self.external_order_id,
            'payment_url': self.payment_url,
            'qr_code_url': self.qr_code_url,
            'error_message': self.error_message,
        }


class _FakeStripeProvider:
    provider_name = 'stripe'

    def create_order(self, **kwargs):
        return _FakePaymentResult(
            success=True,
            external_order_id='cs_test_credit_123',
            payment_url='https://checkout.stripe.com/pay/cs_test_credit_123',
        )

    def create_subscription_checkout(self, user, plan, success_url=None, cancel_url=None):
        return _FakePaymentResult(
            success=True,
            external_order_id='cs_test_sub_123',
            payment_url='https://checkout.stripe.com/pay/cs_test_sub_123',
        )

    def create_portal_session(self, user, return_url=None):
        return 'https://billing.stripe.com/p/session/test_123'


class TestStripePaymentController:
    def test_create_subscription_checkout_records_pending_order(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr('controllers.payment_controller.get_payment_provider', lambda *_args, **_kwargs: _FakeStripeProvider())

        response = client.post(
            '/api/payment/create-subscription',
            headers=auth_headers,
            json={'plan_id': 'pro_monthly'},
        )

        assert response.status_code == 200
        payload = response.get_json()['data']
        assert payload['success'] is True
        assert payload['provider'] == 'stripe'
        assert payload['payment_url'].startswith('https://checkout.stripe.com/pay/')
        assert payload['plan_id'] == 'pro_monthly'

        with client.application.app_context():
            from models import PaymentOrder

            order = PaymentOrder.query.get(payload['order_id'])
            assert order is not None
            assert order.payment_provider == 'stripe'
            assert order.payment_type == 'subscription'
            assert order.status == 'pending'

    def test_create_billing_portal_returns_portal_url(self, client, auth_headers, monkeypatch):
        monkeypatch.setattr('controllers.payment_controller.get_payment_provider', lambda *_args, **_kwargs: _FakeStripeProvider())

        response = client.post(
            '/api/payment/billing-portal',
            headers=auth_headers,
            json={},
        )

        assert response.status_code == 200
        payload = response.get_json()['data']
        assert payload['url'] == 'https://billing.stripe.com/p/session/test_123'
