"""Stripe payment provider for global SaaS billing."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe

from models import db, User, PaymentOrder
from services.credits_service import CreditsService, CreditOperation

from .base import CreditPackage, PaymentProvider, PaymentResult, PaymentStatus, SubscriptionPlan

logger = logging.getLogger(__name__)


class StripeProvider(PaymentProvider):
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.secret_key = cfg.get('secret_key', os.getenv('STRIPE_SECRET_KEY', ''))
        self.webhook_secret = cfg.get('webhook_secret', os.getenv('STRIPE_WEBHOOK_SECRET', ''))
        self.portal_configuration_id = cfg.get('portal_configuration_id', os.getenv('STRIPE_PORTAL_CONFIGURATION_ID', ''))
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
        self.portal_return_url = cfg.get('portal_return_url', os.getenv('STRIPE_PORTAL_RETURN_URL', f'{self.frontend_url}/settings'))
        stripe.api_key = self.secret_key or None

        price_ids = cfg.get('price_ids') or {}
        subscription_price_ids = cfg.get('subscription_price_ids') or {}
        self.credit_price_ids = {
            'starter': price_ids.get('starter', os.getenv('STRIPE_PRICE_STARTER', '')),
            'basic': price_ids.get('basic', os.getenv('STRIPE_PRICE_BASIC', '')),
            'standard': price_ids.get('standard', os.getenv('STRIPE_PRICE_STANDARD', '')),
            'pro': price_ids.get('pro', os.getenv('STRIPE_PRICE_PRO', '')),
            'enterprise': price_ids.get('enterprise', os.getenv('STRIPE_PRICE_ENTERPRISE', '')),
        }
        self.subscription_price_ids = {
            'pro_monthly': subscription_price_ids.get('pro_monthly', os.getenv('STRIPE_SUB_PRICE_PRO_MONTHLY', '')),
            'team_monthly': subscription_price_ids.get('team_monthly', os.getenv('STRIPE_SUB_PRICE_TEAM_MONTHLY', '')),
            'enterprise_monthly': subscription_price_ids.get('enterprise_monthly', os.getenv('STRIPE_SUB_PRICE_ENTERPRISE_MONTHLY', '')),
        }

    @property
    def provider_name(self) -> str:
        return 'stripe'

    def _require_api_key(self):
        if not self.secret_key:
            raise ValueError('Stripe secret key is not configured')

    def _get_or_create_customer(self, user: User) -> str:
        self._require_api_key()
        if user.stripe_customer_id:
            return user.stripe_customer_id

        customer = stripe.Customer.create(
            email=user.email,
            metadata={'user_id': user.id},
            name=user.username or None,
        )
        user.stripe_customer_id = customer.id
        db.session.commit()
        return customer.id

    def _line_item_for_credit_package(self, package: CreditPackage) -> dict:
        price_id = self.credit_price_ids.get(package.id)
        if price_id:
            return {'price': price_id, 'quantity': 1}
        return {
            'price_data': {
                'currency': 'usd',
                'unit_amount': int(round(package.price_usd * 100)),
                'product_data': {
                    'name': package.name,
                    'description': package.description,
                },
            },
            'quantity': 1,
        }

    def _line_item_for_subscription_plan(self, plan: SubscriptionPlan) -> dict:
        price_id = self.subscription_price_ids.get(plan.id)
        if price_id:
            return {'price': price_id, 'quantity': 1}
        return {
            'price_data': {
                'currency': 'usd',
                'unit_amount': int(round(plan.price_usd * 100)),
                'recurring': {'interval': plan.interval},
                'product_data': {
                    'name': plan.name,
                    'description': plan.description,
                },
            },
            'quantity': 1,
        }

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
            self._require_api_key()
            user = User.query.get(user_id)
            if not user:
                return PaymentResult(success=False, error_message='User not found')

            customer_id = self._get_or_create_customer(user)
            success_url = success_url or f"{self.frontend_url}/pricing?success=true&session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or return_url or f"{self.frontend_url}/pricing?canceled=true"

            session = stripe.checkout.Session.create(
                mode='payment',
                customer=customer_id,
                client_reference_id=user.id,
                line_items=[self._line_item_for_credit_package(package)],
                allow_promotion_codes=True,
                billing_address_collection='auto',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    'kind': 'credits',
                    'user_id': user.id,
                    'package_id': package.id,
                },
                payment_intent_data={
                    'metadata': {
                        'kind': 'credits',
                        'user_id': user.id,
                        'package_id': package.id,
                    }
                },
            )
            return PaymentResult(
                success=True,
                external_order_id=session.id,
                payment_url=session.url,
                raw_response={'id': session.id},
            )
        except Exception as exc:
            logger.error('Stripe checkout creation failed: %s', exc, exc_info=True)
            return PaymentResult(success=False, error_message=str(exc))

    def create_subscription_checkout(
        self,
        user: User,
        plan: SubscriptionPlan,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> PaymentResult:
        try:
            self._require_api_key()
            customer_id = self._get_or_create_customer(user)
            success_url = success_url or f"{self.frontend_url}/pricing?subscription=success&session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = cancel_url or f"{self.frontend_url}/pricing?subscription=canceled"

            session = stripe.checkout.Session.create(
                mode='subscription',
                customer=customer_id,
                client_reference_id=user.id,
                line_items=[self._line_item_for_subscription_plan(plan)],
                allow_promotion_codes=True,
                billing_address_collection='auto',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    'kind': 'subscription',
                    'user_id': user.id,
                    'plan_id': plan.id,
                },
                subscription_data={
                    'metadata': {
                        'kind': 'subscription',
                        'user_id': user.id,
                        'plan_id': plan.id,
                    }
                },
            )
            return PaymentResult(
                success=True,
                external_order_id=session.id,
                payment_url=session.url,
                raw_response={'id': session.id},
            )
        except Exception as exc:
            logger.error('Stripe subscription checkout creation failed: %s', exc, exc_info=True)
            return PaymentResult(success=False, error_message=str(exc))

    def create_portal_session(self, user: User, return_url: Optional[str] = None) -> str:
        self._require_api_key()
        customer_id = self._get_or_create_customer(user)
        kwargs: Dict[str, Any] = {
            'customer': customer_id,
            'return_url': return_url or self.portal_return_url or f'{self.frontend_url}/settings',
        }
        if self.portal_configuration_id:
            kwargs['configuration'] = self.portal_configuration_id
        session = stripe.billing_portal.Session.create(**kwargs)
        return session.url

    def verify_webhook(self, payload: Dict[str, Any], signature: Optional[str] = None) -> bool:
        if not signature or not self.webhook_secret:
            return False
        try:
            raw = payload.get('_raw_body', b'')
            stripe.Webhook.construct_event(raw, signature, self.webhook_secret)
            return True
        except Exception:
            return False

    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return payload

    def construct_webhook_event(self, payload: bytes, signature: Optional[str]):
        self._require_api_key()
        if not signature:
            raise ValueError('Missing Stripe-Signature header')
        if not self.webhook_secret:
            raise ValueError('Stripe webhook secret is not configured')
        return stripe.Webhook.construct_event(payload, signature, self.webhook_secret)

    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        try:
            self._require_api_key()
            session = stripe.checkout.Session.retrieve(order_id)
            status = PaymentStatus.PAID if session.payment_status == 'paid' else PaymentStatus.PENDING
            return {
                'order_id': session.id,
                'external_order_id': session.id,
                'status': status,
                'amount': (session.amount_total or 0) / 100,
                'currency': session.currency,
            }
        except Exception as exc:
            logger.error('Stripe query order failed: %s', exc)
            return None

    def _plan_slug(self, plan_id: str) -> str:
        return plan_id.replace('_monthly', '') if plan_id else 'free'

    def _timestamp_to_datetime(self, timestamp: Optional[int]):
        if not timestamp:
            return None
        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    def _find_user_from_stripe_event(self, customer_id: Optional[str] = None, user_id: Optional[str] = None) -> Optional[User]:
        if user_id:
            user = User.query.get(user_id)
            if user:
                return user
        if customer_id:
            return User.query.filter_by(stripe_customer_id=customer_id).first()
        return None

    def _find_credit_package_by_price_id(self, price_id: Optional[str]):
        if not price_id:
            return None
        from . import get_all_packages

        reverse = {v: k for k, v in self.credit_price_ids.items() if v}
        package_id = reverse.get(price_id)
        if not package_id:
            return None
        for package in get_all_packages():
            if package.id == package_id:
                return package
        return None

    def _find_subscription_plan_by_price_id(self, price_id: Optional[str]):
        if not price_id:
            return None
        from . import get_all_subscription_plans

        reverse = {v: k for k, v in self.subscription_price_ids.items() if v}
        plan_id = reverse.get(price_id)
        if not plan_id:
            return None
        for plan in get_all_subscription_plans():
            if plan.id == plan_id:
                return plan
        return None

    def _mark_order_paid(self, order: PaymentOrder, external_id: str, amount: float, currency: str):
        order.status = 'paid'
        order.external_order_id = external_id
        order.amount = amount
        order.currency = (currency or order.currency or 'usd').upper()
        order.paid_at = datetime.now(timezone.utc)
        db.session.add(order)

    def _apply_subscription_state(self, user: User, plan_id: str, subscription_id: Optional[str], current_period_end_ts: Optional[int], active: bool = True):
        user.billing_provider = self.provider_name
        if active:
            user.subscription_plan = self._plan_slug(plan_id)
            user.subscription_expires_at = self._timestamp_to_datetime(current_period_end_ts)
            if subscription_id:
                user.stripe_subscription_id = subscription_id
        else:
            user.subscription_plan = 'free'
            user.subscription_expires_at = None
            if subscription_id:
                user.stripe_subscription_id = subscription_id
        db.session.add(user)

    def _handle_checkout_session_completed(self, session: Any) -> Dict[str, Any]:
        metadata = dict(session.get('metadata') or {})
        kind = metadata.get('kind')
        user = self._find_user_from_stripe_event(
            customer_id=session.get('customer'),
            user_id=metadata.get('user_id') or session.get('client_reference_id'),
        )
        if not user:
            logger.warning('Stripe checkout.session.completed without matching user: %s', session.get('id'))
            return {'processed': False, 'reason': 'user_not_found'}

        if session.get('customer') and user.stripe_customer_id != session.get('customer'):
            user.stripe_customer_id = session.get('customer')
            db.session.add(user)

        order = PaymentOrder.query.filter_by(external_order_id=session.get('id')).first()

        if kind == 'credits':
            from . import get_credit_package
            package = get_credit_package(metadata.get('package_id'))
            if not package:
                logger.warning('Stripe session missing valid credit package: %s', metadata)
                return {'processed': False, 'reason': 'package_not_found'}

            if order and order.status == 'paid':
                return {'processed': True, 'kind': 'credits', 'idempotent': True}

            if not order:
                order = PaymentOrder(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    package_id=package.id,
                    package_name=package.name,
                    credits=package.credits,
                    bonus_credits=package.bonus_credits,
                    total_credits=package.total_credits,
                    amount=(session.get('amount_total') or 0) / 100,
                    currency=(session.get('currency') or 'usd').upper(),
                    payment_provider=self.provider_name,
                    payment_type='card',
                    external_order_id=session.get('id'),
                    status='pending',
                )
                db.session.add(order)
                db.session.flush()

            success, error = CreditsService.add_credits(
                user=user,
                amount=package.total_credits,
                operation=CreditOperation.PURCHASE,
                description=f'Stripe checkout {package.name} ({session.get("id")})',
            )
            if not success:
                raise ValueError(error or 'Failed to apply purchased credits')

            self._mark_order_paid(order, session.get('id'), (session.get('amount_total') or 0) / 100, session.get('currency') or 'usd')
            db.session.commit()
            return {'processed': True, 'kind': 'credits', 'order_id': order.id}

        if kind == 'subscription':
            plan_id = metadata.get('plan_id', '')
            self._apply_subscription_state(user, plan_id, session.get('subscription'), None, active=True)
            if order:
                self._mark_order_paid(order, session.get('id'), (session.get('amount_total') or 0) / 100, session.get('currency') or 'usd')
            db.session.commit()
            return {'processed': True, 'kind': 'subscription', 'plan_id': plan_id}

        return {'processed': False, 'reason': 'unsupported_kind'}

    def _handle_invoice_paid(self, invoice: Any) -> Dict[str, Any]:
        user = self._find_user_from_stripe_event(
            customer_id=invoice.get('customer'),
            user_id=(invoice.get('metadata') or {}).get('user_id'),
        )
        if not user:
            logger.warning('Stripe invoice.paid without matching user: %s', invoice.get('id'))
            return {'processed': False, 'reason': 'user_not_found'}

        lines = invoice.get('lines', {}).get('data', [])
        first_line = lines[0] if lines else {}
        price_id = None
        price = first_line.get('price') if isinstance(first_line, dict) else None
        if isinstance(price, dict):
            price_id = price.get('id')
        elif hasattr(price, 'get'):
            price_id = price.get('id')
        elif hasattr(first_line, 'price') and first_line.price:
            price_id = getattr(first_line.price, 'id', None)

        from . import get_subscription_plan
        metadata = invoice.get('metadata') or {}
        plan_id = metadata.get('plan_id')
        if not plan_id:
            parent = invoice.get('parent') or {}
            subscription_details = parent.get('subscription_details') or {}
            plan_id = (subscription_details.get('metadata') or {}).get('plan_id')
        if not plan_id and invoice.get('subscription'):
            try:
                subscription_obj = stripe.Subscription.retrieve(invoice.get('subscription'))
                plan_id = (subscription_obj.get('metadata') or {}).get('plan_id')
                if not price_id:
                    items = subscription_obj.get('items', {}).get('data', [])
                    first_sub_item = items[0] if items else {}
                    sub_price = first_sub_item.get('price') if isinstance(first_sub_item, dict) else None
                    if isinstance(sub_price, dict):
                        price_id = sub_price.get('id')
            except Exception as exc:
                logger.warning('Failed to hydrate Stripe subscription for invoice %s: %s', invoice.get('id'), exc)
        plan = get_subscription_plan(plan_id) if plan_id else None
        if not plan:
            plan = self._find_subscription_plan_by_price_id(price_id)
        if not plan:
            return {'processed': False, 'reason': 'plan_not_found'}

        existing = PaymentOrder.query.filter_by(external_order_id=invoice.get('id'), status='paid').first()
        if existing:
            return {'processed': True, 'kind': 'subscription_invoice', 'idempotent': True}

        order = PaymentOrder(
            id=str(uuid.uuid4()),
            user_id=user.id,
            package_id=plan.id,
            package_name=plan.name,
            credits=plan.monthly_credits,
            bonus_credits=0,
            total_credits=plan.monthly_credits,
            amount=(invoice.get('amount_paid') or 0) / 100,
            currency=(invoice.get('currency') or 'usd').upper(),
            payment_provider=self.provider_name,
            payment_type='subscription',
            external_order_id=invoice.get('id'),
            status='pending',
        )
        db.session.add(order)
        db.session.flush()

        success, error = CreditsService.add_credits(
            user=user,
            amount=plan.monthly_credits,
            operation=CreditOperation.PURCHASE,
            description=f'Subscription credits {plan.name} ({invoice.get("id")})',
        )
        if not success:
            raise ValueError(error or 'Failed to apply subscription credits')

        period_end = None
        if isinstance(first_line, dict):
            period_end = (first_line.get('period') or {}).get('end')
        elif hasattr(first_line, 'period') and first_line.period:
            period_end = getattr(first_line.period, 'end', None)

        self._mark_order_paid(order, invoice.get('id'), (invoice.get('amount_paid') or 0) / 100, invoice.get('currency') or 'usd')
        self._apply_subscription_state(user, plan.id, invoice.get('subscription'), period_end, active=True)
        db.session.commit()
        return {'processed': True, 'kind': 'subscription_invoice', 'order_id': order.id}

    def _handle_subscription_updated(self, subscription: Any) -> Dict[str, Any]:
        user = self._find_user_from_stripe_event(customer_id=subscription.get('customer'))
        if not user:
            return {'processed': False, 'reason': 'user_not_found'}

        items = subscription.get('items', {}).get('data', [])
        first_item = items[0] if items else {}
        price = first_item.get('price') if isinstance(first_item, dict) else None
        price_id = price.get('id') if isinstance(price, dict) else None
        metadata = subscription.get('metadata') or {}
        from . import get_subscription_plan
        plan = get_subscription_plan(metadata.get('plan_id')) if metadata.get('plan_id') else None
        if not plan:
            plan = self._find_subscription_plan_by_price_id(price_id)
        plan_id = plan.id if plan else 'free'
        status = subscription.get('status')
        active = status in {'active', 'trialing', 'past_due'} and plan is not None
        self._apply_subscription_state(
            user,
            plan_id,
            subscription.get('id'),
            subscription.get('current_period_end'),
            active=active,
        )
        db.session.commit()
        return {'processed': True, 'kind': 'subscription_state', 'status': status}

    def _handle_subscription_deleted(self, subscription: Any) -> Dict[str, Any]:
        user = self._find_user_from_stripe_event(customer_id=subscription.get('customer'))
        if not user:
            return {'processed': False, 'reason': 'user_not_found'}
        self._apply_subscription_state(user, 'free', subscription.get('id'), None, active=False)
        db.session.commit()
        return {'processed': True, 'kind': 'subscription_deleted'}

    def handle_webhook_event(self, event: Any) -> Dict[str, Any]:
        event_type = event.get('type')
        payload = event.get('data', {}).get('object', {})
        logger.info('Handling Stripe webhook event: %s', event_type)

        if event_type == 'checkout.session.completed':
            return self._handle_checkout_session_completed(payload)
        if event_type == 'invoice.paid':
            return self._handle_invoice_paid(payload)
        if event_type in {'customer.subscription.created', 'customer.subscription.updated'}:
            return self._handle_subscription_updated(payload)
        if event_type == 'customer.subscription.deleted':
            return self._handle_subscription_deleted(payload)
        return {'processed': True, 'ignored': True, 'event_type': event_type}
