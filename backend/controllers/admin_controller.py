"""Admin controller - user management, points, subscriptions, stats"""
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from models import db, User, PointsTransaction, Subscription
from utils.auth import require_admin, generate_tokens

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def _check_password(password: str, hashed: str) -> bool:
    import bcrypt
    return bcrypt.checkpw(password.encode(), hashed.encode())


@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """Admin-only login: username + password, role must be admin."""
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': '请输入账号和密码'}), 400

    user = User.query.filter(
        (User.username == username) | (User.phone == username)
    ).first()

    if not user or not user.password_hash:
        return jsonify({'error': '账号或密码错误'}), 401

    if not _check_password(password, user.password_hash):
        return jsonify({'error': '账号或密码错误'}), 401

    if not user.is_active:
        return jsonify({'error': '账号已被禁用'}), 403

    if user.role != 'admin':
        return jsonify({'error': '无管理员权限'}), 403

    tokens = generate_tokens(user.id, user.role)
    return jsonify({'data': {'user': user.to_dict(admin=True), **tokens}})


@admin_bp.route('/stats', methods=['GET'])
@require_admin
def get_stats():
    total_users = User.query.count()
    active_subs = Subscription.query.filter_by(status='active').count()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_generations = PointsTransaction.query.filter(
        PointsTransaction.type == 'generation',
        PointsTransaction.created_at >= today_start,
    ).count()
    total_points_issued = db.session.query(
        db.func.sum(PointsTransaction.amount)
    ).filter(PointsTransaction.amount > 0).scalar() or 0

    return jsonify({'data': {
        'total_users': total_users,
        'active_subscriptions': active_subs,
        'today_generations': today_generations,
        'total_points_issued': total_points_issued,
    }})


@admin_bp.route('/users', methods=['GET'])
@require_admin
def list_users():
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    search = request.args.get('search', '').strip()

    query = User.query
    if search:
        query = query.filter(
            (User.phone.contains(search)) | (User.username.contains(search))
        )
    pagination = query.order_by(User.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({'data': {
        'items': [u.to_dict(admin=True) for u in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }})


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'role' in data and data['role'] in ('user', 'admin'):
        user.role = data['role']
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])

    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'data': user.to_dict(admin=True)})


@admin_bp.route('/users/<int:user_id>/points', methods=['POST'])
@require_admin
def adjust_points(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    amount = int(data.get('amount', 0))
    description = (data.get('description') or '管理员调整').strip()

    if amount == 0:
        return jsonify({'error': 'amount cannot be 0'}), 400

    user.points = max(0, user.points + amount)
    db.session.add(PointsTransaction(
        user_id=user.id,
        amount=amount,
        type='admin_adjust',
        description=description,
        created_at=datetime.utcnow(),
    ))
    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'data': {'points': user.points}})


@admin_bp.route('/users/<int:user_id>/subscribe', methods=['POST'])
@require_admin
def admin_activate_subscription(user_id):
    """Manually activate a subscription for a user after payment verification."""
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    plan = data.get('plan', 'monthly')

    if plan not in ('monthly', 'yearly'):
        return jsonify({'error': '无效的订阅方案'}), 400

    # Expire existing active subscriptions
    Subscription.query.filter_by(user_id=user_id, status='active').update({'status': 'expired'})

    days = 30 if plan == 'monthly' else 365
    now = datetime.utcnow()
    sub = Subscription(
        user_id=user_id,
        plan=plan,
        status='active',
        start_date=now,
        end_date=now + timedelta(days=days),
        created_at=now,
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify({'data': sub.to_dict()}), 201


@admin_bp.route('/subscriptions', methods=['GET'])
@require_admin
def list_subscriptions():
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    status = request.args.get('status', '')

    query = Subscription.query
    if status:
        query = query.filter_by(status=status)
    pagination = query.order_by(Subscription.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for sub in pagination.items:
        d = sub.to_dict()
        d['user'] = sub.user.to_dict() if sub.user else None
        items.append(d)

    return jsonify({'data': {
        'items': items,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }})


@admin_bp.route('/transactions', methods=['GET'])
@require_admin
def list_transactions():
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 100)
    user_id = request.args.get('user_id')

    query = PointsTransaction.query
    if user_id:
        query = query.filter_by(user_id=int(user_id))
    pagination = query.order_by(PointsTransaction.id.desc()).paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for t in pagination.items:
        d = t.to_dict()
        d['user'] = t.user.to_dict() if t.user else None
        items.append(d)

    return jsonify({'data': {
        'items': items,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }})
