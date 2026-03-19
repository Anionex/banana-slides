"""Authentication middleware for protecting API routes."""
import logging
from functools import wraps
from typing import Optional

from flask import g, request
from utils.response import error_response

logger = logging.getLogger(__name__)


def extract_access_token(allow_query: bool = False) -> str:
    """
    Extract access token from request.

    By default, only the Authorization header is accepted. Query-string tokens
    are allowed for private file/image requests where browsers cannot attach a
    Bearer header to plain <img src> requests.
    """
    auth_header = request.headers.get('Authorization', '')

    if auth_header:
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        return auth_header

    if allow_query:
        return (request.args.get('access_token', '') or '').strip()

    return ''


def authenticate_request(allow_query: bool = False):
    """
    Authenticate current request and return (user, error_response).

    The response item is None on success.
    """
    from services.auth_service import AuthService

    token = extract_access_token(allow_query=allow_query)

    if not token:
        logger.debug("No access token provided")
        return None, error_response('UNAUTHORIZED', '请先登录', 401)

    user = AuthService.verify_access_token(token)

    if not user:
        logger.debug("Invalid or expired token")
        return None, error_response('UNAUTHORIZED', '登录已过期，请重新登录', 401)

    if not user.is_active:
        logger.warning(f"Inactive user attempted access: {user.id}")
        return None, error_response('FORBIDDEN', '账户已被禁用', 403)

    g.current_user = user
    return user, None


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
        _, auth_error = authenticate_request(allow_query=False)
        if auth_error:
            return auth_error
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
        user, _ = authenticate_request(allow_query=False)
        if user:
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
