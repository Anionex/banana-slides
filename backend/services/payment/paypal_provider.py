"""PayPal payment provider for one-time credits and subscriptions."""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from urllib.parse import quote, urlencode, urlparse, parse_qsl, urlunparse

import requests
from requests.auth import HTTPBasicAuth

from models import db, PaymentOrder, User
from services.credits_service import CreditsService, CreditOperation

from .base import CreditPackage, PaymentProvider, PaymentResult, PaymentStatus, SubscriptionPlan

logger = logging.getLogger(__name__)


class PayPalProvider(PaymentProvider):
    """PayPal REST API provider."""

    SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com'
    LIVE_API_BASE = 'https://api-m.paypal.com'

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.client_id = cfg.get('client_id', '')
        self.client_secret = cfg.get('client_secret', '')
        self.webhook_id = cfg.get('webhook_id', '')
        self.mode = (cfg.get('mode') or 'sandbox').strip().lower() or 'sandbox'
        self.brand_name = (cfg.get('brand_name') or 'Banana Slides').strip() or 'Banana Slides'
        self.currency = (cfg.get('currency') or 'USD').strip().upper() or 'USD'
        self.plan_ids = dict(cfg.get('plan_ids') or {})
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        self._access_token: Optional[str] = None

    @property
    def provider_name(self) -> str:
        return 'paypal'

    @property
    def api_base(self) -> str:
        return self.LIVE_API_BASE if self.mode == 'live' else self.SANDBOX_API_BASE

    def _require_credentials(self):
        if not self.client_id or not self.client_secret:
            raise ValueError('PayPal client credentials are not configured')

    def _request_access_token(self) -> str:
        self._require_credentials()
        response = requests.post(
            f'{self.api_base}/v1/oauth2/token',
            auth=HTTPBasicAuth(self.client_id, self.client_secret),
            data={'grant_type': 'client_credentials'},
            headers={'Accept': 'application/json', 'Accept-Language': 'en_US'},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get('access_token')
        if not token:
            raise ValueError('PayPal access_token missing from OAuth response')
        self._access_token = token
        return token

    def _request(
        self,
        method: str,
        path: str,
        *,
        expected_status: Optional[set[int]] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        token = self._access_token or self._request_access_token()
        request_headers = {
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        if headers:
            request_headers.update(headers)

        response = requests.request(
            method=method.upper(),
            url=f'{self.api_base}{path}',
            headers=request_headers,
            timeout=30,
            **kwargs,
        )

        if response.status_code == 401:
            token = self._request_access_token()
            request_headers['Authorization'] = f'Bearer {token}'
            response = requests.request(
                method=method.upper(),
                url=f'{self.api_base}{path}',
                headers=request_headers,
                timeout=30,
                **kwargs,
            )

        if expected_status is None:
            expected_status = {200}
        if response.status_code not in expected_status:
            try:
                body = response.json()
            except Exception:
                body = {'message': response.text}
            message = body.get('message') or body.get('error_description') or response.text
            raise ValueError(f'PayPal API error ({response.status_code}): {message}')

        if not response.content:
            return {}
        return response.json()

    @staticmethod
    def _format_amount(value: float) -> str:
        return f'{float(value):.2f}'

    @staticmethod
    def _append_query_params(url: str, **params: Any) -> str:
        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        for key, value in params.items():
            if value is None:
                continue
            query[key] = str(value)
        return urlunparse(parsed._replace(query=urlencode(query)))

    @staticmethod
    def _extract_link(payload: Dict[str, Any], rel: str) -> Optional[str]:
        for link in payload.get('links', []) or []:
            if link.get('rel') == rel:
                return link.get('href')
        return None

    @staticmethod
    def _build_custom_id(kind: str, user_id: str, target_id: str) -> str:
        return f'{kind}|{user_id}|{target_id}'

    @staticmethod
    def _parse_custom_id(custom_id: Optional[str]) -> Dict[str, str]:
        if not custom_id:
            return {}
        if custom_id.startswith('{'):
            try:
                raw = json.loads(custom_id)
                if isinstance(raw, dict):
                    return {str(k): str(v) for k, v in raw.items()}
            except Exception:
                return {}
        parts = custom_id.split('|')
        if len(parts) >= 3:
            return {
                'kind': parts[0],
                'user_id': parts[1],
                'target_id': parts[2],
            }
        return {}

    @staticmethod
    def _plan_slug(plan_id: str) -> str:
        return plan_id.replace('_monthly', '') if plan_id else 'free'

    @staticmethod
    def _parse_datetime(value: Optional[str]):
        if not value:
            return None
        normalized = str(value).replace('Z', '+00:00')
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None

    def _find_plan_by_external_plan_id(self, external_plan_id: Optional[str]):
        if not external_plan_id:
            return None
        from . import get_all_subscription_plans

        reverse = {value: key for key, value in self.plan_ids.items() if value}
        plan_id = reverse.get(external_plan_id)
        if not plan_id:
            return None
        for plan in get_all_subscription_plans():
            if plan.id == plan_id:
                return plan
        return None

    def _find_user(
        self,
        *,
        user_id: Optional[str] = None,
        payer_id: Optional[str] = None,
        subscription_id: Optional[str] = None,
        email: Optional[str] = None,
    ) -> Optional[User]:
        if user_id:
            user = User.query.get(user_id)
            if user:
                return user
        if subscription_id:
            user = User.query.filter_by(paypal_subscription_id=subscription_id).first()
            if user:
                return user
        if payer_id:
            user = User.query.filter_by(paypal_payer_id=payer_id).first()
            if user:
                return user
        if email:
            return User.query.filter_by(email=email).first()
        return None

    def _mark_order_paid(self, order: PaymentOrder, external_order_id: str, amount: float, currency: str):
        order.status = 'paid'
        order.external_order_id = external_order_id
        order.amount = amount
        order.currency = (currency or order.currency or self.currency).upper()
        order.paid_at = datetime.now(timezone.utc)
        db.session.add(order)

    def _apply_subscription_state(
        self,
        user: User,
        plan_id: str,
        subscription_id: Optional[str],
        next_billing_time: Optional[str],
        *,
        active: bool = True,
        payer_id: Optional[str] = None,
    ):
        user.billing_provider = self.provider_name
        if payer_id:
            user.paypal_payer_id = payer_id
        if subscription_id:
            user.paypal_subscription_id = subscription_id
        if active:
            user.subscription_plan = self._plan_slug(plan_id)
            user.subscription_expires_at = self._parse_datetime(next_billing_time)
        else:
            user.subscription_plan = 'free'
            user.subscription_expires_at = None
        db.session.add(user)

    @staticmethod
    def _notify_root(notify_url: str) -> str:
        marker = '/api/payment/webhook'
        if marker in notify_url:
            return notify_url.split(marker, 1)[0]
        return notify_url.rstrip('/')

    def _build_paypal_return_url(self, notify_url: str, success_url: Optional[str]) -> str:
        base = self._notify_root(notify_url)
        target = success_url or f'{self.frontend_url}/pricing?success=true&provider=paypal'
        return f"{base}/api/payment/paypal/return?success_url={quote(target, safe='')}"

    def _build_paypal_cancel_url(self, notify_url: str, cancel_url: Optional[str]) -> str:
        base = self._notify_root(notify_url)
        target = cancel_url or f'{self.frontend_url}/pricing?canceled=true&provider=paypal'
        return f"{base}/api/payment/paypal/cancel?cancel_url={quote(target, safe='')}"

    def _build_paypal_subscription_return_url(self, notify_url: str, success_url: Optional[str]) -> str:
        base = self._notify_root(notify_url)
        target = success_url or f'{self.frontend_url}/pricing?subscription=success&provider=paypal'
        return f"{base}/api/payment/paypal/subscription/return?success_url={quote(target, safe='')}"

    def _build_paypal_subscription_cancel_url(self, notify_url: str, cancel_url: Optional[str]) -> str:
        base = self._notify_root(notify_url)
        target = cancel_url or f'{self.frontend_url}/pricing?subscription=canceled&provider=paypal'
        return f"{base}/api/payment/paypal/cancel?cancel_url={quote(target, safe='')}"

    def create_order(
        self,
        user_id: str,
        package: CreditPackage,
        notify_url: str,
        return_url: str,
        client_ip: Optional[str] = None,
        payment_type: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> PaymentResult:
        try:
            self._require_credentials()
            payload = {
                'intent': 'CAPTURE',
                'purchase_units': [
                    {
                        'reference_id': package.id,
                        'custom_id': self._build_custom_id('credits', user_id, package.id),
                        'description': package.description or package.name,
                        'invoice_id': f'banana-{uuid.uuid4().hex[:26]}',
                        'amount': {
                            'currency_code': self.currency,
                            'value': self._format_amount(package.price_usd),
                        },
                    }
                ],
                'application_context': {
                    'brand_name': self.brand_name,
                    'user_action': 'PAY_NOW',
                    'shipping_preference': 'NO_SHIPPING',
                    'return_url': self._build_paypal_return_url(notify_url, success_url),
                    'cancel_url': self._build_paypal_cancel_url(notify_url, cancel_url or return_url),
                },
            }
            response = self._request('POST', '/v2/checkout/orders', expected_status={201}, json=payload)
            approval_url = self._extract_link(response, 'approve')
            return PaymentResult(
                success=bool(response.get('id') and approval_url),
                external_order_id=response.get('id'),
                payment_url=approval_url,
                raw_response=response,
                error_message=None if approval_url else 'PayPal approval link missing',
            )
        except Exception as exc:
            logger.error('PayPal create order failed: %s', exc, exc_info=True)
            return PaymentResult(success=False, error_message=str(exc))

    def create_subscription_checkout(
        self,
        user: User,
        plan: SubscriptionPlan,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        notify_url: Optional[str] = None,
    ) -> PaymentResult:
        external_plan_id = (self.plan_ids or {}).get(plan.id)
        if not external_plan_id:
            return PaymentResult(success=False, error_message=f'PayPal plan mapping missing for {plan.id}')

        try:
            self._require_credentials()
            if not notify_url:
                notify_url = f'{self.frontend_url}/api/payment/webhook'
            payload = {
                'plan_id': external_plan_id,
                'custom_id': self._build_custom_id('subscription', user.id, plan.id),
                'application_context': {
                    'brand_name': self.brand_name,
                    'user_action': 'SUBSCRIBE_NOW',
                    'shipping_preference': 'NO_SHIPPING',
                    'return_url': self._build_paypal_subscription_return_url(notify_url, success_url),
                    'cancel_url': self._build_paypal_subscription_cancel_url(notify_url, cancel_url),
                },
                'subscriber': {
                    'email_address': user.email,
                },
            }
            response = self._request('POST', '/v1/billing/subscriptions', expected_status={201}, json=payload)
            approval_url = self._extract_link(response, 'approve')
            return PaymentResult(
                success=bool(response.get('id') and approval_url),
                external_order_id=response.get('id'),
                payment_url=approval_url,
                raw_response=response,
                error_message=None if approval_url else 'PayPal subscription approval link missing',
            )
        except Exception as exc:
            logger.error('PayPal create subscription failed: %s', exc, exc_info=True)
            return PaymentResult(success=False, error_message=str(exc))

    def verify_webhook(
        self,
        payload: Dict[str, Any],
        signature: Optional[str] = None,
        headers: Optional[Dict[str, Any]] = None,
    ) -> bool:
        headers = headers or {}
        if not self.webhook_id:
            logger.warning('PayPal webhook verification skipped because webhook_id is not configured')
            return False
        required_headers = {
            'PAYPAL-AUTH-ALGO': headers.get('PAYPAL-AUTH-ALGO') or headers.get('Paypal-Auth-Algo'),
            'PAYPAL-CERT-URL': headers.get('PAYPAL-CERT-URL') or headers.get('Paypal-Cert-Url'),
            'PAYPAL-TRANSMISSION-ID': headers.get('PAYPAL-TRANSMISSION-ID') or headers.get('Paypal-Transmission-Id'),
            'PAYPAL-TRANSMISSION-SIG': headers.get('PAYPAL-TRANSMISSION-SIG') or headers.get('Paypal-Transmission-Sig'),
            'PAYPAL-TRANSMISSION-TIME': headers.get('PAYPAL-TRANSMISSION-TIME') or headers.get('Paypal-Transmission-Time'),
        }
        if not all(required_headers.values()):
            return False
        verification_payload = {
            'auth_algo': required_headers['PAYPAL-AUTH-ALGO'],
            'cert_url': required_headers['PAYPAL-CERT-URL'],
            'transmission_id': required_headers['PAYPAL-TRANSMISSION-ID'],
            'transmission_sig': required_headers['PAYPAL-TRANSMISSION-SIG'],
            'transmission_time': required_headers['PAYPAL-TRANSMISSION-TIME'],
            'webhook_id': self.webhook_id,
            'webhook_event': payload,
        }
        try:
            result = self._request(
                'POST',
                '/v1/notifications/verify-webhook-signature',
                expected_status={200},
                json=verification_payload,
            )
            return (result.get('verification_status') or '').upper() == 'SUCCESS'
        except Exception as exc:
            logger.error('PayPal webhook verification failed: %s', exc)
            return False

    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        event_type = payload.get('event_type', '')
        resource = payload.get('resource') or {}
        parsed_custom = self._parse_custom_id(resource.get('custom_id'))
        related = ((resource.get('supplementary_data') or {}).get('related_ids') or {})
        amount_info = resource.get('amount') or resource.get('seller_receivable_breakdown', {}).get('gross_amount') or {}
        order_ref = related.get('order_id') or resource.get('id')
        status = PaymentStatus.PENDING
        if event_type in {'PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.SALE.COMPLETED'}:
            status = PaymentStatus.PAID
        elif event_type in {'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED'}:
            status = PaymentStatus.CANCELLED
        return {
            'order_id': order_ref,
            'external_order_id': order_ref,
            'status': status,
            'amount': float(amount_info.get('value', 0) or 0),
            'currency': amount_info.get('currency_code', self.currency),
            'user_id': parsed_custom.get('user_id'),
            'package_id': parsed_custom.get('target_id') if parsed_custom.get('kind') == 'credits' else None,
            'plan_id': parsed_custom.get('target_id') if parsed_custom.get('kind') == 'subscription' else None,
            'raw': payload,
        }

    def get_order_details(self, order_id: str) -> Dict[str, Any]:
        return self._request('GET', f'/v2/checkout/orders/{order_id}', expected_status={200})

    def get_subscription_details(self, subscription_id: str) -> Dict[str, Any]:
        return self._request('GET', f'/v1/billing/subscriptions/{subscription_id}', expected_status={200})

    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        try:
            if order_id.startswith('I-'):
                subscription = self.get_subscription_details(order_id)
                return {
                    'order_id': subscription.get('id'),
                    'external_order_id': subscription.get('id'),
                    'status': PaymentStatus.PAID if subscription.get('status') == 'ACTIVE' else PaymentStatus.PENDING,
                    'amount': 0,
                    'currency': self.currency,
                    'raw': subscription,
                }
            order = self.get_order_details(order_id)
            captures = (((order.get('purchase_units') or [{}])[0].get('payments') or {}).get('captures') or [])
            first_capture = captures[0] if captures else {}
            amount_info = first_capture.get('amount') or ((order.get('purchase_units') or [{}])[0].get('amount') or {})
            return {
                'order_id': order.get('id'),
                'external_order_id': order.get('id'),
                'status': PaymentStatus.PAID if order.get('status') == 'COMPLETED' else PaymentStatus.PENDING,
                'amount': float(amount_info.get('value', 0) or 0),
                'currency': amount_info.get('currency_code', self.currency),
                'raw': order,
            }
        except Exception as exc:
            logger.error('PayPal query order failed: %s', exc)
            return None

    def _ensure_credit_order(self, order_id: str, capture_payload: Dict[str, Any]) -> PaymentOrder:
        purchase_units = capture_payload.get('purchase_units') or []
        purchase_unit = purchase_units[0] if purchase_units else {}
        parsed_custom = self._parse_custom_id(purchase_unit.get('custom_id'))
        payer = capture_payload.get('payer') or {}
        payer_id = payer.get('payer_id')
        email = payer.get('email_address')
        package_id = parsed_custom.get('target_id')
        user_id = parsed_custom.get('user_id')

        existing = PaymentOrder.query.filter_by(external_order_id=order_id).first()
        if existing:
            return existing

        from . import get_credit_package

        package = get_credit_package(package_id) if package_id else None
        user = self._find_user(user_id=user_id, payer_id=payer_id, email=email)
        if not user or not package:
            raise ValueError('Unable to match PayPal order to a user/package')

        order = PaymentOrder(
            id=str(uuid.uuid4()),
            user_id=user.id,
            package_id=package.id,
            package_name=package.name,
            credits=package.credits,
            bonus_credits=package.bonus_credits,
            total_credits=package.total_credits,
            amount=package.price_usd,
            currency=self.currency,
            payment_provider=self.provider_name,
            payment_type='paypal',
            external_order_id=order_id,
            status='pending',
        )
        db.session.add(order)
        db.session.flush()
        return order

    def _handle_captured_checkout_order(self, capture_payload: Dict[str, Any]) -> Dict[str, Any]:
        order_id = capture_payload.get('id')
        if not order_id:
            raise ValueError('PayPal capture payload missing order id')

        order = self._ensure_credit_order(order_id, capture_payload)
        if order.status == 'paid':
            return {'processed': True, 'kind': 'credits', 'idempotent': True, 'order_id': order.id}

        purchase_units = capture_payload.get('purchase_units') or []
        purchase_unit = purchase_units[0] if purchase_units else {}
        captures = ((purchase_unit.get('payments') or {}).get('captures') or [])
        capture = captures[0] if captures else {}
        amount_info = capture.get('amount') or purchase_unit.get('amount') or {}
        payer = capture_payload.get('payer') or {}
        payer_id = payer.get('payer_id')

        user = User.query.get(order.user_id)
        if not user:
            raise ValueError('User not found for PayPal order')

        success, error = CreditsService.add_credits(
            user=user,
            amount=order.total_credits,
            operation=CreditOperation.PURCHASE,
            description=f'PayPal checkout {order.package_name} ({order_id})',
        )
        if not success:
            raise ValueError(error or 'Failed to apply PayPal credits')

        user.billing_provider = self.provider_name
        if payer_id:
            user.paypal_payer_id = payer_id
        db.session.add(user)
        self._mark_order_paid(order, order_id, float(amount_info.get('value', order.amount) or order.amount), amount_info.get('currency_code', self.currency))
        db.session.commit()
        return {'processed': True, 'kind': 'credits', 'order_id': order.id}

    def capture_approved_order(self, order_id: str) -> Dict[str, Any]:
        try:
            existing = PaymentOrder.query.filter_by(external_order_id=order_id, status='paid').first()
            if existing:
                return {'processed': True, 'kind': 'credits', 'idempotent': True, 'order_id': existing.id}
            payload = self._request('POST', f'/v2/checkout/orders/{order_id}/capture', expected_status={201}, json={})
            return self._handle_captured_checkout_order(payload)
        except ValueError as exc:
            if 'ORDER_ALREADY_CAPTURED' in str(exc):
                payload = self.get_order_details(order_id)
                return self._handle_captured_checkout_order(payload)
            raise

    def _resolve_subscription_context(self, subscription_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        subscription = payload or self.get_subscription_details(subscription_id)
        parsed_custom = self._parse_custom_id(subscription.get('custom_id'))
        plan_id = parsed_custom.get('target_id')
        if not plan_id:
            external_plan_id = subscription.get('plan_id')
            plan = self._find_plan_by_external_plan_id(external_plan_id)
            plan_id = plan.id if plan else None
        payer_id = ((subscription.get('subscriber') or {}).get('payer_id') or '')
        email = ((subscription.get('subscriber') or {}).get('email_address') or '')
        user = self._find_user(
            user_id=parsed_custom.get('user_id'),
            payer_id=payer_id,
            subscription_id=subscription.get('id'),
            email=email,
        )
        return {
            'subscription': subscription,
            'plan_id': plan_id,
            'payer_id': payer_id,
            'email': email,
            'user': user,
        }

    def sync_subscription_state(self, subscription_id: str) -> Dict[str, Any]:
        context = self._resolve_subscription_context(subscription_id)
        subscription = context['subscription']
        user = context['user']
        plan_id = context['plan_id']
        if not user:
            return {'processed': False, 'reason': 'user_not_found'}
        active_statuses = {'ACTIVE', 'APPROVAL_PENDING', 'SUSPENDED'}
        active = subscription.get('status') in active_statuses and bool(plan_id)
        self._apply_subscription_state(
            user,
            plan_id or 'free',
            subscription.get('id'),
            (subscription.get('billing_info') or {}).get('next_billing_time'),
            active=active,
            payer_id=context['payer_id'] or None,
        )
        db.session.commit()
        return {'processed': True, 'kind': 'subscription_state', 'status': subscription.get('status')}

    def _handle_subscription_payment(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        payment_id = resource.get('id')
        related_ids = ((resource.get('supplementary_data') or {}).get('related_ids') or {})
        subscription_id = resource.get('billing_agreement_id') or related_ids.get('subscription_id')
        if not payment_id or not subscription_id:
            return {'processed': False, 'reason': 'subscription_payment_missing_ids'}

        existing = PaymentOrder.query.filter_by(external_order_id=payment_id, status='paid').first()
        if existing:
            return {'processed': True, 'kind': 'subscription_payment', 'idempotent': True, 'order_id': existing.id}

        context = self._resolve_subscription_context(subscription_id)
        subscription = context['subscription']
        plan_id = context['plan_id']
        user = context['user']
        if not user or not plan_id:
            return {'processed': False, 'reason': 'subscription_user_or_plan_missing'}

        from . import get_subscription_plan
        plan = get_subscription_plan(plan_id)
        if not plan:
            return {'processed': False, 'reason': 'plan_not_found'}

        pending_order = PaymentOrder.query.filter_by(external_order_id=subscription_id, status='pending').first()
        if pending_order:
            order = pending_order
        else:
            order = PaymentOrder(
                id=str(uuid.uuid4()),
                user_id=user.id,
                package_id=plan.id,
                package_name=plan.name,
                credits=plan.monthly_credits,
                bonus_credits=0,
                total_credits=plan.monthly_credits,
                amount=plan.price_usd,
                currency=self.currency,
                payment_provider=self.provider_name,
                payment_type='subscription',
                external_order_id=payment_id,
                status='pending',
            )
            db.session.add(order)
            db.session.flush()

        success, error = CreditsService.add_credits(
            user=user,
            amount=plan.monthly_credits,
            operation=CreditOperation.PURCHASE,
            description=f'PayPal subscription {plan.name} ({payment_id})',
        )
        if not success:
            raise ValueError(error or 'Failed to apply PayPal subscription credits')

        amount_info = resource.get('amount') or resource.get('seller_receivable_breakdown', {}).get('gross_amount') or {}
        self._mark_order_paid(order, payment_id, float(amount_info.get('value', plan.price_usd) or plan.price_usd), amount_info.get('currency_code', self.currency))
        self._apply_subscription_state(
            user,
            plan.id,
            subscription_id,
            (subscription.get('billing_info') or {}).get('next_billing_time'),
            active=True,
            payer_id=context['payer_id'] or None,
        )
        db.session.commit()
        return {'processed': True, 'kind': 'subscription_payment', 'order_id': order.id}

    def handle_webhook_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        event_type = payload.get('event_type')
        resource = payload.get('resource') or {}
        logger.info('Handling PayPal webhook event: %s', event_type)

        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            related = ((resource.get('supplementary_data') or {}).get('related_ids') or {})
            if related.get('subscription_id') or resource.get('billing_agreement_id'):
                return self._handle_subscription_payment(resource)
            order_id = related.get('order_id')
            if order_id:
                order_payload = self.get_order_details(order_id)
                return self._handle_captured_checkout_order(order_payload)
        if event_type == 'PAYMENT.SALE.COMPLETED':
            return self._handle_subscription_payment(resource)
        if event_type in {'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED'}:
            return self.sync_subscription_state(resource.get('id'))
        if event_type in {'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED'}:
            context = self._resolve_subscription_context(resource.get('id'), payload=resource)
            user = context['user']
            if not user:
                return {'processed': False, 'reason': 'user_not_found'}
            self._apply_subscription_state(user, context['plan_id'] or 'free', resource.get('id'), None, active=False, payer_id=context['payer_id'] or None)
            db.session.commit()
            return {'processed': True, 'kind': 'subscription_state', 'status': resource.get('status')}
        return {'processed': True, 'ignored': True, 'event_type': event_type}
