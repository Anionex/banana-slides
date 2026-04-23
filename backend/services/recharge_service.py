"""Recharge and subscription pricing, order creation helpers, and fulfillment."""
from __future__ import annotations

import json
import logging
import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from flask import has_app_context

from models import PointsTransaction, RechargeOrder, Settings, Subscription, User, db

logger = logging.getLogger(__name__)


def _cfg(*names: str, default: str = "") -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
        value = (os.getenv(name.upper()) or "").strip()
        if value:
            return value
    return default


@dataclass(frozen=True)
class RechargePackage:
    id: str
    name: str
    points: int
    amount_cents: int
    popular: bool = False

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "points": self.points,
            "amount_cents": self.amount_cents,
            "price": round(self.amount_cents / 100, 2),
            "popular": self.popular,
            "description": f"充值 {self.points} 积分",
        }


@dataclass(frozen=True)
class SubscriptionPlan:
    id: str
    name: str
    amount_cents: int
    days: int
    popular: bool = False

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "amount_cents": self.amount_cents,
            "price": round(self.amount_cents / 100, 2),
            "days": self.days,
            "popular": self.popular,
            "description": f"{self.days} 天订阅",
        }


DEFAULT_RECHARGE_PACKAGES = (
    RechargePackage("points_100", "100 积分", 100, 990),
    RechargePackage("points_500", "500 积分", 500, 3990, True),
    RechargePackage("points_1000", "1000 积分", 1000, 6990),
)

DEFAULT_SUBSCRIPTION_PLANS = (
    SubscriptionPlan("monthly", "月度订阅", 2900, 30),
    SubscriptionPlan("yearly", "年度订阅", 19900, 365, True),
)


