"""User model"""
import uuid
from datetime import datetime
from . import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone = db.Column(db.String(20), unique=True, nullable=True)
    username = db.Column(db.String(50), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(10), nullable=False, default='user')  # user | admin
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

    def __repr__(self):
        return f'<User {self.id}: {self.phone or self.username}>'
