"""JWT utilities and auth decorators"""
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g


def _secret():
    return os.getenv('JWT_SECRET_KEY', 'dev-secret-change-in-production')


def generate_tokens(user_id: int, role: str) -> dict:
    now = datetime.utcnow()
    access_payload = {
        'sub': user_id,
        'role': role,
        'iat': now,
        'exp': now + timedelta(hours=1),
        'type': 'access',
    }
    refresh_payload = {
        'sub': user_id,
        'iat': now,
        'exp': now + timedelta(days=7),
        'type': 'refresh',
    }
    return {
        'access_token': jwt.encode(access_payload, _secret(), algorithm='HS256'),
        'refresh_token': jwt.encode(refresh_payload, _secret(), algorithm='HS256'),
    }


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=['HS256'])


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            if payload.get('type') != 'access':
                raise ValueError('Not an access token')
        except Exception:
            return jsonify({'error': 'Invalid or expired token'}), 401
        from models import User
        user = User.query.get(payload['sub'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or disabled'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Like require_auth but doesn't fail if no token — sets g.current_user to None."""
    @wraps(f)
    def decorated(*args, **kwargs):
        g.current_user = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                payload = decode_token(token)
                if payload.get('type') == 'access':
                    from models import User
                    user = User.query.get(payload['sub'])
                    if user and user.is_active:
                        g.current_user = user
            except Exception:
                pass
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            if payload.get('type') != 'access':
                raise ValueError('Not an access token')
        except Exception:
            return jsonify({'error': 'Invalid or expired token'}), 401
        from models import User
        user = User.query.get(payload['sub'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or disabled'}), 401
        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        g.current_user = user
        return f(*args, **kwargs)
    return decorated
