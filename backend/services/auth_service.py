"""
Authentication service for user management, JWT tokens, and email verification
"""
import os
import logging
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any

from models import db, User
from utils.security import (
    hash_password, 
    verify_password, 
    generate_verification_token,
    generate_password_reset_token,
    is_token_expired
)

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication and user management"""
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    JWT_ALGORITHM = 'HS256'
    ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 hour
    REFRESH_TOKEN_EXPIRES = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 604800))  # 7 days
    
    # ==================== User Registration ====================
    
    @staticmethod
    def register(email: str, password: str, username: Optional[str] = None) -> Tuple[Optional[User], Optional[str]]:
        """
        Register a new user.
        
        Args:
            email: User's email address
            password: Plain text password
            username: Optional username
            
        Returns:
            Tuple of (User, error_message). User is None if registration failed.
        """
        # Validate email
        email = email.lower().strip()
        if not email or '@' not in email:
            return None, "邮箱格式不正确"
        
        # Validate password
        if len(password) < 8:
            return None, "密码长度不能少于8位"
        
        # Check if email already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return None, "该邮箱已被注册"
        
        try:
            # Generate verification token
            verification_token, verification_expires = generate_verification_token()
            
            # Create user
            user = User(
                email=email,
                password_hash=hash_password(password),
                username=username,
                verification_token=verification_token,
                verification_token_expires=verification_expires,
                email_verified=False,
                subscription_plan='free',
                ai_calls_reset_at=datetime.now(timezone.utc)
            )
            
            db.session.add(user)
            db.session.commit()
            
            logger.info(f"User registered: {user.id} ({email})")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Registration failed for {email}: {e}")
            return None, "注册失败，请稍后重试"
    
    # ==================== User Login ====================
    
    @staticmethod
    def login(email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Authenticate a user with email and password.
        
        Args:
            email: User's email address
            password: Plain text password
            
        Returns:
            Tuple of (User, error_message). User is None if login failed.
        """
        email = email.lower().strip()
        
        user = User.query.filter_by(email=email).first()
        
        if not user:
            logger.debug(f"Login failed: user not found for {email}")
            return None, "邮箱或密码错误"
        
        if not verify_password(password, user.password_hash):
            logger.debug(f"Login failed: incorrect password for {email}")
            return None, "邮箱或密码错误"
        
        if not user.is_active:
            logger.warning(f"Login failed: inactive account {email}")
            return None, "账户已被禁用"
        
        # Update last login time
        user.last_login_at = datetime.now(timezone.utc)
        db.session.commit()
        
        logger.info(f"User logged in: {user.id} ({email})")
        return user, None
    
    # ==================== JWT Token Management ====================
    
    @classmethod
    def generate_access_token(cls, user: User) -> str:
        """
        Generate a JWT access token for a user.
        
        Args:
            user: User object
            
        Returns:
            JWT token string
        """
        now = datetime.now(timezone.utc)
        payload = {
            'sub': user.id,
            'email': user.email,
            'type': 'access',
            'iat': now,
            'exp': now + timedelta(seconds=cls.ACCESS_TOKEN_EXPIRES)
        }
        return jwt.encode(payload, cls.JWT_SECRET_KEY, algorithm=cls.JWT_ALGORITHM)
    
    @classmethod
    def generate_refresh_token(cls, user: User) -> str:
        """
        Generate a JWT refresh token for a user.
        
        Args:
            user: User object
            
        Returns:
            JWT token string
        """
        now = datetime.now(timezone.utc)
        payload = {
            'sub': user.id,
            'type': 'refresh',
            'iat': now,
            'exp': now + timedelta(seconds=cls.REFRESH_TOKEN_EXPIRES)
        }
        return jwt.encode(payload, cls.JWT_SECRET_KEY, algorithm=cls.JWT_ALGORITHM)
    
    @classmethod
    def generate_tokens(cls, user: User) -> Dict[str, Any]:
        """
        Generate both access and refresh tokens for a user.
        
        Args:
            user: User object
            
        Returns:
            Dict with access_token, refresh_token, and expires_in
        """
        return {
            'access_token': cls.generate_access_token(user),
            'refresh_token': cls.generate_refresh_token(user),
            'token_type': 'Bearer',
            'expires_in': cls.ACCESS_TOKEN_EXPIRES
        }
    
    @classmethod
    def verify_access_token(cls, token: str) -> Optional[User]:
        """
        Verify an access token and return the associated user.
        
        Args:
            token: JWT token string
            
        Returns:
            User object if token is valid, None otherwise
        """
        try:
            payload = jwt.decode(token, cls.JWT_SECRET_KEY, algorithms=[cls.JWT_ALGORITHM])
            
            if payload.get('type') != 'access':
                logger.debug("Token type is not 'access'")
                return None
            
            user_id = payload.get('sub')
            if not user_id:
                logger.debug("No user ID in token payload")
                return None
            
            user = User.query.get(user_id)
            return user
            
        except jwt.ExpiredSignatureError:
            logger.debug("Access token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid access token: {e}")
            return None
    
    @classmethod
    def verify_refresh_token(cls, token: str) -> Optional[User]:
        """
        Verify a refresh token and return the associated user.
        
        Args:
            token: JWT token string
            
        Returns:
            User object if token is valid, None otherwise
        """
        try:
            payload = jwt.decode(token, cls.JWT_SECRET_KEY, algorithms=[cls.JWT_ALGORITHM])
            
            if payload.get('type') != 'refresh':
                logger.debug("Token type is not 'refresh'")
                return None
            
            user_id = payload.get('sub')
            if not user_id:
                logger.debug("No user ID in token payload")
                return None
            
            user = User.query.get(user_id)
            return user
            
        except jwt.ExpiredSignatureError:
            logger.debug("Refresh token expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.debug(f"Invalid refresh token: {e}")
            return None
    
    @classmethod
    def refresh_access_token(cls, refresh_token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Generate new tokens using a refresh token.
        
        Args:
            refresh_token: JWT refresh token string
            
        Returns:
            Tuple of (tokens_dict, error_message)
        """
        user = cls.verify_refresh_token(refresh_token)
        
        if not user:
            return None, "刷新令牌无效或已过期"
        
        if not user.is_active:
            return None, "账户已被禁用"
        
        return cls.generate_tokens(user), None
    
    # ==================== Email Verification ====================
    
    @staticmethod
    def verify_email(token: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Verify a user's email using the verification token.
        
        Args:
            token: Verification token from email
            
        Returns:
            Tuple of (User, error_message)
        """
        user = User.query.filter_by(verification_token=token).first()
        
        if not user:
            return None, "验证链接无效"
        
        if is_token_expired(user.verification_token_expires):
            return None, "验证链接已过期，请重新发送"
        
        if user.email_verified:
            return user, None  # Already verified, return success
        
        try:
            user.email_verified = True
            user.verification_token = None
            user.verification_token_expires = None
            db.session.commit()
            
            logger.info(f"Email verified for user: {user.id}")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Email verification failed: {e}")
            return None, "验证失败，请稍后重试"
    
    @staticmethod
    def resend_verification_email(email: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Resend the verification email with a new token.
        
        Args:
            email: User's email address
            
        Returns:
            Tuple of (User, error_message)
        """
        email = email.lower().strip()
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return None, "用户不存在"
        
        if user.email_verified:
            return None, "邮箱已验证"
        
        try:
            verification_token, verification_expires = generate_verification_token()
            user.verification_token = verification_token
            user.verification_token_expires = verification_expires
            db.session.commit()
            
            logger.info(f"Verification token regenerated for user: {user.id}")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to regenerate verification token: {e}")
            return None, "操作失败，请稍后重试"
    
    # ==================== Password Reset ====================
    
    @staticmethod
    def request_password_reset(email: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Request a password reset for a user.
        
        Args:
            email: User's email address
            
        Returns:
            Tuple of (User, error_message)
        """
        email = email.lower().strip()
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # Don't reveal whether email exists
            return None, None
        
        try:
            reset_token, reset_expires = generate_password_reset_token()
            user.password_reset_token = reset_token
            user.password_reset_expires = reset_expires
            db.session.commit()
            
            logger.info(f"Password reset requested for user: {user.id}")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to create password reset token: {e}")
            return None, "操作失败，请稍后重试"
    
    @staticmethod
    def reset_password(token: str, new_password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Reset a user's password using the reset token.
        
        Args:
            token: Password reset token
            new_password: New plain text password
            
        Returns:
            Tuple of (User, error_message)
        """
        if len(new_password) < 8:
            return None, "密码长度不能少于8位"
        
        user = User.query.filter_by(password_reset_token=token).first()
        
        if not user:
            return None, "重置链接无效"
        
        if is_token_expired(user.password_reset_expires):
            return None, "重置链接已过期"
        
        try:
            user.password_hash = hash_password(new_password)
            user.password_reset_token = None
            user.password_reset_expires = None
            db.session.commit()
            
            logger.info(f"Password reset successful for user: {user.id}")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Password reset failed: {e}")
            return None, "重置失败，请稍后重试"
    
    # ==================== Password Change ====================
    
    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """
        Change a user's password.
        
        Args:
            user: User object
            current_password: Current plain text password
            new_password: New plain text password
            
        Returns:
            Tuple of (success, error_message)
        """
        if not verify_password(current_password, user.password_hash):
            return False, "当前密码错误"
        
        if len(new_password) < 8:
            return False, "新密码长度不能少于8位"
        
        try:
            user.password_hash = hash_password(new_password)
            db.session.commit()
            
            logger.info(f"Password changed for user: {user.id}")
            return True, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Password change failed: {e}")
            return False, "修改失败，请稍后重试"
