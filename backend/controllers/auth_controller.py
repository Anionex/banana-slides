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
from utils.decorators import login_required
from models.user import User

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
    Register a new user
    
    Request body:
    {
        "username": "string",
        "email": "string",
        "password": "string"
    }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
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
