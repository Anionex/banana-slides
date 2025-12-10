"""
Authentication controller for user registration, login, logout, and OAuth
"""
import os
import logging
from flask import Blueprint, request, jsonify, redirect, url_for
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    get_jwt,
    create_access_token,
)
from authlib.integrations.flask_client import OAuth

from services.auth_service import auth_service
from services.email_service import email_service
from utils.decorators import login_required
from models.user import User
from models.verification_code import VerificationCode

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

# OAuth setup (will be initialized in init_oauth)
oauth = OAuth()


def init_oauth(app):
    """Initialize OAuth with the Flask app"""
    oauth.init_app(app)
    
    # Google OAuth
    google_client_id = os.getenv('GOOGLE_CLIENT_ID')
    google_client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    
    if google_client_id and google_client_secret:
        oauth.register(
            name='google',
            client_id=google_client_id,
            client_secret=google_client_secret,
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={'scope': 'openid email profile'},
        )
        logger.info("Google OAuth configured")
    else:
        logger.warning("Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")
    
    # GitHub OAuth
    github_client_id = os.getenv('GITHUB_CLIENT_ID')
    github_client_secret = os.getenv('GITHUB_CLIENT_SECRET')
    
    if github_client_id and github_client_secret:
        oauth.register(
            name='github',
            client_id=github_client_id,
            client_secret=github_client_secret,
            authorize_url='https://github.com/login/oauth/authorize',
            access_token_url='https://github.com/login/oauth/access_token',
            api_base_url='https://api.github.com/',
            client_kwargs={'scope': 'user:email'},
        )
        logger.info("GitHub OAuth configured")
    else:
        logger.warning("GitHub OAuth not configured: missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET")


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user with email verification code
    
    Request body:
    {
        "username": "string",
        "email": "string",
        "password": "string",
        "verification_code": "string"  # 6-digit code from email
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    verification_code = data.get('verification_code', '').strip()
    
    # Verify the email verification code
    if not verification_code:
        return jsonify({'error': '请输入邮箱验证码'}), 400
    
    is_valid, error_msg = VerificationCode.verify_code(
        email=email,
        code=verification_code,
        code_type=VerificationCode.TYPE_REGISTER
    )
    
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    
    user, error = auth_service.register_user(username, email, password)
    
    if error:
        return jsonify({'error': error}), 400
    
    # Auto-login after registration
    tokens = auth_service.create_tokens(user, remember_me=False)
    
    return jsonify({
        'message': 'Registration successful',
        'user': user.to_dict(include_email=True),
        **tokens,
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login with email and password
    
    Request body:
    {
        "email": "string",
        "password": "string",
        "remember_me": boolean (optional)
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    email = data.get('email', '').strip()
    password = data.get('password', '')
    remember_me = data.get('remember_me', False)
    
    user, error = auth_service.login_user(email, password)
    
    if error:
        return jsonify({'error': error}), 401
    
    tokens = auth_service.create_tokens(user, remember_me=remember_me)
    
    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict(include_email=True),
        **tokens,
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """
    Logout the current user
    Note: With JWT, logout is mainly handled client-side by discarding the token
    This endpoint can be used for audit logging or token blacklisting in the future
    """
    # For now, just acknowledge the logout
    # In a production system, you might want to blacklist the token
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh the access token using a refresh token
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is disabled'}), 403
    
    # Create new access token
    additional_claims = {
        'username': user.username,
        'role': user.role,
    }
    
    access_token = create_access_token(
        identity=user_id,
        additional_claims=additional_claims,
    )
    
    return jsonify({
        'access_token': access_token,
        'token_type': 'Bearer',
    }), 200


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """
    Get the current authenticated user's information
    """
    from flask import g
    return jsonify({
        'user': g.current_user.to_dict(include_email=True),
    }), 200


# ============== Verification Code Routes ==============

@auth_bp.route('/send-code', methods=['POST'])
def send_verification_code():
    """
    Send a verification code to the specified email
    
    Request body:
    {
        "email": "string",
        "code_type": "register" | "reset_password"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    email = data.get('email', '').strip().lower()
    code_type = data.get('code_type', '').strip()
    
    # Validate email
    if not email or '@' not in email:
        return jsonify({'error': '请输入有效的邮箱地址'}), 400
    
    # Validate code type
    valid_types = [VerificationCode.TYPE_REGISTER, VerificationCode.TYPE_RESET_PASSWORD]
    if code_type not in valid_types:
        return jsonify({'error': '无效的验证码类型'}), 400
    
    # Check if email service is configured
    if not email_service.is_configured():
        return jsonify({'error': '邮件服务未配置，请联系管理员'}), 503
    
    # For register: check if email is already registered
    if code_type == VerificationCode.TYPE_REGISTER:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': '该邮箱已被注册'}), 400
    
    # For reset password: check if email exists
    if code_type == VerificationCode.TYPE_RESET_PASSWORD:
        existing_user = User.query.filter_by(email=email).first()
        if not existing_user:
            # Don't reveal that email doesn't exist (security)
            # Still return success but don't send email
            return jsonify({'message': '验证码已发送，请检查您的邮箱'}), 200
    
    # Rate limiting check
    can_send, wait_seconds = VerificationCode.can_send_code(email, code_type)
    if not can_send:
        return jsonify({
            'error': f'发送过于频繁，请 {wait_seconds} 秒后重试',
            'wait_seconds': wait_seconds,
        }), 429
    
    # Generate and save verification code
    verification = VerificationCode.create_code(email, code_type)
    
    # Send email
    success, error_msg = email_service.send_verification_code(
        to_email=email,
        code=verification.code,
        code_type=code_type,
        expires_minutes=VerificationCode.EXPIRY_MINUTES,
    )
    
    if not success:
        logger.error(f"Failed to send verification code to {email}: {error_msg}")
        return jsonify({'error': f'邮件发送失败: {error_msg}'}), 500
    
    return jsonify({
        'message': '验证码已发送，请检查您的邮箱',
        'expires_in': VerificationCode.EXPIRY_MINUTES * 60,  # seconds
    }), 200


@auth_bp.route('/verify-code', methods=['POST'])
def verify_code():
    """
    Verify a verification code (for checking before form submission)
    
    Request body:
    {
        "email": "string",
        "code": "string",
        "code_type": "register" | "reset_password"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    code_type = data.get('code_type', '').strip()
    
    if not email or not code or not code_type:
        return jsonify({'error': '请提供完整的验证信息'}), 400
    
    # Note: This endpoint does NOT consume the code
    # It only checks if it's valid for pre-validation
    verification = VerificationCode.query.filter_by(
        email=email,
        code_type=code_type,
        used=False,
    ).order_by(VerificationCode.created_at.desc()).first()
    
    if not verification:
        return jsonify({'valid': False, 'error': '验证码不存在或已过期'}), 200
    
    from datetime import datetime
    if datetime.utcnow() > verification.expires_at:
        return jsonify({'valid': False, 'error': '验证码已过期'}), 200
    
    if verification.code != code:
        return jsonify({'valid': False, 'error': '验证码错误'}), 200
    
    return jsonify({'valid': True}), 200


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Reset password using verification code
    
    Request body:
    {
        "email": "string",
        "verification_code": "string",
        "new_password": "string"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    email = data.get('email', '').strip().lower()
    verification_code = data.get('verification_code', '').strip()
    new_password = data.get('new_password', '')
    
    if not email or not verification_code or not new_password:
        return jsonify({'error': '请提供完整信息'}), 400
    
    # Validate new password
    if len(new_password) < 6:
        return jsonify({'error': '密码长度不能少于6位'}), 400
    
    # Verify the code
    is_valid, error_msg = VerificationCode.verify_code(
        email=email,
        code=verification_code,
        code_type=VerificationCode.TYPE_RESET_PASSWORD
    )
    
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    
    # Find user and update password
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    
    user.set_password(new_password)
    from models import db
    db.session.commit()
    
    logger.info(f"Password reset successful for user {user.id}")
    
    return jsonify({'message': '密码重置成功，请使用新密码登录'}), 200


# ============== OAuth Routes ==============

@auth_bp.route('/google', methods=['GET'])
def google_login():
    """
    Initiate Google OAuth login
    """
    if 'google' not in oauth._clients:
        return jsonify({'error': 'Google OAuth is not configured'}), 501
    
    # Callback goes to backend first, then backend redirects to frontend with tokens
    backend_base = os.getenv('BACKEND_URL', 'http://localhost:5000')
    redirect_uri = f"{backend_base}/api/auth/google/callback"
    return oauth.google.authorize_redirect(redirect_uri)


@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """
    Handle Google OAuth callback
    """
    if 'google' not in oauth._clients:
        return jsonify({'error': 'Google OAuth is not configured'}), 501
    
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo')
        
        if not user_info:
            user_info = oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo').json()
        
        user, error = auth_service.get_or_create_oauth_user(
            provider='google',
            oauth_id=user_info['sub'],
            email=user_info['email'],
            username=user_info.get('name', user_info['email'].split('@')[0]),
            avatar_url=user_info.get('picture'),
        )
        
        if error:
            # Redirect to frontend with error
            frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
            return redirect(f"{frontend_url}/login?error={error}")
        
        # Create tokens
        tokens = auth_service.create_tokens(user, remember_me=True)
        
        # Redirect to frontend with tokens
        frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
        return redirect(
            f"{frontend_url}/auth/callback"
            f"?access_token={tokens['access_token']}"
            f"&refresh_token={tokens['refresh_token']}"
        )
        
    except Exception as e:
        logger.error(f"Google OAuth callback error: {e}")
        frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
        return redirect(f"{frontend_url}/login?error=OAuth+failed")


@auth_bp.route('/github', methods=['GET'])
def github_login():
    """
    Initiate GitHub OAuth login
    """
    if 'github' not in oauth._clients:
        return jsonify({'error': 'GitHub OAuth is not configured'}), 501
    
    # Callback goes to backend first, then backend redirects to frontend with tokens
    backend_base = os.getenv('BACKEND_URL', 'http://localhost:5000')
    redirect_uri = f"{backend_base}/api/auth/github/callback"
    return oauth.github.authorize_redirect(redirect_uri)


@auth_bp.route('/github/callback', methods=['GET'])
def github_callback():
    """
    Handle GitHub OAuth callback
    """
    if 'github' not in oauth._clients:
        return jsonify({'error': 'GitHub OAuth is not configured'}), 501
    
    try:
        token = oauth.github.authorize_access_token()
        
        # Get user info
        resp = oauth.github.get('user')
        user_info = resp.json()
        
        # Get email (might be private)
        email = user_info.get('email')
        if not email:
            # Try to get from emails endpoint
            emails_resp = oauth.github.get('user/emails')
            emails = emails_resp.json()
            for e in emails:
                if e.get('primary') and e.get('verified'):
                    email = e['email']
                    break
        
        if not email:
            frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
            return redirect(f"{frontend_url}/login?error=Email+not+available")
        
        user, error = auth_service.get_or_create_oauth_user(
            provider='github',
            oauth_id=str(user_info['id']),
            email=email,
            username=user_info.get('login', email.split('@')[0]),
            avatar_url=user_info.get('avatar_url'),
        )
        
        if error:
            frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
            return redirect(f"{frontend_url}/login?error={error}")
        
        # Create tokens
        tokens = auth_service.create_tokens(user, remember_me=True)
        
        # Redirect to frontend with tokens
        frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
        return redirect(
            f"{frontend_url}/auth/callback"
            f"?access_token={tokens['access_token']}"
            f"&refresh_token={tokens['refresh_token']}"
        )
        
    except Exception as e:
        logger.error(f"GitHub OAuth callback error: {e}")
        frontend_url = os.getenv('OAUTH_REDIRECT_BASE', 'http://localhost:3000')
        return redirect(f"{frontend_url}/login?error=OAuth+failed")
