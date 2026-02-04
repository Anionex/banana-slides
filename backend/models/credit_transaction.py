"""
CreditTransaction model - records every credit balance change
积分交易记录模型 - 记录每一笔积分变动
"""
import uuid
from datetime import datetime, timezone
from . import db


class CreditTransaction(db.Model):
    """
    CreditTransaction model - one row per credit change (consume or add)
    """
    __tablename__ = 'credit_transactions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    operation = db.Column(db.String(50), nullable=False)  # CreditOperation.value
    amount = db.Column(db.Integer, nullable=False)  # negative = consume, positive = add
    balance_after = db.Column(db.Integer, nullable=False)
    description = db.Column(db.String(500), nullable=True)
    project_id = db.Column(db.String(36), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationship
    user = db.relationship('User', back_populates='credit_transactions')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'operation': self.operation,
            'amount': self.amount,
            'balance_after': self.balance_after,
            'description': self.description,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<CreditTransaction {self.id}: user={self.user_id} op={self.operation} amount={self.amount}>'
