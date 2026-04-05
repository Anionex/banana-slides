"""Points transaction model"""
from datetime import datetime
from . import db


class PointsTransaction(db.Model):
    __tablename__ = 'points_transactions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    amount = db.Column(db.Integer, nullable=False)   # positive = credit, negative = debit
    type = db.Column(db.String(30), nullable=False)  # register_bonus | generation | purchase | admin_adjust
    description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship('User', back_populates='points_transactions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'type': self.type,
            'description': self.description,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
        }

    def __repr__(self):
        return f'<PointsTransaction {self.id}: user={self.user_id} amount={self.amount}>'
