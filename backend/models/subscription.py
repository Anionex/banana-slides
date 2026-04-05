"""Subscription model"""
from datetime import datetime
from . import db


class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    plan = db.Column(db.String(20), nullable=False)   # monthly | yearly
    status = db.Column(db.String(20), nullable=False, default='active')  # active | expired | cancelled
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship('User', back_populates='subscriptions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'plan': self.plan,
            'status': self.status,
            'start_date': self.start_date.isoformat() + 'Z' if self.start_date else None,
            'end_date': self.end_date.isoformat() + 'Z' if self.end_date else None,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }

    def __repr__(self):
        return f'<Subscription {self.id}: user={self.user_id} plan={self.plan} status={self.status}>'
