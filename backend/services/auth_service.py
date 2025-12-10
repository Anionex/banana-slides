"""
Authentication service for user registration, login, and JWT management
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token

from models import db
from models.user import User
from models.user_settings import UserSettings

logger = logging.getLogger(__name__)


class AuthService:
    """
    Service for handling authentication operations
    """
    
    @staticmethod
    def register_user(username: str, email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Register a new user with email and password
        
        Args:
            username: The desired username
            email: The user's email address
            password: The plaintext password
            
        Returns:
            Tuple of (User object, error message)
        """
        # Validate inputs
        if not username or len(username) < 3:
            return None, "Username must be at least 3 characters"
        
        if not email or '@' not in email:
            return None, "Invalid email address"
        
        if not password or len(password) < 6:
            return None, "Password must be at least 6 characters"
        
        # Check if username already exists
        if User.query.filter_by(username=username).first():
            return None, "Username already taken"
        
        # Check if email already exists
        if User.query.filter_by(email=email).first():
            return None, "Email already registered"
        
        try:
            # Create new user
            user = User(
                username=username,
                email=email.lower(),
            )
            user.set_password(password)
            
            # Create default settings
            settings = UserSettings(user_id=user.id)
            user.settings = settings
            
            db.session.add(user)
            db.session.commit()
            
            logger.info(f"New user registered: {username} ({email})")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to register user: {e}")
            return None, "Registration failed. Please try again."
    
    @staticmethod
    def login_user(email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Authenticate a user with email and password
        
        Args:
            email: The user's email address
            password: The plaintext password
            
        Returns:
            Tuple of (User object, error message)
        """
        if not email or not password:
            return None, "Email and password are required"
        
        user = User.query.filter_by(email=email.lower()).first()
        
        if not user:
            return None, "Invalid email or password"
        
        if not user.is_active:
            return None, "Account is disabled"
        
        if not user.check_password(password):
            return None, "Invalid email or password"
        
        logger.info(f"User logged in: {user.username}")
        return user, None
    
    @staticmethod
    def create_tokens(user: User, remember_me: bool = False) -> dict:
        """
        Create JWT access and refresh tokens for a user
        
        Args:
            user: The authenticated user
            remember_me: If True, use longer expiration times
            
        Returns:
            Dictionary containing access_token and refresh_token
        """
        # Token identity is the user ID
        identity = user.id
        
        # Additional claims
        additional_claims = {
            'username': user.username,
            'role': user.role,
        }
        
        # Create access token (short-lived)
        access_token = create_access_token(
            identity=identity,
            additional_claims=additional_claims,
        )
        
        # Create refresh token (long-lived)
        # If remember_me is True, use a longer expiration
        refresh_expires = timedelta(days=30) if remember_me else timedelta(days=7)
        refresh_token = create_refresh_token(
            identity=identity,
            expires_delta=refresh_expires,
        )
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
        }
    
    @staticmethod
    def get_or_create_oauth_user(
        provider: str,
        oauth_id: str,
        email: str,
        username: str,
        avatar_url: Optional[str] = None
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Get or create a user from OAuth login
        
        Args:
            provider: OAuth provider name (google/github)
            oauth_id: The user's ID from the OAuth provider
            email: The user's email from OAuth
            username: The user's name/username from OAuth
            avatar_url: Optional avatar URL from OAuth
            
        Returns:
            Tuple of (User object, error message)
        """
        try:
            # First, try to find by OAuth provider and ID
            user = User.query.filter_by(
                oauth_provider=provider,
                oauth_id=oauth_id
            ).first()
            
            if user:
                # Update avatar if changed
                if avatar_url and user.avatar_url != avatar_url:
                    user.avatar_url = avatar_url
                    db.session.commit()
                return user, None
            
            # Try to find by email (link existing account)
            user = User.query.filter_by(email=email.lower()).first()
            
            if user:
                # Link OAuth to existing account
                user.oauth_provider = provider
                user.oauth_id = oauth_id
                if avatar_url and not user.avatar_url:
                    user.avatar_url = avatar_url
                db.session.commit()
                logger.info(f"Linked {provider} OAuth to existing user: {user.username}")
                return user, None
            
            # Create new user
            # Ensure unique username
            base_username = username.replace(' ', '_').lower()
            unique_username = base_username
            counter = 1
            while User.query.filter_by(username=unique_username).first():
                unique_username = f"{base_username}_{counter}"
                counter += 1
            
            user = User(
                username=unique_username,
                email=email.lower(),
                oauth_provider=provider,
                oauth_id=oauth_id,
                avatar_url=avatar_url,
            )
            
            # Create default settings
            settings = UserSettings(user_id=user.id)
            user.settings = settings
            
            db.session.add(user)
            db.session.commit()
            
            logger.info(f"New OAuth user created: {unique_username} via {provider}")
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"OAuth user creation failed: {e}")
            return None, "Failed to process OAuth login"
    
    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[User]:
        """Get a user by ID"""
        return User.query.get(user_id)
    
    @staticmethod
    def update_user_profile(user: User, **kwargs) -> Tuple[Optional[User], Optional[str]]:
        """
        Update user profile information
        
        Args:
            user: The user to update
            **kwargs: Fields to update (username, avatar_url)
            
        Returns:
            Tuple of (Updated user, error message)
        """
        try:
            if 'username' in kwargs:
                new_username = kwargs['username']
                if new_username != user.username:
                    if User.query.filter_by(username=new_username).first():
                        return None, "Username already taken"
                    user.username = new_username
            
            if 'avatar_url' in kwargs:
                user.avatar_url = kwargs['avatar_url']
            
            db.session.commit()
            return user, None
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update user profile: {e}")
            return None, "Failed to update profile"
    
    @staticmethod
    def change_password(user: User, old_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """
        Change user password
        
        Args:
            user: The user
            old_password: Current password
            new_password: New password
            
        Returns:
            Tuple of (success, error message)
        """
        if not user.check_password(old_password):
            return False, "Current password is incorrect"
        
        if len(new_password) < 6:
            return False, "New password must be at least 6 characters"
        
        try:
            user.set_password(new_password)
            db.session.commit()
            logger.info(f"Password changed for user: {user.username}")
            return True, None
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to change password: {e}")
            return False, "Failed to change password"


# Singleton instance
auth_service = AuthService()
