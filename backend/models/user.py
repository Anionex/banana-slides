"""
User model for authentication and authorization
"""
import uuid
from datetime import datetime, timezone
from . import db


class User(db.Model):
    """
    User model - represents a registered user
    """
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    username = db.Column(db.String(100), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    
    # Subscription related
    subscription_plan = db.Column(db.String(20), default='free')  # free, pro, enterprise
    subscription_expires_at = db.Column(db.DateTime, nullable=True)
    stripe_customer_id = db.Column(db.String(100), nullable=True, index=True)
    stripe_subscription_id = db.Column(db.String(100), nullable=True)
    
    # Credits system (积分制)
    credits_balance = db.Column(db.Integer, default=0)  # 当前积分余额
    credits_used_total = db.Column(db.Integer, default=0)  # 累计使用积分
    
    # Legacy quota fields (kept for backward compatibility)
    projects_count = db.Column(db.Integer, default=0)
    storage_used_mb = db.Column(db.Float, default=0.0)
    ai_calls_this_month = db.Column(db.Integer, default=0)
    ai_calls_reset_at = db.Column(db.DateTime, nullable=True)
    
    # Account status
    is_active = db.Column(db.Boolean, default=True)
    is_admin = db.Column(db.Boolean, default=False)
    email_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(100), nullable=True)
    verification_token_expires = db.Column(db.DateTime, nullable=True)
    
    # Password reset
    password_reset_token = db.Column(db.String(100), nullable=True)
    password_reset_expires = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), 
                          onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships (will be set up when other models are modified)
    projects = db.relationship('Project', back_populates='user', lazy='dynamic')
    materials = db.relationship('Material', back_populates='user', lazy='dynamic')
    user_templates = db.relationship('UserTemplate', back_populates='user', lazy='dynamic')
    settings = db.relationship('UserSettings', back_populates='user', uselist=False)
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """
        Convert to dictionary
        
        Args:
            include_sensitive: Include sensitive fields like tokens (default False)
        """
        data = {
            'id': self.id,
            'email': self.email,
            'username': self.username,
            'avatar_url': self.avatar_url,
            'subscription_plan': self.subscription_plan,
            'subscription_expires_at': self.subscription_expires_at.isoformat() if self.subscription_expires_at else None,
            'credits_balance': self.credits_balance,
            'credits_used_total': self.credits_used_total,
            'projects_count': self.projects_count,
            'storage_used_mb': self.storage_used_mb,
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'email_verified': self.email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
        }
        
        if include_sensitive:
            data['stripe_customer_id'] = self.stripe_customer_id
            data['stripe_subscription_id'] = self.stripe_subscription_id
        
        return data
    
    def is_subscription_active(self) -> bool:
        """Check if user has an active subscription"""
        if self.subscription_plan == 'free':
            return True
        
        if self.subscription_expires_at is None:
            return False
        
        # Handle timezone-naive datetime
        expires_at = self.subscription_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        return datetime.now(timezone.utc) < expires_at
    
    def get_effective_plan(self) -> str:
        """Get the effective subscription plan (considering expiration)"""
        if self.is_subscription_active():
            return self.subscription_plan
        return 'free'
    
    def __repr__(self):
        return f'<User {self.id}: {self.email}>'
