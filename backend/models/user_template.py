"""
User Template model - stores user-uploaded templates
"""
import uuid
from datetime import datetime
from . import db


class UserTemplate(db.Model):
    """
    User Template model - represents a user-uploaded template
    """
    __tablename__ = 'user_templates'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(200), nullable=True)  # Optional template name
    file_path = db.Column(db.String(500), nullable=False)
    thumb_path = db.Column(db.String(500), nullable=True)  # Thumbnail path for faster loading
    file_size = db.Column(db.Integer, nullable=True)  # File size in bytes
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', back_populates='user_templates')

    def to_dict(self):
        """Convert to dictionary"""
        from services.file_urls import public_url

        thumb_url = public_url(self.thumb_path)

        return {
            'template_id': self.id,
            'name': self.name,
            'template_image_url': public_url(self.file_path),
            'thumb_url': thumb_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<UserTemplate {self.id}: {self.name or "Unnamed"}>'

