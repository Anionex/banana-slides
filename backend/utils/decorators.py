"""
Authentication decorators for protecting API routes
"""
from functools import wraps
from flask import g, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt

from models.user import User


def login_required(fn):
    """
    Decorator that requires a valid JWT access token
    Sets g.current_user to the authenticated user
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            if not user.is_active:
                return jsonify({'error': 'Account is disabled'}), 403
            
            g.current_user = user
            return fn(*args, **kwargs)
            
        except Exception as e:
            return jsonify({'error': 'Authentication required', 'message': str(e)}), 401
    
    return wrapper


def admin_required(fn):
    """
    Decorator that requires a valid JWT and admin role
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            
            if not user:
                return jsonify({'error': 'User not found'}), 401
            
            if not user.is_active:
                return jsonify({'error': 'Account is disabled'}), 403
            
            if user.role != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            g.current_user = user
            return fn(*args, **kwargs)
            
        except Exception as e:
            return jsonify({'error': 'Authentication required', 'message': str(e)}), 401
    
    return wrapper


def optional_auth(fn):
    """
    Decorator that optionally authenticates the user
    If a valid JWT is provided, sets g.current_user
    If no JWT or invalid JWT, g.current_user is None
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        g.current_user = None
        
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
            
            if user_id:
                user = User.query.get(user_id)
                if user and user.is_active:
                    g.current_user = user
                    
        except Exception:
            # Ignore authentication errors for optional auth
            pass
        
        return fn(*args, **kwargs)
    
    return wrapper
