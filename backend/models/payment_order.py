"""
Payment Order Model - stores payment order records for auditing
支付订单模型 - 存储支付订单记录用于审计
"""
from datetime import datetime, timezone
from . import db


class PaymentOrder(db.Model):
    """支付订单模型"""
    __tablename__ = 'payment_orders'

    id = db.Column(db.String(36), primary_key=True)  # UUID
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)

    # 订单信息
    package_id = db.Column(db.String(50), nullable=False)  # 套餐ID
    package_name = db.Column(db.String(100), nullable=False)  # 套餐名称
    credits = db.Column(db.Integer, nullable=False)  # 购买积分
    bonus_credits = db.Column(db.Integer, default=0)  # 赠送积分
    total_credits = db.Column(db.Integer, nullable=False)  # 总积分

    # 价格
    amount = db.Column(db.Float, nullable=False)  # 支付金额
    currency = db.Column(db.String(10), default='CNY')  # 货币类型

    # 支付信息
    payment_provider = db.Column(db.String(50), nullable=False)  # 支付提供商 (xunhupay/lemonsqueezy)
    payment_type = db.Column(db.String(20))  # 支付方式 (wechat/alipay)
    external_order_id = db.Column(db.String(100), index=True)  # 外部订单ID

    # 状态
    status = db.Column(db.String(20), default='pending', index=True)  # pending/paid/failed/refunded/cancelled

    # 时间戳
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    paid_at = db.Column(db.DateTime)  # 支付时间
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # 关联
    user = db.relationship('User', backref=db.backref('payment_orders', lazy='dynamic'))

    def to_dict(self, include_user=False):
        """Convert to dictionary"""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'package_id': self.package_id,
            'package_name': self.package_name,
            'credits': self.credits,
            'bonus_credits': self.bonus_credits,
            'total_credits': self.total_credits,
            'amount': self.amount,
            'currency': self.currency,
            'payment_provider': self.payment_provider,
            'payment_type': self.payment_type,
            'external_order_id': self.external_order_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_user and self.user:
            result['user'] = {
                'id': self.user.id,
                'email': self.user.email,
                'username': self.user.username,
            }
        return result
