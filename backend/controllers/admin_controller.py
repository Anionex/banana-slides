"""Admin controller - user management, admin accounts, and private settings."""
import logging
import re
from datetime import datetime, timedelta

from flask import Blueprint, current_app, g, jsonify, request

from controllers.settings_controller import (
    SettingsValidationError,
    _apply_settings_updates,
    _reset_settings_values,
    create_settings_test_task,
)
from models import PointsTransaction, Settings, Subscription, User, db
from utils.auth import generate_tokens, require_admin

logger = logging.getLogger(__name__)
admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

PASSWORD_POLICY_RE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{6,}$")


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    import bcrypt

    return bcrypt.checkpw(password.encode(), hashed.encode())


def _validate_admin_password(password: str):
    if not PASSWORD_POLICY_RE.match(password or ""):
        raise SettingsValidationError(
            "Password must be at least 6 characters and include uppercase, lowercase, and a special character"
        )


def _get_admin_settings_or_404():
    settings = Settings.get_admin_settings(g.current_user, create_if_missing=True)
    if not settings:
        raise SettingsValidationError("Admin settings not found")
    return settings


@admin_bp.route("/login", methods=["POST"])
def admin_login():
    """Admin-only login: username + password, role must be admin."""
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "请输入账号和密码"}), 400

    user = User.query.filter((User.username == username) | (User.phone == username)).first()

    if not user or not user.password_hash:
        return jsonify({"error": "账号或密码错误"}), 401

    if not _check_password(password, user.password_hash):
        return jsonify({"error": "账号或密码错误"}), 401

    if not user.is_active:
        return jsonify({"error": "账号已被禁用"}), 403

    if user.role != "admin":
        return jsonify({"error": "无管理员权限"}), 403

    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": {"user": user.to_dict(admin=True), **tokens}})


@admin_bp.route("/stats", methods=["GET"])
@require_admin
def get_stats():
    total_users = User.query.count()
    active_subs = Subscription.query.filter_by(status="active").count()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_generations = PointsTransaction.query.filter(
        PointsTransaction.type == "generation",
        PointsTransaction.created_at >= today_start,
    ).count()
    total_points_issued = (
        db.session.query(db.func.sum(PointsTransaction.amount))
        .filter(PointsTransaction.amount > 0)
        .scalar()
        or 0
    )

    return jsonify(
        {
            "data": {
                "total_users": total_users,
                "active_subscriptions": active_subs,
                "today_generations": today_generations,
                "total_points_issued": total_points_issued,
            }
        }
    )


