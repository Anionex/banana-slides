"""Recharge order model."""
from datetime import datetime

from . import db


class RechargeOrder(db.Model):
    __tablename__ = "recharge_orders"

    TYPE_POINTS = "points"
    TYPE_SUBSCRIPTION = "subscription"

    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_EXPIRED = "expired"
    STATUS_FAILED = "failed"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_no = db.Column(db.String(64), nullable=False, unique=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    order_type = db.Column(db.String(20), nullable=False, default=TYPE_POINTS, index=True)
    package_id = db.Column(db.String(64), nullable=False)
    subscription_plan = db.Column(db.String(20), nullable=True)
    points = db.Column(db.Integer, nullable=False)
    amount_cents = db.Column(db.Integer, nullable=False)
    channel = db.Column(db.String(20), nullable=False, default="wechat")
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING, index=True)
    code_url = db.Column(db.Text, nullable=True)
    # 微信交易号全局唯一，用于拦截重复回调或交易号串单。
    transaction_id = db.Column(db.String(128), nullable=True, unique=True, index=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    expire_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "order_no": self.order_no,
            "user_id": self.user_id,
            "order_type": self.order_type,
            "package_id": self.package_id,
            "subscription_plan": self.subscription_plan,
            "points": self.points,
            "amount_cents": self.amount_cents,
            "channel": self.channel,
            "status": self.status,
            "code_url": self.code_url,
            "transaction_id": self.transaction_id,
            "paid_at": self.paid_at.isoformat() + "Z" if self.paid_at else None,
            "expire_at": self.expire_at.isoformat() + "Z" if self.expire_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }

    def __repr__(self):
        return f"<RechargeOrder {self.order_no}: user={self.user_id} status={self.status}>"
