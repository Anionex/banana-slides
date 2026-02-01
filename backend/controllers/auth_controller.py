"""
Authentication Controller - handles auth-related API endpoints
"""
import os
import logging
from flask import Blueprint, request

from services.auth_service import AuthService
from services.email_service import email_service
from middlewares.auth import auth_required, get_current_user
from utils.response import success_response, error_response, bad_request

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def _get_frontend_url() -> str:
    """Get the frontend base URL for email links."""
    return os.getenv('FRONTEND_URL', 'http://localhost:5173')


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    POST /api/auth/register - Register a new user
    
    Request body:
    {
        "email": "user@example.com",
        "password": "password123",
        "username": "optional_username"
    }
    
    Returns:
    {
        "data": {
            "user": {...},
            "access_token": "...",
            "refresh_token": "...",
            "token_type": "Bearer",
            "expires_in": 3600,
            "message": "注册成功，请查收验证邮件"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        username = data.get('username', '').strip() or None
        
        if not email:
            return bad_request("邮箱不能为空")
        
        if not password:
            return bad_request("密码不能为空")
        
        # Register user
        user, error = AuthService.register(email, password, username)
        
        if error:
            return error_response('REGISTRATION_FAILED', error, 400)
        
        # Generate tokens
        tokens = AuthService.generate_tokens(user)
        
        # Send verification email (只有在非开发模式下才发送)
        skip_verification = os.getenv('SKIP_EMAIL_VERIFICATION', 'false').lower() == 'true'
        
        if not skip_verification and user.verification_token:
            verification_url = f"{_get_frontend_url()}/verify-email?token={user.verification_token}"
            email_sent = email_service.send_verification_email(
                to=user.email,
                username=user.username or user.email.split('@')[0],
                verification_url=verification_url
            )
            
            if not email_sent:
                logger.warning(f"Failed to send verification email to {user.email}")
            
            message = '注册成功，请查收验证邮件'
        else:
            message = '注册成功'
        
        logger.info(f"User registered successfully: {user.id}")
        
        return success_response({
            'user': user.to_dict(),
            **tokens,
            'message': message
        }, status_code=201)
    
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '注册失败，请稍后重试', 500)


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    POST /api/auth/login - User login
    
    Request body:
    {
        "email": "user@example.com",
        "password": "password123",
        "remember_me": false  // optional, default false
    }
    
    Returns:
    {
        "data": {
            "user": {...},
            "access_token": "...",
            "refresh_token": "...",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_expires_in": 604800  // 7 days or 30 days if remember_me
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)
        
        if not email or not password:
            return bad_request("邮箱和密码不能为空")
        
        # Authenticate user
        user, error = AuthService.login(email, password)
        
        if error:
            return error_response('LOGIN_FAILED', error, 401)
        
        # Generate tokens (with longer expiry if remember_me)
        tokens = AuthService.generate_tokens(user, remember_me=remember_me)
        
        logger.info(f"User logged in: {user.id} (remember_me={remember_me})")
        
        return success_response({
            'user': user.to_dict(),
            **tokens
        })
    
    except Exception as e:
        logger.error(f"Login error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '登录失败，请稍后重试', 500)


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """
    POST /api/auth/refresh - Refresh access token
    
    Request body:
    {
        "refresh_token": "..."
    }
    
    Returns:
    {
        "data": {
            "access_token": "...",
            "refresh_token": "...",
            "token_type": "Bearer",
            "expires_in": 3600
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        refresh_token = data.get('refresh_token', '')
        
        if not refresh_token:
            return bad_request("refresh_token 不能为空")
        
        # Refresh tokens
        tokens, error = AuthService.refresh_access_token(refresh_token)
        
        if error:
            return error_response('REFRESH_FAILED', error, 401)
        
        return success_response(tokens)
    
    except Exception as e:
        logger.error(f"Token refresh error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '刷新失败，请稍后重试', 500)


@auth_bp.route('/me', methods=['GET'])
@auth_required
def get_current_user_info():
    """
    GET /api/auth/me - Get current user info
    
    Requires: Authorization header with Bearer token
    
    Returns:
    {
        "data": {
            "user": {...}
        }
    }
    """
    try:
        user = get_current_user()
        return success_response({'user': user.to_dict()})
    
    except Exception as e:
        logger.error(f"Get user info error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '获取用户信息失败', 500)


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """
    POST /api/auth/verify-email - Verify email with token
    
    Request body:
    {
        "token": "verification_token"
    }
    
    Returns:
    {
        "data": {
            "message": "邮箱验证成功"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        token = data.get('token', '')
        
        if not token:
            return bad_request("验证令牌不能为空")
        
        user, error = AuthService.verify_email(token)
        
        if error:
            return error_response('VERIFICATION_FAILED', error, 400)
        
        logger.info(f"Email verified for user: {user.id}")
        
        return success_response({'message': '邮箱验证成功'})
    
    except Exception as e:
        logger.error(f"Email verification error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '验证失败，请稍后重试', 500)


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """
    POST /api/auth/resend-verification - Resend verification email
    
    Request body:
    {
        "email": "user@example.com"
    }
    
    Returns:
    {
        "data": {
            "message": "验证邮件已发送"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        email = data.get('email', '').strip()
        
        if not email:
            return bad_request("邮箱不能为空")
        
        user, error = AuthService.resend_verification_email(email)
        
        if error:
            return error_response('RESEND_FAILED', error, 400)
        
        # Send verification email
        verification_url = f"{_get_frontend_url()}/verify-email?token={user.verification_token}"
        email_sent = email_service.send_verification_email(
            to=user.email,
            username=user.username or user.email.split('@')[0],
            verification_url=verification_url
        )
        
        if not email_sent:
            logger.warning(f"Failed to send verification email to {user.email}")
        
        return success_response({'message': '验证邮件已发送'})
    
    except Exception as e:
        logger.error(f"Resend verification error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '发送失败，请稍后重试', 500)


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    POST /api/auth/forgot-password - Request password reset
    
    Request body:
    {
        "email": "user@example.com"
    }
    
    Returns:
    {
        "data": {
            "message": "如果该邮箱已注册，您将收到重置密码的邮件"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        email = data.get('email', '').strip()
        
        if not email:
            return bad_request("邮箱不能为空")
        
        user, error = AuthService.request_password_reset(email)
        
        if user:
            # Send password reset email
            reset_url = f"{_get_frontend_url()}/reset-password?token={user.password_reset_token}"
            email_sent = email_service.send_password_reset_email(
                to=user.email,
                username=user.username or user.email.split('@')[0],
                reset_url=reset_url
            )
            
            if not email_sent:
                logger.warning(f"Failed to send password reset email to {user.email}")
        
        # Always return success to prevent email enumeration
        return success_response({'message': '如果该邮箱已注册，您将收到重置密码的邮件'})
    
    except Exception as e:
        logger.error(f"Forgot password error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '操作失败，请稍后重试', 500)


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    POST /api/auth/reset-password - Reset password with token
    
    Request body:
    {
        "token": "reset_token",
        "password": "new_password"
    }
    
    Returns:
    {
        "data": {
            "message": "密码重置成功"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        token = data.get('token', '')
        password = data.get('password', '')
        
        if not token:
            return bad_request("重置令牌不能为空")
        
        if not password:
            return bad_request("新密码不能为空")
        
        user, error = AuthService.reset_password(token, password)
        
        if error:
            return error_response('RESET_FAILED', error, 400)
        
        logger.info(f"Password reset for user: {user.id}")
        
        return success_response({'message': '密码重置成功'})
    
    except Exception as e:
        logger.error(f"Reset password error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '重置失败，请稍后重试', 500)


@auth_bp.route('/change-password', methods=['POST'])
@auth_required
def change_password():
    """
    POST /api/auth/change-password - Change password (requires authentication)
    
    Request body:
    {
        "current_password": "old_password",
        "new_password": "new_password"
    }
    
    Returns:
    {
        "data": {
            "message": "密码修改成功"
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return bad_request("请求体不能为空")
        
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password:
            return bad_request("当前密码不能为空")
        
        if not new_password:
            return bad_request("新密码不能为空")
        
        user = get_current_user()
        success, error = AuthService.change_password(user, current_password, new_password)
        
        if error:
            return error_response('CHANGE_FAILED', error, 400)
        
        return success_response({'message': '密码修改成功'})
    
    except Exception as e:
        logger.error(f"Change password error: {e}", exc_info=True)
        return error_response('SERVER_ERROR', '修改失败，请稍后重试', 500)
