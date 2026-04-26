"""User controller - profile, points history, recharge, subscription."""
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from models import db, User, PointsTransaction, RechargeOrder
from services.recharge_service import (
    current_subscription_dict,
    generate_order_no,
    get_recharge_package,
    get_recharge_packages_with_source,
    get_subscription_plan,
    get_subscription_plans_with_source,
    mark_order_expired_if_needed,
    order_expire_at,
)
from services.wechat_pay_service import create_native_order, is_wechat_pay_configured, wechat_pay_notify_url
from utils.auth import require_auth

logger = logging.getLogger(__name__)
user_bp = Blueprint('user', __name__, url_prefix='/api/user')


def _require_platform_billing_user(user):
    if not user.uses_platform_billing():
        return jsonify({'error': '当前账号不适用积分和付费功能'}), 403
    return None


def _build_notify_url():
    # 优先使用商户后台配置的公网回调地址；未配置时按当前请求域名兜底。
    configured = wechat_pay_notify_url()
    if configured:
        return configured
    return request.url_root.rstrip("/") + "/api/payment/wechat/notify"


def _profile_payload(user):
    data = user.to_dict()
    # 个人中心每次返回最新订阅状态，过期订阅会在服务层同步标记。
    data['subscription'] = current_subscription_dict(user.id)
    return data


@user_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    user = g.current_user
    return jsonify({'data': _profile_payload(user)})


@user_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    user = g.current_user
    data = request.get_json() or {}

    new_username = (data.get('username') or '').strip() or None
    new_password = (data.get('password') or '').strip() or None
    old_password = (data.get('old_password') or '').strip() or None

    if new_username and new_username != user.username:
        if User.query.filter_by(username=new_username).first():
            return jsonify({'error': '用户名已被占用'}), 409
        user.username = new_username

    if new_password:
        import bcrypt
        if user.password_hash and not old_password:
            return jsonify({'error': '请输入原密码'}), 400
        if user.password_hash and old_password:
            if not bcrypt.checkpw(old_password.encode(), user.password_hash.encode()):
                return jsonify({'error': '原密码错误'}), 400
        user.password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()

    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'data': user.to_dict()})


