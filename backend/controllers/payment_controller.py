"""Payment Controller - handles billing, credits, and multi-provider checkout flows."""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse, unquote

from flask import Blueprint, redirect, request

from middlewares.auth import auth_required, get_current_user
from models import PaymentOrder, SystemConfig, User, db
from services.credits_service import CreditOperation, CreditsService
from services.payment import (
    PaymentStatus,
    get_all_packages,
    get_all_subscription_plans,
    get_credit_package,
    get_default_payment_provider_name,
    get_payment_provider,
    get_payment_provider_descriptors,
    get_subscription_plan,
    get_supported_package_provider_names,
    get_supported_subscription_provider_names,
)
from utils import bad_request, error_response, not_found, success_response

logger = logging.getLogger(__name__)

payment_bp = Blueprint('payment', __name__, url_prefix='/api/payment')


def _frontend_base_url() -> str:
    frontend_url = os.getenv('FRONTEND_URL', '').rstrip('/')
    if frontend_url.startswith('http'):
        return frontend_url
    return request.url_root.rstrip('/')


def _append_query_params(url: str, **params) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in params.items():
        if value is None:
            continue
        query[key] = str(value)
    return urlunparse(parsed._replace(query=urlencode(query)))


def _validate_redirect_url(url: str) -> str:
    """Ensure url belongs to our frontend origin. Falls back to /pricing."""
    base = _frontend_base_url()
    base_parsed = urlparse(base)
    try:
        parsed = urlparse(url)
    except Exception:
        return f'{base}/pricing'
    if parsed.scheme in ('http', 'https') and parsed.netloc and parsed.netloc != base_parsed.netloc:
        return f'{base}/pricing'
    return url


@payment_bp.route('/packages', methods=['GET'])
def list_packages():
    """GET /api/payment/packages - List one-time credit packages and provider availability."""
    packages = []
    for package in get_all_packages():
        item = package.to_dict()
        item['supported_providers'] = get_supported_package_provider_names(package.id)
        packages.append(item)

    return success_response({
        'provider': get_default_payment_provider_name(),
        'default_provider': get_default_payment_provider_name(),
        'enabled_providers': get_payment_provider_descriptors(),
        'packages': packages,
    })


@payment_bp.route('/plans', methods=['GET'])
def list_subscription_plans():
    """GET /api/payment/plans - List recurring subscription plans and provider availability."""
    plans = []
    for plan in get_all_subscription_plans():
        item = plan.to_dict()
        item['supported_providers'] = get_supported_subscription_provider_names(plan.id)
        plans.append(item)

    return success_response({
        'provider': get_default_payment_provider_name(),
        'default_provider': get_default_payment_provider_name(),
        'enabled_providers': get_payment_provider_descriptors(),
        'plans': plans,
    })


@payment_bp.route('/credit-costs', methods=['GET'])
def get_public_credit_costs():
    """GET /api/payment/credit-costs - Public endpoint for credit cost config."""
    try:
        config = SystemConfig.get_instance()
        return success_response(config.get_credit_costs())
    except Exception as exc:
        logger.error('Error getting public credit costs: %s', exc)
        return error_response('GET_CREDIT_COSTS_ERROR', f'Failed to get credit costs: {exc}', 500)


@payment_bp.route('/credits', methods=['GET'])
@auth_required
def get_credits():
    """GET /api/payment/credits - Get current user's credits info."""
    user = get_current_user()
    return success_response(CreditsService.get_user_credits_info(user))


@payment_bp.route('/transactions', methods=['GET'])
@auth_required
def list_transactions():
    """GET /api/payment/transactions - Get current user's credit transaction history."""
    user = get_current_user()
    limit = min(int(request.args.get('limit', 20)), 100)
    offset = max(int(request.args.get('offset', 0)), 0)

    transactions, total = CreditsService.get_transactions(user, limit, offset)
    return success_response({
        'transactions': transactions,
        'total': total,
        'limit': limit,
        'offset': offset,
    })


@payment_bp.route('/estimate', methods=['POST'])
@auth_required
def estimate_cost():
    """POST /api/payment/estimate - Estimate credits cost for a project."""
    data = request.get_json() or {}
    pages_count = data.get('pages_count', 10)

    estimate = CreditsService.estimate_project_cost(
        pages_count=pages_count,
        include_outline=data.get('include_outline', True),
        include_descriptions=data.get('include_descriptions', True),
        include_images=data.get('include_images', True),
    )
    return success_response(estimate)