@admin_bp.route("/users", methods=["GET"])
@require_admin
def list_users():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    search = request.args.get("search", "").strip()

    query = User.query
    if search:
        query = query.filter((User.phone.contains(search)) | (User.username.contains(search)))
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify(
        {
            "data": {
                "items": [u.to_dict(admin=True) for u in pagination.items],
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        }
    )


@admin_bp.route("/users", methods=["POST"])
@require_admin
def create_admin_user():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username:
        return jsonify({"error": "Username is required"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 409

    try:
        _validate_admin_password(password)
    except SettingsValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    now = datetime.utcnow()
    admin_user = User(
        username=username,
        password_hash=_hash_password(password),
        role="admin",
        points=0,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.session.add(admin_user)
    db.session.commit()

    Settings.get_admin_settings(admin_user, create_if_missing=True)

    return jsonify({"data": admin_user.to_dict(admin=True)}), 201


@admin_bp.route("/users/<string:user_id>", methods=["PUT"])
@require_admin
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if "role" in data and data["role"] in ("user", "admin"):
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"data": user.to_dict(admin=True)})


@admin_bp.route("/users/<string:user_id>/points", methods=["POST"])
@require_admin
def adjust_points(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    amount = int(data.get("amount", 0))
    description = (data.get("description") or "管理员调整").strip()

    if amount == 0:
        return jsonify({"error": "amount cannot be 0"}), 400

    user.points = max(0, user.points + amount)
    db.session.add(
        PointsTransaction(
            user_id=user.id,
            amount=amount,
            type="admin_adjust",
            description=description,
            created_at=datetime.utcnow(),
        )
    )
    user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"data": {"points": user.points}})


@admin_bp.route("/users/<string:user_id>/subscribe", methods=["POST"])
@require_admin
def admin_activate_subscription(user_id):
    """Manually activate a subscription for a user after payment verification."""
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    plan = data.get("plan", "monthly")

    if plan not in ("monthly", "yearly"):
        return jsonify({"error": "无效的订阅方案"}), 400

    Subscription.query.filter_by(user_id=user.id, status="active").update({"status": "expired"})

    days = 30 if plan == "monthly" else 365
    now = datetime.utcnow()
    sub = Subscription(
        user_id=user.id,
        plan=plan,
        status="active",
        start_date=now,
        end_date=now + timedelta(days=days),
        created_at=now,
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify({"data": sub.to_dict()}), 201


@admin_bp.route("/subscriptions", methods=["GET"])
@require_admin
def list_subscriptions():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    status = request.args.get("status", "")

    query = Subscription.query
    if status:
        query = query.filter_by(status=status)
    pagination = query.order_by(Subscription.id.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    items = []
    for sub in pagination.items:
        item = sub.to_dict()
        item["user"] = sub.user.to_dict(admin=True) if sub.user else None
        items.append(item)

    return jsonify(
        {
            "data": {
                "items": items,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        }
    )


@admin_bp.route("/transactions", methods=["GET"])
@require_admin
def list_transactions():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    user_id = request.args.get("user_id")

    query = PointsTransaction.query
    if user_id:
        query = query.filter_by(user_id=user_id)
    pagination = query.order_by(PointsTransaction.id.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    items = []
    for item in pagination.items:
        data = item.to_dict()
        data["user"] = item.user.to_dict(admin=True) if item.user else None
        items.append(data)

    return jsonify(
        {
            "data": {
                "items": items,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "pages": pagination.pages,
            }
        }
    )


@admin_bp.route("/account/password", methods=["POST"])
@require_admin
def change_admin_password():
    data = request.get_json() or {}
    current_password = (data.get("current_password") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400
    if not g.current_user.password_hash or not _check_password(
        current_password, g.current_user.password_hash
    ):
        return jsonify({"error": "Current password is incorrect"}), 400

    try:
        _validate_admin_password(new_password)
    except SettingsValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    g.current_user.password_hash = _hash_password(new_password)
    g.current_user.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"data": {"message": "Password updated successfully"}})


@admin_bp.route("/settings", methods=["GET"], strict_slashes=False)
@require_admin
def get_admin_settings():
    settings = _get_admin_settings_or_404()
    return jsonify({"data": settings.to_dict(include_defaults=False)})


@admin_bp.route("/settings", methods=["PUT"], strict_slashes=False)
@require_admin
def update_admin_settings():
    try:
        data = request.get_json()
        settings = _get_admin_settings_or_404()
        _apply_settings_updates(settings, data)
        db.session.commit()
        return jsonify(
            {
                "data": settings.to_dict(include_defaults=False),
                "message": "Settings updated successfully",
            }
        )
    except SettingsValidationError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        logger.error("Error updating admin settings: %s", exc, exc_info=True)
        return jsonify({"error": f"Failed to update admin settings: {exc}"}), 500


@admin_bp.route("/settings/reset", methods=["POST"], strict_slashes=False)
@require_admin
def reset_admin_settings():
    try:
        settings = _get_admin_settings_or_404()
        _reset_settings_values(settings)
        db.session.commit()
        return jsonify(
            {
                "data": settings.to_dict(include_defaults=False),
                "message": "Settings reset to defaults",
            }
        )
    except Exception as exc:
        db.session.rollback()
        logger.error("Error resetting admin settings: %s", exc, exc_info=True)
        return jsonify({"error": f"Failed to reset admin settings: {exc}"}), 500


@admin_bp.route("/settings/tests/<test_name>", methods=["POST"], strict_slashes=False)
@require_admin
def run_admin_settings_test(test_name: str):
    try:
        settings = _get_admin_settings_or_404()
        override_settings = request.get_json() or {}
        return create_settings_test_task(test_name, settings, override_settings)
    except SettingsValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        logger.error("Failed to start admin settings test: %s", exc, exc_info=True)
        return jsonify({"error": f"Failed to start admin settings test: {exc}"}), 500


@admin_bp.route("/settings/tests/<task_id>/status", methods=["GET"], strict_slashes=False)
@require_admin
def get_admin_settings_test_status(task_id: str):
    from models import Task

    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({"error": "Task not found"}), 404

        response_data = {
            "status": task.status,
            "task_type": task.task_type,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }

        if task.status == "COMPLETED":
            progress = task.get_progress()
            response_data["result"] = progress.get("result", {})
            response_data["message"] = progress.get("message", "Test completed")
        elif task.status == "FAILED":
            response_data["error"] = task.error_message

        return jsonify({"data": response_data})
    except Exception as exc:
        logger.error("Failed to get admin settings test status: %s", exc, exc_info=True)
        return jsonify({"error": f"Failed to get test status: {exc}"}), 500
