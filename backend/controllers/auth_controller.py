"""Auth controller - register, login, token refresh."""
import logging
import re
from datetime import datetime

from flask import Blueprint, jsonify, request

from models import PointsTransaction, User, db
from services.sms_service import check_rate_limit, create_sms_code, send_sms, verify_sms_code
from utils.auth import decode_token, generate_tokens, require_auth, token_user_id

logger = logging.getLogger(__name__)
auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _check_password(password: str, hashed: str) -> bool:
    import bcrypt

    return bcrypt.checkpw(password.encode(), hashed.encode())


def _create_user_with_bonus(*, username=None, phone=None, password=None):
    user = User(
        phone=phone,
        username=username,
        password_hash=_hash_password(password) if password else None,
        role=User.ROLE_USER,
        points=100,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(user)
    db.session.flush()

    db.session.add(
        PointsTransaction(
            user_id=user.id,
            amount=100,
            type="register_bonus",
            description="新用户注册赠送积分",
            created_at=datetime.utcnow(),
        )
    )
    db.session.commit()
    return user


@auth_bp.route("/send-sms", methods=["POST"])
def send_sms_code():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    if not PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400

    allowed, msg = check_rate_limit(phone)
    if not allowed:
        return jsonify({"error": msg}), 429

    code = create_sms_code(phone)
    ok = send_sms(phone, code)
    if not ok:
        return jsonify({"error": "短信发送失败，请稍后重试"}), 500

    return jsonify({"data": {"message": "验证码已发送"}})


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register by phone verification code."""
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    code = (data.get("code") or "").strip()
    username = (data.get("username") or "").strip() or None
    password = (data.get("password") or "").strip() or None

    if not PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400
    if not code:
        return jsonify({"error": "请输入验证码"}), 400

    if not verify_sms_code(phone, code):
        return jsonify({"error": "验证码错误或已过期"}), 400

    if User.query.filter_by(phone=phone).first():
        return jsonify({"error": "该手机号已注册"}), 409

    if username and User.query.filter_by(username=username).first():
        return jsonify({"error": "用户名已被占用"}), 409

    user = _create_user_with_bonus(username=username, phone=phone, password=password)
    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": {"user": user.to_dict(), **tokens}}), 201


@auth_bp.route("/register/password", methods=["POST"])
def register_password():
    """Register a regular user using username + password."""
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username:
        return jsonify({"error": "请输入用户名"}), 400
    if len(username) < 3:
        return jsonify({"error": "用户名至少 3 个字符"}), 400
    if not password:
        return jsonify({"error": "请输入密码"}), 400
    if len(password) < 6:
        return jsonify({"error": "密码至少 6 位"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "用户名已被占用"}), 409

    user = _create_user_with_bonus(username=username, password=password)
    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": {"user": user.to_dict(), **tokens}}), 201


@auth_bp.route("/login/phone", methods=["POST"])
def login_phone():
    data = request.get_json() or {}
    phone = (data.get("phone") or "").strip()
    code = (data.get("code") or "").strip()

    if not PHONE_RE.match(phone):
        return jsonify({"error": "手机号格式不正确"}), 400
    if not code:
        return jsonify({"error": "请输入验证码"}), 400

    if not verify_sms_code(phone, code):
        return jsonify({"error": "验证码错误或已过期"}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user:
        user = _create_user_with_bonus(phone=phone)

    if not user.is_active:
        return jsonify({"error": "账号已被禁用"}), 403

    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": {"user": user.to_dict(), **tokens}})


@auth_bp.route("/login/password", methods=["POST"])
def login_password():
    data = request.get_json() or {}
    login_id = (data.get("username") or data.get("phone") or "").strip()
    password = (data.get("password") or "").strip()

    if not login_id or not password:
        return jsonify({"error": "请输入账号和密码"}), 400

    user = User.query.filter((User.username == login_id) | (User.phone == login_id)).first()

    if not user or not user.password_hash:
        return jsonify({"error": "账号或密码错误"}), 401

    if not _check_password(password, user.password_hash):
        return jsonify({"error": "账号或密码错误"}), 401

    if not user.is_active:
        return jsonify({"error": "账号已被禁用"}), 403

    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": {"user": user.to_dict(), **tokens}})


@auth_bp.route("/refresh", methods=["POST"])
def refresh_token():
    data = request.get_json() or {}
    token = (data.get("refresh_token") or "").strip()
    if not token:
        return jsonify({"error": "refresh_token required"}), 400
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id = token_user_id(payload)
    except Exception:
        return jsonify({"error": "Invalid or expired refresh token"}), 401

    user = User.query.get(user_id)
    if not user or not user.is_active:
        return jsonify({"error": "User not found or disabled"}), 401

    tokens = generate_tokens(user.id, user.role)
    return jsonify({"data": tokens})


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    return jsonify({"data": {"message": "Logged out"}})
