"""User model"""
from datetime import datetime
import uuid

from . import db


class User(db.Model):
    __tablename__ = 'users'

    ROLE_ADMIN = 'admin'
    ROLE_INTERNAL = 'internal'
    ROLE_USER = 'user'
    PRIVATE_SETTINGS_ROLES = {ROLE_INTERNAL}
    ADMIN_CONSOLE_ROLES = {ROLE_ADMIN}
    PLATFORM_BILLING_ROLES = {ROLE_USER}

    @staticmethod
    def generate_uuid() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def generate_invite_code() -> str:
        return uuid.uuid4().hex[:24]

    @staticmethod
    def build_placeholder_phone(prefix: str = "user") -> str:
        return f"{prefix}-{uuid.uuid4().hex[:8]}"

    @staticmethod
    def build_default_display_name(username: str | None = None, phone: str | None = None) -> str:
        if username:
            return username
        if phone:
            return f"用户{phone[-4:]}"
        return f"用户{uuid.uuid4().hex[:6]}"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    phone = db.Column(db.String(32), unique=True, nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active")
    current_points = db.Column(db.Integer, nullable=False, default=0)
    invite_code = db.Column(db.String(24), unique=True, nullable=False, default=generate_invite_code)
    last_login_at = db.Column(db.DateTime, nullable=True)
    last_login_ip = db.Column(db.String(64), nullable=True)
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
            'display_name': self.display_name,
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
