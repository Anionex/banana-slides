"""
Authentication middleware for protecting API routes
"""
import logging
from functools import wraps
from typing import Optional

from flask import g, request
from utils.response import error_response

logger = logging.getLogger(__name__)


def get_current_user():
    """
    Get the current authenticated user from Flask's g object.
    
    Returns:
        User object if authenticated, None otherwise
    """
    return getattr(g, 'current_user', None)


def auth_required(f):
    """
    Decorator that requires authentication for an endpoint.
    
    Usage:
        @app.route('/api/projects')
        @auth_required
        def list_projects():
            user = get_current_user()
            # ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        from services.auth_service import AuthService
        
        # Extract token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header:
            logger.debug("No Authorization header provided")
            return error_response('UNAUTHORIZED', '请先登录', 401)
        
        # Support "Bearer <token>" format
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            token = auth_header
        
        if not token:
            logger.debug("Empty token in Authorization header")
            return error_response('UNAUTHORIZED', '请先登录', 401)
        
        # Verify token and get user
        user = AuthService.verify_access_token(token)
        
        if not user:
            logger.debug("Invalid or expired token")
            return error_response('UNAUTHORIZED', '登录已过期，请重新登录', 401)
        
        if not user.is_active:
            logger.warning(f"Inactive user attempted access: {user.id}")
            return error_response('FORBIDDEN', '账户已被禁用', 403)
        
        # Store user in Flask's g object for access in route handlers
        g.current_user = user
        
        return f(*args, **kwargs)
    
    return decorated


def optional_auth(f):
    """
    Decorator that optionally authenticates a user but doesn't require it.
    Useful for endpoints that work differently for authenticated vs anonymous users.
    
    Usage:
        @app.route('/api/public-resource')
        @optional_auth
        def get_resource():
            user = get_current_user()  # May be None
            # ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        from services.auth_service import AuthService
        
        # Extract token from Authorization header
        auth_header = request.headers.get('Authorization', '')
        
        if auth_header:
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
            else:
                token = auth_header
            
            if token:
                user = AuthService.verify_access_token(token)
                if user and user.is_active:
                    g.current_user = user
        
        return f(*args, **kwargs)
    
    return decorated


def email_verified_required(f):
    """
    Decorator that requires the user to have verified their email.
    Must be used after @auth_required.

    Usage:
        @app.route('/api/premium-feature')
        @auth_required
        @email_verified_required
        def premium_feature():
            # ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()

        if not user:
            return error_response('UNAUTHORIZED', '请先登录', 401)

        if not user.email_verified:
            return error_response('EMAIL_NOT_VERIFIED', '请先验证您的邮箱', 403)

        return f(*args, **kwargs)

    return decorated


def admin_required(f):
    """
    Decorator that requires the user to be an admin.
    Must be used after @auth_required.

    Usage:
        @app.route('/api/admin/resource')
        @auth_required
        @admin_required
        def admin_resource():
            # ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()

        if not user:
            return error_response('UNAUTHORIZED', '请先登录', 401)

        if not user.is_admin:
            return error_response('FORBIDDEN', '需要管理员权限', 403)

        return f(*args, **kwargs)

    return decorated
