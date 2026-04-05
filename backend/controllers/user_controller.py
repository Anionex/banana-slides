"""User controller - profile, points history, subscription"""
import os
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from models import db, User, PointsTransaction, Subscription
from utils.auth import require_auth

logger = logging.getLogger(__name__)
user_bp = Blueprint('user', __name__, url_prefix='/api/user')


@user_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    user = g.current_user
    # Get active subscription
    sub = Subscription.query.filter_by(user_id=user.id, status='active').order_by(Subscription.id.desc()).first()
    data = user.to_dict()
    data['subscription'] = sub.to_dict() if sub else None
    return jsonify({'data': data})


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


@user_bp.route('/subscribe', methods=['POST'])
@require_auth
def subscribe():
    """Create a subscription order - returns payment QR code paths."""
    user = g.current_user
    data = request.get_json() or {}
    plan = data.get('plan', 'monthly')  # monthly | yearly
    payment_method = data.get('payment_method', 'wechat')  # wechat | alipay

    if plan not in ('monthly', 'yearly'):
        return jsonify({'error': '无效的订阅方案'}), 400

    # Return static QR code image paths (manual payment verification by admin)
    qr_images = {
        'wechat': '/static/payment/wechat_qr.png',
        'alipay': '/static/payment/alipay_qr.png',
    }

    prices = {'monthly': 29, 'yearly': 199}

    return jsonify({'data': {
        'plan': plan,
        'price': prices[plan],
        'payment_method': payment_method,
        'qr_code_url': qr_images.get(payment_method, qr_images['wechat']),
        'note': '请扫码付款后联系管理员激活订阅',
    }})
