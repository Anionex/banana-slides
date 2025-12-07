"""Settings model"""
from datetime import datetime
from . import db


class Settings(db.Model):
    """
    Settings model - stores global application settings
    """
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True, default=1)
    api_base_url = db.Column(db.String(500), nullable=True)  # API基础URL
    api_key = db.Column(db.String(500), nullable=True)  # API密钥
    image_resolution = db.Column(db.String(20), nullable=False, default='2K')  # 图像清晰度: 1K, 2K, 4K
    image_aspect_ratio = db.Column(db.String(10), nullable=False, default='16:9')  # 图像比例: 16:9, 4:3, 1:1
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'api_base_url': self.api_base_url,
            'api_key_length': len(self.api_key) if self.api_key else 0,
            'image_resolution': self.image_resolution,
            'image_aspect_ratio': self.image_aspect_ratio,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def get_settings():
        """Get or create the single settings instance"""
        settings = Settings.query.first()
        if not settings:
            settings = Settings()
            settings.id = 1
            db.session.add(settings)
            db.session.commit()
        return settings

    def __repr__(self):
        return f'<Settings id={self.id}>'
