"""
UserSettings model for user-specific configuration
"""
import uuid
from datetime import datetime
from . import db


class UserSettings(db.Model):
    """
    UserSettings model - stores user-specific API keys and configurations
    Sensitive data (API keys) are stored encrypted
    """
    __tablename__ = 'user_settings'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), unique=True, nullable=False)
    
    # API Configuration (encrypted storage for sensitive data)
    google_api_key_encrypted = db.Column(db.Text, nullable=True)
    google_api_base = db.Column(db.String(500), nullable=True)
    mineru_token_encrypted = db.Column(db.Text, nullable=True)
    mineru_api_base = db.Column(db.String(500), nullable=True)
    image_caption_model = db.Column(db.String(100), nullable=True)
    
    # Concurrency configuration
    max_description_workers = db.Column(db.Integer, nullable=True)
    max_image_workers = db.Column(db.Integer, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', back_populates='settings')
    
    def to_dict(self, include_encrypted=False):
        """
        Convert to dictionary
        Note: By default, encrypted fields are masked for security
        """
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'google_api_base': self.google_api_base,
            'mineru_api_base': self.mineru_api_base,
            'image_caption_model': self.image_caption_model,
            'max_description_workers': self.max_description_workers,
            'max_image_workers': self.max_image_workers,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # Indicate whether keys are configured (without exposing values)
            'has_google_api_key': bool(self.google_api_key_encrypted),
            'has_mineru_token': bool(self.mineru_token_encrypted),
        }
        
        return data
    
    def __repr__(self):
        return f'<UserSettings user_id={self.user_id}>'