# 默认定价只用于初始化数据库；运行时定价统一从 settings 表读取。
def _serialize_packages(packages: list[RechargePackage]) -> str:
    return json.dumps(
        [package.to_dict() for package in packages],
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _serialize_subscription_plans(plans: list[SubscriptionPlan]) -> str:
    return json.dumps(
        [plan.to_dict() for plan in plans],
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _safe_package_id(raw: str, points: int, index: int) -> str:
    package_id = re.sub(r"[^A-Za-z0-9_-]+", "_", (raw or "").strip()).strip("_")
    return package_id or f"points_{points}_{index}"


def _parse_amount_cents(raw: object) -> int:
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(round(raw))
    text = str(raw or "").strip()
    if not text:
        raise ValueError("amount_cents is required")
    return int(round(float(text)))


def _parse_price_cents(raw: object) -> int:
    text = str(raw or "").strip()
    if not text:
        raise ValueError("price is required")
    return int(round(float(text) * 100))


def _normalize_packages(items: list[dict]) -> list[RechargePackage]:
    packages: list[RechargePackage] = []
    seen_ids: set[str] = set()
    popular_assigned = False

    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError("套餐必须是对象")

        points = int(item.get("points") or 0)
        if item.get("amount_cents") is not None:
            amount_cents = _parse_amount_cents(item.get("amount_cents"))
        else:
            # price 表示“元”，amount_cents 表示“分”，不能混用同一套解析规则。
            amount_cents = _parse_price_cents(item.get("price"))
        if points <= 0:
            raise ValueError("积分必须大于 0")
        if amount_cents <= 0:
            raise ValueError("价格必须大于 0")

        package_id = _safe_package_id(str(item.get("id") or ""), points, index)
        if package_id in seen_ids:
            raise ValueError(f"套餐 ID 重复：{package_id}")
        seen_ids.add(package_id)

        name = (str(item.get("name") or "").strip()) or f"{points} 积分"
        popular = bool(item.get("popular")) and not popular_assigned
        if popular:
            popular_assigned = True

        packages.append(RechargePackage(package_id, name, points, amount_cents, popular))

    if not packages:
        raise ValueError("至少需要配置一个充值套餐")
    return packages


def _normalize_subscription_plans(items: list[dict]) -> list[SubscriptionPlan]:
    plans: list[SubscriptionPlan] = []
    seen_ids: set[str] = set()
    popular_assigned = False

    for index, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError("订阅套餐必须是对象")

        plan_id = _safe_package_id(str(item.get("id") or ""), 0, index)
        if plan_id in seen_ids:
            raise ValueError(f"订阅套餐 ID 重复：{plan_id}")
        if plan_id not in {"monthly", "yearly"}:
            raise ValueError("订阅套餐 ID 只能是 monthly 或 yearly")
        seen_ids.add(plan_id)

        if item.get("amount_cents") is not None:
            amount_cents = _parse_amount_cents(item.get("amount_cents"))
        else:
            # 后台输入的是元，保存前统一转成分。
            amount_cents = _parse_price_cents(item.get("price"))
        days = int(item.get("days") or (365 if plan_id == "yearly" else 30))
        if amount_cents <= 0:
            raise ValueError("订阅价格必须大于 0")
        if days <= 0:
            raise ValueError("订阅天数必须大于 0")

        name = (str(item.get("name") or "").strip()) or ("年度订阅" if plan_id == "yearly" else "月度订阅")
        popular = bool(item.get("popular")) and not popular_assigned
        if popular:
            popular_assigned = True
        plans.append(SubscriptionPlan(plan_id, name, amount_cents, days, popular))

    if not plans:
        raise ValueError("至少需要配置一个订阅套餐")
    return plans


def _parse_json_packages(raw: str) -> list[RechargePackage]:
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("充值套餐配置必须是数组")
    return _normalize_packages(data)


def _parse_json_subscription_plans(raw: str) -> list[SubscriptionPlan]:
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("订阅套餐配置必须是数组")
    return _normalize_subscription_plans(data)


def _settings_packages() -> list[RechargePackage] | None:
    if not has_app_context():
        return None
    settings = Settings.get_global_settings()
    if settings.recharge_packages:
        try:
            return _parse_json_packages(settings.recharge_packages)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Invalid recharge package settings, reset to defaults: %s", exc)

    # 数据库为空或配置损坏时写入默认值，避免回退到环境变量造成线上定价不一致。
    packages = list(DEFAULT_RECHARGE_PACKAGES)
    settings.recharge_packages = _serialize_packages(packages)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return packages


def _settings_subscription_plans() -> list[SubscriptionPlan] | None:
    if not has_app_context():
        return None
    settings = Settings.get_global_settings()
    if getattr(settings, "subscription_plans", None):
        try:
            return _parse_json_subscription_plans(settings.subscription_plans)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Invalid subscription plan settings, reset to defaults: %s", exc)

    # 订阅定价同样落库，后台重置后也会保留数据库来源。
    plans = list(DEFAULT_SUBSCRIPTION_PLANS)
    settings.subscription_plans = _serialize_subscription_plans(plans)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return plans


def get_recharge_packages_with_source() -> tuple[list[RechargePackage], str]:
    packages = _settings_packages()
    if packages:
        return packages, "database"
    return list(DEFAULT_RECHARGE_PACKAGES), "default"


def get_subscription_plans_with_source() -> tuple[list[SubscriptionPlan], str]:
    plans = _settings_subscription_plans()
    if plans:
        return plans, "database"
    return list(DEFAULT_SUBSCRIPTION_PLANS), "default"


def list_recharge_packages() -> list[RechargePackage]:
    packages, _source = get_recharge_packages_with_source()
    return packages


def list_subscription_plans() -> list[SubscriptionPlan]:
    plans, _source = get_subscription_plans_with_source()
    return plans


def save_recharge_packages(items: list[dict]) -> list[RechargePackage]:
    packages = _normalize_packages(items)
    settings = Settings.get_global_settings()
    settings.recharge_packages = _serialize_packages(packages)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return packages


def save_subscription_plans(items: list[dict]) -> list[SubscriptionPlan]:
    plans = _normalize_subscription_plans(items)
    settings = Settings.get_global_settings()
    settings.subscription_plans = _serialize_subscription_plans(plans)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return plans


def reset_recharge_packages() -> list[RechargePackage]:
    packages = list(DEFAULT_RECHARGE_PACKAGES)
    settings = Settings.get_global_settings()
    settings.recharge_packages = _serialize_packages(packages)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return packages


def reset_subscription_plans() -> list[SubscriptionPlan]:
    plans = list(DEFAULT_SUBSCRIPTION_PLANS)
    settings = Settings.get_global_settings()
    settings.subscription_plans = _serialize_subscription_plans(plans)
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    return plans


def get_recharge_package(package_id: str) -> RechargePackage | None:
    return next((package for package in list_recharge_packages() if package.id == package_id), None)


def get_subscription_plan(plan_id: str) -> SubscriptionPlan | None:
    return next((plan for plan in list_subscription_plans() if plan.id == plan_id), None)


def generate_order_no() -> str:
    return "BS" + datetime.utcnow().strftime("%Y%m%d%H%M%S") + secrets.token_hex(4).upper()


def order_expire_at(now: datetime | None = None) -> datetime:
    # 订单有效期需要和前端倒计时、微信 time_expire 保持一致。
    minutes = int(_cfg("pay.wechat.order_expire_minutes", "WECHAT_PAY_ORDER_EXPIRE_MINUTES", default="5"))
    return (now or datetime.utcnow()) + timedelta(minutes=max(1, minutes))


def mark_order_expired_if_needed(order: RechargeOrder) -> bool:
    # 用户轮询订单时顺手把过期 pending 单落库，避免页面反复显示可支付状态。
    if order.status == RechargeOrder.STATUS_PENDING and datetime.utcnow() > order.expire_at:
        order.status = RechargeOrder.STATUS_EXPIRED
        order.updated_at = datetime.utcnow()
        db.session.commit()
        return True
    return order.status == RechargeOrder.STATUS_EXPIRED


def _active_subscription(user_id: int) -> Subscription | None:
    now = datetime.utcnow()
    active = (
        Subscription.query.filter_by(user_id=user_id, status="active")
        .order_by(Subscription.end_date.desc())
        .first()
    )
    if active and active.end_date and active.end_date < now:
        active.status = "expired"
        db.session.commit()
        return None
    return active


def current_subscription_dict(user_id: int) -> dict | None:
    active = _active_subscription(user_id)
    return active.to_dict() if active else None


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def fulfill_recharge_order(
    order_no: str,
    transaction_id: str,
    amount_cents: int,
    paid_at: datetime | None = None,
) -> RechargeOrder:
    """处理微信支付回调履约；必须保证重复回调和并发回调不会重复发放权益。"""
    order = RechargeOrder.query.filter_by(order_no=order_no).first()
    if not order:
        raise ValueError("订单不存在")
    if not transaction_id:
        raise ValueError("微信交易号缺失")

    if order.status == RechargeOrder.STATUS_PAID:
        if order.transaction_id and order.transaction_id != transaction_id:
            raise ValueError("订单已由其他微信交易号支付")
        return order

    if order.status == RechargeOrder.STATUS_FAILED:
        raise ValueError("订单已失败，不能重复履约")

    # 金额不一致直接标记失败，防止低金额回调拿到积分或订阅权益。
    if order.amount_cents != amount_cents:
        order.status = RechargeOrder.STATUS_FAILED
        order.updated_at = datetime.utcnow()
        db.session.commit()
        raise ValueError("支付金额不匹配")

    existing = RechargeOrder.query.filter(
        RechargeOrder.transaction_id == transaction_id,
        RechargeOrder.order_no != order_no,
    ).first()
    if existing:
        raise ValueError("微信交易号已被其他订单使用")

    now = datetime.utcnow()
    paid_time = _utc_naive(paid_at) if paid_at else now
    # 以微信 success_time 判断真实付款时间；回调延迟不影响有效期内已完成的支付。
    if paid_time > order.expire_at:
        if order.status == RechargeOrder.STATUS_PENDING:
            order.status = RechargeOrder.STATUS_EXPIRED
            order.updated_at = now
            db.session.commit()
        raise ValueError("订单已超时")
    if order.status == RechargeOrder.STATUS_EXPIRED and not paid_at:
        raise ValueError("订单已超时")

    user = User.query.get(order.user_id)
    if not user:
        order.status = RechargeOrder.STATUS_FAILED
        order.updated_at = datetime.utcnow()
        db.session.commit()
        raise ValueError("用户不存在")

    payable_statuses = [RechargeOrder.STATUS_PENDING]
    if paid_at:
        payable_statuses.append(RechargeOrder.STATUS_EXPIRED)
    # 原子抢占订单状态：只有一个回调能从可支付状态切到 paid。
    claimed = RechargeOrder.query.filter(
        RechargeOrder.order_no == order_no,
        RechargeOrder.status.in_(payable_statuses),
    ).update(
        {
            "status": RechargeOrder.STATUS_PAID,
            "transaction_id": transaction_id,
            "paid_at": paid_time,
            "updated_at": now,
        },
        synchronize_session=False,
    )
    if claimed != 1:
        db.session.rollback()
        current = RechargeOrder.query.filter_by(order_no=order_no).first()
        if current and current.status == RechargeOrder.STATUS_PAID:
            if current.transaction_id and current.transaction_id != transaction_id:
                raise ValueError("订单已由其他微信交易号支付")
            return current
        raise ValueError("订单状态已变更，不能重复履约")

    db.session.flush()
    db.session.expire_all()
    order = RechargeOrder.query.filter_by(order_no=order_no).first()

    if getattr(order, "order_type", RechargeOrder.TYPE_POINTS) == RechargeOrder.TYPE_SUBSCRIPTION:
        # 订阅续费从当前有效期末尾顺延，未订阅或已过期则从当前时间开始。
        plan_id = order.subscription_plan or order.package_id
        plan = get_subscription_plan(plan_id)
        days = plan.days if plan else (365 if plan_id == "yearly" else 30)

        current = _active_subscription(user.id)
        base = current.end_date if current and current.end_date and current.end_date > now else now
        Subscription.query.filter_by(user_id=user.id, status="active").update({"status": "expired"})
        db.session.add(
            Subscription(
                user_id=user.id,
                plan=plan_id,
                status="active",
                start_date=now,
                end_date=base + timedelta(days=days),
                created_at=now,
            )
        )
    else:
        # 积分充值只在订单首次履约时执行，重复回调在前面的状态抢占处已被拦截。
        user.points = (user.points or 0) + order.points
        db.session.add(
            PointsTransaction(
                user_id=user.id,
                amount=order.points,
                type="purchase",
                description=f"微信充值 {order.points} 积分（订单 {order.order_no}）",
                created_at=now,
            )
        )

    user.updated_at = now
    db.session.commit()
    return order
