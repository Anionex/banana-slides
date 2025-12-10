"""
CreditTransaction model for tracking credit changes
"""
import uuid
from datetime import datetime
from . import db


class CreditTransaction(db.Model):
    """
    CreditTransaction model - tracks all credit changes for auditing and payment integration
    """
    __tablename__ = 'credit_transactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    
    # Transaction details
    amount = db.Column(db.Integer, nullable=False)  # Negative for deductions, positive for additions
    balance_after = db.Column(db.Integer, nullable=False)  # Balance after this transaction
    transaction_type = db.Column(db.String(50), nullable=False)  # IMAGE_GENERATION, PURCHASE, SIGNUP_BONUS, etc.
    description = db.Column(db.String(500), nullable=True)  # Human-readable description
    reference_id = db.Column(db.String(36), nullable=True)  # Optional: task_id, page_id, order_id
    
    # Timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationship
    user = db.relationship('User', back_populates='credit_transactions')
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'amount': self.amount,
            'balance_after': self.balance_after,
            'transaction_type': self.transaction_type,
            'description': self.description,
            'reference_id': self.reference_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self):
        return f'<CreditTransaction {self.id}: {self.amount} ({self.transaction_type})>'
