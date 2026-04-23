"""User model"""
from datetime import datetime
from . import db


class User(db.Model):
    __tablename__ = 'users'

    ROLE_ADMIN = 'admin'
    ROLE_INTERNAL = 'internal'
    ROLE_USER = 'user'
    PRIVATE_SETTINGS_ROLES = {ROLE_INTERNAL}
    ADMIN_CONSOLE_ROLES = {ROLE_ADMIN}
    PLATFORM_BILLING_ROLES = {ROLE_USER}

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    phone = db.Column(db.String(20), unique=True, nullable=True)
    username = db.Column(db.String(50), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='user')  # user | internal | admin
    points = db.Column(db.Integer, nullable=False, default=100)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscriptions = db.relationship('Subscription', back_populates='user', lazy='select', cascade='all, delete-orphan')
    points_transactions = db.relationship('PointsTransaction', back_populates='user', lazy='select', cascade='all, delete-orphan')

    def to_dict(self, admin=False):
        data = {
            'id': self.id,
            'phone': self.phone,
            'username': self.username,
            'role': self.role,
            'points': self.points,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }
        if admin:
            data['updated_at'] = self.updated_at.isoformat() + 'Z' if self.updated_at else None
        return data

    @property
    def is_admin(self) -> bool:
        return self.role == self.ROLE_ADMIN

    @property
    def is_internal_user(self) -> bool:
        return self.role == self.ROLE_INTERNAL

    @property
    def is_regular_user(self) -> bool:
        return self.role == self.ROLE_USER

    def can_access_admin_console(self) -> bool:
        return self.role in self.ADMIN_CONSOLE_ROLES

    def uses_private_runtime_settings(self) -> bool:
        return self.role in self.PRIVATE_SETTINGS_ROLES

    def uses_platform_shared_settings(self) -> bool:
        return not self.uses_private_runtime_settings()

    def uses_platform_billing(self) -> bool:
        return self.role in self.PLATFORM_BILLING_ROLES

    def __repr__(self):
        return f'<User {self.id}: {self.phone or self.username}>'
