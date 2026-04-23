"""
Base payment provider interface
支付提供商基类
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional


class PaymentStatus(Enum):
    """支付状态"""
    PENDING = "pending"         # 待支付
    PAID = "paid"               # 已支付
    FAILED = "failed"           # 支付失败
    REFUNDED = "refunded"       # 已退款
    CANCELLED = "cancelled"     # 已取消


@dataclass
class CreditPackage:
    """积分套餐"""
    id: str                     # 套餐ID
    name: str                   # 套餐名称
    credits: int                # 积分数量
    price_cny: float            # 人民币价格
    price_usd: float            # 美元价格
    description: str = ""       # 套餐描述
    bonus_credits: int = 0      # 赠送积分

    @property
    def total_credits(self) -> int:
        """总积分（包含赠送）"""
        return self.credits + self.bonus_credits

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'credits': self.credits,
            'bonus_credits': self.bonus_credits,
            'total_credits': self.total_credits,
            'price_cny': self.price_cny,
            'price_usd': self.price_usd,
            'description': self.description,
        }


@dataclass
class PaymentResult:
    """支付结果"""
    success: bool
    order_id: Optional[str] = None          # 内部订单ID
    external_order_id: Optional[str] = None # 外部订单ID（支付平台）
    payment_url: Optional[str] = None       # 支付链接
    qr_code_url: Optional[str] = None       # 二维码图片URL
    error_message: Optional[str] = None     # 错误信息
    raw_response: Optional[Dict] = None     # 原始响应

    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'order_id': self.order_id,
            'external_order_id': self.external_order_id,
            'payment_url': self.payment_url,
            'qr_code_url': self.qr_code_url,
            'error_message': self.error_message,
        }


@dataclass
class SubscriptionPlan:
    """Recurring subscription plan."""
    id: str
    name: str
    price_usd: float
    interval: str = 'month'
    monthly_credits: int = 0
    description: str = ''
    features: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'price_usd': self.price_usd,
            'interval': self.interval,
            'monthly_credits': self.monthly_credits,
            'description': self.description,
            'features': self.features or [],
        }


class PaymentProvider(ABC):
    """支付提供商基类"""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """提供商名称"""
        raise NotImplementedError

    @abstractmethod
    def create_order(
        self,
        user_id: str,
        package: CreditPackage,
        notify_url: str,
        return_url: str,
        client_ip: Optional[str] = None,
        payment_type: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> PaymentResult:
        """创建支付订单。"""
        raise NotImplementedError

    @abstractmethod
    def verify_webhook(
        self,
        payload: Dict[str, Any],
        signature: Optional[str] = None,
        headers: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """验证 webhook 签名。"""
        raise NotImplementedError

    @abstractmethod
    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """解析 webhook 数据。"""
        raise NotImplementedError

    @abstractmethod
    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """查询订单状态。"""
        raise NotImplementedError