@user_bp.route('/points/history', methods=['GET'])
@require_auth
def points_history():
    user = g.current_user
    billing_guard = _require_platform_billing_user(user)
    if billing_guard:
        return billing_guard
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)

    pagination = PointsTransaction.query.filter_by(user_id=user.id)\
        .order_by(PointsTransaction.id.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({'data': {
        'items': [t.to_dict() for t in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }})


@user_bp.route('/recharge/packages', methods=['GET'])
@require_auth
def recharge_packages():
    billing_guard = _require_platform_billing_user(g.current_user)
    if billing_guard:
        return billing_guard
    configured = is_wechat_pay_configured()
    packages, source = get_recharge_packages_with_source()
    return jsonify({'data': {
        'items': [package.to_dict() for package in packages],
        'source': source,
        'wechat': {
            'enabled': configured,
            'configured': configured,
        },
    }})


@user_bp.route('/recharge/orders', methods=['POST'])
@require_auth
def create_recharge_order():
    user = g.current_user
    billing_guard = _require_platform_billing_user(user)
    if billing_guard:
        return billing_guard
    data = request.get_json() or {}
    package_id = (data.get('package_id') or '').strip()
    package = get_recharge_package(package_id)
    if not package:
        return jsonify({'error': '充值套餐不存在'}), 404

    if not is_wechat_pay_configured():
        return jsonify({'error': '微信支付未配置完整'}), 400

    expire_at = order_expire_at()
    order = RechargeOrder(
        order_no=generate_order_no(),
        user_id=user.id,
        order_type=RechargeOrder.TYPE_POINTS,
        package_id=package.id,
        points=package.points,
        amount_cents=package.amount_cents,
        channel='wechat',
        status=RechargeOrder.STATUS_PENDING,
        expire_at=expire_at,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(order)
    db.session.commit()

    try:
        # 先落本地订单，再向微信下单；失败时本地订单标记 failed 便于排查。
        result = create_native_order(
            order_no=order.order_no,
            description=f"充值 {package.points} 积分",
            amount_cents=package.amount_cents,
            notify_url=_build_notify_url(),
            client_ip=request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip(),
            expire_at=expire_at,
        )
        order.code_url = result.code_url
        order.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception as exc:
        order.status = RechargeOrder.STATUS_FAILED
        order.updated_at = datetime.utcnow()
        db.session.commit()
        logger.warning("Failed to create WeChat recharge order: %s", exc, exc_info=True)
        return jsonify({'error': f'发起微信支付失败：{exc}'}), 500

    return jsonify({'data': {
        'order': order.to_dict(),
        'package': package.to_dict(),
        'result': result.to_dict(),
    }}), 201


@user_bp.route('/recharge/orders/<string:order_no>', methods=['GET'])
@require_auth
def get_recharge_order(order_no):
    user = g.current_user
    billing_guard = _require_platform_billing_user(user)
    if billing_guard:
        return billing_guard
    order = RechargeOrder.query.filter_by(order_no=order_no, user_id=user.id).first()
    if not order:
        return jsonify({'error': '订单不存在'}), 404

    # 前端轮询时会触发过期检查，同时返回剩余秒数给二维码弹窗。
    expired = mark_order_expired_if_needed(order)
    remaining_seconds = 0
    if order.status == RechargeOrder.STATUS_PENDING:
        remaining_seconds = max(0, int((order.expire_at - datetime.utcnow()).total_seconds()))

    return jsonify({'data': {
        'order': order.to_dict(),
        'paid': order.status == RechargeOrder.STATUS_PAID,
        'expired': expired,
        'remaining_seconds': remaining_seconds,
        'user': _profile_payload(user),
    }})


@user_bp.route('/subscription/plans', methods=['GET'])
@require_auth
def subscription_plans():
    billing_guard = _require_platform_billing_user(g.current_user)
    if billing_guard:
        return billing_guard
    configured = is_wechat_pay_configured()
    plans, source = get_subscription_plans_with_source()
    return jsonify({'data': {
        'items': [plan.to_dict() for plan in plans],
        'source': source,
        'wechat': {
            'enabled': configured,
            'configured': configured,
        },
    }})


@user_bp.route('/subscribe', methods=['POST'])
@require_auth
def subscribe():
    """Create a WeChat subscription order."""
    user = g.current_user
    billing_guard = _require_platform_billing_user(user)
    if billing_guard:
        return billing_guard
    data = request.get_json() or {}
    plan = data.get('plan', 'monthly')  # monthly | yearly
    payment_method = data.get('payment_method', 'wechat')  # wechat | alipay

    subscription_plan = get_subscription_plan(plan)
    if not subscription_plan:
        return jsonify({'error': '无效的订阅方案'}), 400
    if payment_method != 'wechat':
        return jsonify({'error': '订阅暂时仅支持微信支付'}), 400

    if not is_wechat_pay_configured():
        return jsonify({'error': '微信支付未配置完整'}), 400

    expire_at = order_expire_at()
    order = RechargeOrder(
        order_no=generate_order_no(),
        user_id=user.id,
        order_type=RechargeOrder.TYPE_SUBSCRIPTION,
        package_id=subscription_plan.id,
        subscription_plan=subscription_plan.id,
        points=0,
        amount_cents=subscription_plan.amount_cents,
        channel='wechat',
        status=RechargeOrder.STATUS_PENDING,
        expire_at=expire_at,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(order)
    db.session.commit()

    try:
        # 订阅和积分共用微信 Native 支付，回调按 order_type 区分履约方式。
        result = create_native_order(
            order_no=order.order_no,
            description=f"订阅 {subscription_plan.name}",
            amount_cents=subscription_plan.amount_cents,
            notify_url=_build_notify_url(),
            client_ip=request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip(),
            expire_at=expire_at,
        )
        order.code_url = result.code_url
        order.updated_at = datetime.utcnow()
        db.session.commit()
    except Exception as exc:
        order.status = RechargeOrder.STATUS_FAILED
        order.updated_at = datetime.utcnow()
        db.session.commit()
        logger.warning("Failed to create WeChat subscription order: %s", exc, exc_info=True)
        return jsonify({'error': f'发起微信支付失败：{exc}'}), 500

    return jsonify({'data': {
        'plan': plan,
        'price': round(subscription_plan.amount_cents / 100, 2),
        'payment_method': payment_method,
        'order': order.to_dict(),
        'subscription_plan': subscription_plan.to_dict(),
        'result': result.to_dict(),
        'qr_code_url': result.qr_code_url,
        'note': '请使用微信扫码支付，支付成功后订阅会自动开通',
    }}), 201