@payment_bp.route('/create-order', methods=['POST'])
@auth_required
def create_order():
    """Create a checkout session/order for one-time credit purchases."""
    user = get_current_user()
    data = request.get_json() or {}

    package_id = data.get('package_id')
    if not package_id:
        return bad_request('package_id is required')

    package = get_credit_package(package_id)
    if not package:
        return bad_request(f'Invalid package_id: {package_id}')

    provider_name = (data.get('provider') or get_default_payment_provider_name()).strip().lower()
    supported_providers = get_supported_package_provider_names(package.id)
    if provider_name not in supported_providers:
        return error_response('PAYMENT_ERROR', f'{provider_name} is not available for package {package.id}', 400)

    provider = get_payment_provider(provider_name)
    payment_type = data.get('payment_type', 'card')

    frontend_base = _frontend_base_url()
    if provider.provider_name == 'stripe':
        default_success_url = f'{frontend_base}/pricing?success=true&checkout={{CHECKOUT_SESSION_ID}}&provider=stripe'
    else:
        default_success_url = f'{frontend_base}/pricing?success=true&provider={provider.provider_name}'
    default_cancel_url = f'{frontend_base}/pricing?canceled=true&provider={provider.provider_name}'

    success_url = _validate_redirect_url(data.get('success_url') or default_success_url)
    cancel_url = _validate_redirect_url(data.get('cancel_url') or data.get('return_url') or default_cancel_url)
    notify_url = f"{request.url_root.rstrip('/')}/api/payment/webhook"

    try:
        result = provider.create_order(
            user_id=user.id,
            package=package,
            notify_url=notify_url,
            return_url=cancel_url,
            client_ip=request.remote_addr,
            payment_type=payment_type,
            success_url=success_url,
            cancel_url=cancel_url,
        )

        if not result.success:
            logger.error('Payment order creation failed: %s', result.error_message)
            return error_response('PAYMENT_ERROR', result.error_message, 400)

        currency = 'USD' if provider.provider_name in {'stripe', 'paypal', 'lemon_squeezy'} else 'CNY'
        amount = package.price_usd if currency == 'USD' else package.price_cny
        order = PaymentOrder(
            id=str(uuid.uuid4()),
            user_id=user.id,
            package_id=package.id,
            package_name=package.name,
            credits=package.credits,
            bonus_credits=package.bonus_credits,
            total_credits=package.total_credits,
            amount=amount,
            currency=currency,
            payment_provider=provider.provider_name,
            payment_type=payment_type,
            external_order_id=result.external_order_id,
            status='pending',
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.commit()

        payload = result.to_dict()
        payload['order_id'] = order.id
        payload['provider'] = provider.provider_name
        return success_response(payload)
    except Exception as exc:
        logger.error('Payment error: %s', exc, exc_info=True)
        return error_response('PAYMENT_ERROR', str(exc), 500)


@payment_bp.route('/create-subscription', methods=['POST'])
@auth_required
def create_subscription_checkout():
    """Create a recurring subscription checkout session."""
    user = get_current_user()
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    if not plan_id:
        return bad_request('plan_id is required')

    plan = get_subscription_plan(plan_id)
    if not plan:
        return bad_request(f'Invalid plan_id: {plan_id}')

    provider_name = (data.get('provider') or get_default_payment_provider_name()).strip().lower()
    supported_providers = get_supported_subscription_provider_names(plan.id)
    if provider_name not in supported_providers:
        return error_response('PAYMENT_ERROR', f'{provider_name} does not support subscriptions for {plan.id}', 400)

    provider = get_payment_provider(provider_name)
    if not hasattr(provider, 'create_subscription_checkout'):
        return error_response('PAYMENT_ERROR', f'{provider.provider_name} does not support subscriptions', 400)

    frontend_base = _frontend_base_url()
    if provider.provider_name == 'stripe':
        default_success_url = f'{frontend_base}/pricing?subscription=success&checkout={{CHECKOUT_SESSION_ID}}&provider=stripe'
    else:
        default_success_url = f'{frontend_base}/pricing?subscription=success&provider={provider.provider_name}'
    default_cancel_url = f'{frontend_base}/pricing?subscription=canceled&provider={provider.provider_name}'
    success_url = _validate_redirect_url(data.get('success_url') or default_success_url)
    cancel_url = _validate_redirect_url(data.get('cancel_url') or default_cancel_url)
    notify_url = f"{request.url_root.rstrip('/')}/api/payment/webhook"

    try:
        create_subscription = getattr(provider, 'create_subscription_checkout')
        try:
            result = create_subscription(user, plan, success_url=success_url, cancel_url=cancel_url, notify_url=notify_url)
        except TypeError:
            result = create_subscription(user, plan, success_url=success_url, cancel_url=cancel_url)
        if not result.success:
            return error_response('PAYMENT_ERROR', result.error_message, 400)

        order = PaymentOrder(
            id=str(uuid.uuid4()),
            user_id=user.id,
            package_id=plan.id,
            package_name=plan.name,
            credits=plan.monthly_credits,
            bonus_credits=0,
            total_credits=plan.monthly_credits,
            amount=plan.price_usd,
            currency='USD',
            payment_provider=provider.provider_name,
            payment_type='subscription',
            external_order_id=result.external_order_id,
            status='pending',
            created_at=datetime.now(timezone.utc),
        )
        db.session.add(order)
        db.session.commit()

        payload = result.to_dict()
        payload['order_id'] = order.id
        payload['provider'] = provider.provider_name
        payload['plan_id'] = plan.id
        return success_response(payload)
    except Exception as exc:
        logger.error('Subscription checkout error: %s', exc, exc_info=True)
        return error_response('PAYMENT_ERROR', str(exc), 500)


@payment_bp.route('/billing-portal', methods=['POST'])
@auth_required
def create_billing_portal_session():
    """Create a billing portal session for the current user when supported."""
    user = get_current_user()
    data = request.get_json() or {}
    provider = get_payment_provider((data.get('provider') or get_default_payment_provider_name()).strip().lower())
    if not hasattr(provider, 'create_portal_session'):
        return error_response('PAYMENT_ERROR', f'{provider.provider_name} does not support a billing portal', 400)

    try:
        portal_url = provider.create_portal_session(user, data.get('return_url') or f'{_frontend_base_url()}/settings')
        return success_response({'url': portal_url})
    except Exception as exc:
        logger.error('Billing portal creation error: %s', exc, exc_info=True)
        return error_response('PAYMENT_ERROR', str(exc), 500)


def _fulfill_wechatpay_order(order_info: dict):
    """Fulfill a paid WechatPay order: add credits and update DB record."""
    user_id = order_info.get('user_id')
    package_id = order_info.get('package_id')
    external_order_id = order_info.get('external_order_id')
    internal_order_id = order_info.get('order_id')

    user = User.query.get(user_id) if user_id else None
    package = get_credit_package(package_id) if package_id else None
    if not user or not package:
        logger.error('WechatPay fulfill: user=%s package=%s not found', user_id, package_id)
        return

    db_order = None
    if internal_order_id:
        db_order = PaymentOrder.query.filter_by(id=internal_order_id).first()
    if not db_order and internal_order_id:
        db_order = PaymentOrder.query.filter(
            PaymentOrder.external_order_id == internal_order_id
        ).first()
    if db_order and db_order.status == 'paid':
        return

    success, error = CreditsService.add_credits(
        user=user,
        amount=package.total_credits,
        operation=CreditOperation.PURCHASE,
        description=f'Purchase {package.name} ({external_order_id or internal_order_id})',
    )
    if success and db_order:
        db_order.status = 'paid'
        db_order.paid_at = datetime.now(timezone.utc)
        db_order.external_order_id = external_order_id or db_order.external_order_id
        db.session.commit()
    elif not success:
        logger.error('WechatPay fulfill credits failed: %s', error)


@payment_bp.route('/webhook', methods=['POST'])
def payment_webhook():
    """Unified webhook endpoint for Stripe, PayPal, and legacy providers."""
    try:
        if request.headers.get('Stripe-Signature'):
            provider = get_payment_provider('stripe')
            event = provider.construct_webhook_event(request.get_data(), request.headers.get('Stripe-Signature'))
            result = provider.handle_webhook_event(event)
            return success_response(result)

        if request.headers.get('PAYPAL-TRANSMISSION-ID'):
            payload = request.get_json(silent=True) or {}
            if not payload:
                return 'Bad Request', 400
            provider = get_payment_provider('paypal')
            if not provider.verify_webhook(payload, headers=dict(request.headers)):
                logger.warning('PayPal webhook verification failed')
                return 'Forbidden', 403
            result = provider.handle_webhook_event(payload)
            return success_response(result)

        if request.headers.get('Wechatpay-Signature'):
            raw_body = request.get_data(as_text=True)
            payload = request.get_json(silent=True) or {}
            payload['_raw_body'] = raw_body
            provider = get_payment_provider('wechatpay')
            if not provider.verify_webhook(payload, headers=dict(request.headers)):
                logger.warning('WechatPay webhook verification failed')
                return 'Forbidden', 403
            order_info = provider.parse_webhook(payload)
            if order_info.get('status') == PaymentStatus.PAID:
                _fulfill_wechatpay_order(order_info)
            return '{"code": "SUCCESS", "message": "成功"}', 200

        payload = request.get_json(silent=True) or request.form.to_dict()
        if not payload:
            logger.warning('Empty webhook payload received')
            return 'Bad Request', 400

        signature = request.headers.get('X-Signature')
        provider_name = request.args.get('provider') or get_default_payment_provider_name()
        provider = get_payment_provider(provider_name)

        if not provider.verify_webhook(payload, signature, dict(request.headers)):
            logger.warning('Webhook signature verification failed for %s', provider.provider_name)
            return 'Forbidden', 403

        order_info = provider.parse_webhook(payload)
        if order_info.get('status') == PaymentStatus.PAID:
            user_id = order_info.get('user_id')
            package_id = order_info.get('package_id')
            external_order_id = order_info.get('external_order_id')

            user = User.query.get(user_id) if user_id else None
            package = get_credit_package(package_id) if package_id else None
            if user and package:
                success, error = CreditsService.add_credits(
                    user=user,
                    amount=package.total_credits,
                    operation=CreditOperation.PURCHASE,
                    description=f'Purchase {package.name} ({external_order_id or order_info.get("order_id")})',
                )
                if success:
                    db_order = PaymentOrder.query.filter_by(external_order_id=external_order_id).first()
                    if not db_order and order_info.get('order_id'):
                        db_order = PaymentOrder.query.get(order_info.get('order_id'))
                    if db_order:
                        db_order.status = 'paid'
                        db_order.paid_at = datetime.now(timezone.utc)
                        db_order.external_order_id = external_order_id or db_order.external_order_id
                        db.session.commit()
                else:
                    logger.error('Failed to add credits from legacy webhook: %s', error)
        return 'OK', 200
    except Exception as exc:
        logger.error('Webhook processing error: %s', exc, exc_info=True)
        return 'Internal Server Error', 500


@payment_bp.route('/paypal/return', methods=['GET'])
def paypal_return():
    """Handle PayPal order approval return and capture the order server-side."""
    success_url = _validate_redirect_url(unquote(request.args.get('success_url') or f'{_frontend_base_url()}/pricing?success=true&provider=paypal'))
    order_id = request.args.get('token') or request.args.get('order_id')
    if not order_id:
        return redirect(_append_query_params(success_url, error='paypal_missing_token', provider='paypal'))

    try:
        provider = get_payment_provider('paypal')
        result = provider.capture_approved_order(order_id)
        target = _append_query_params(success_url, success='true', provider='paypal')
        if isinstance(result, dict):
            target = _append_query_params(target, order=result.get('order_id') or order_id)
        return redirect(target)
    except Exception as exc:
        logger.error('PayPal return capture failed: %s', exc, exc_info=True)
        return redirect(_append_query_params(success_url, error='paypal_capture_failed', provider='paypal'))


@payment_bp.route('/paypal/subscription/return', methods=['GET'])
def paypal_subscription_return():
    """Handle PayPal subscription approval return."""
    success_url = _validate_redirect_url(unquote(request.args.get('success_url') or f'{_frontend_base_url()}/pricing?subscription=success&provider=paypal'))
    subscription_id = request.args.get('subscription_id') or request.args.get('token') or request.args.get('ba_token')
    if subscription_id:
        try:
            provider = get_payment_provider('paypal')
            provider.sync_subscription_state(subscription_id)
        except Exception as exc:
            logger.warning('PayPal subscription return sync failed: %s', exc)
    return redirect(_append_query_params(success_url, subscription='success', provider='paypal'))


@payment_bp.route('/paypal/cancel', methods=['GET'])
def paypal_cancel():
    """Handle PayPal cancel redirects."""
    cancel_url = _validate_redirect_url(unquote(request.args.get('cancel_url') or f'{_frontend_base_url()}/pricing?canceled=true&provider=paypal'))
    return redirect(_append_query_params(cancel_url, canceled='true', provider='paypal'))


@payment_bp.route('/order/<order_id>', methods=['GET'])
@auth_required
def query_order(order_id):
    """Query the status of a remote order/checkout session."""
    try:
        provider_name = request.args.get('provider') or get_default_payment_provider_name()
        provider = get_payment_provider(provider_name)
        order_info = provider.query_order(order_id)
        if order_info:
            return success_response(order_info)
        return not_found('Order')
    except Exception as exc:
        logger.error('Order query error: %s', exc, exc_info=True)
        return error_response('QUERY_ERROR', str(exc), 500)
