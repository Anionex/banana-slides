"""Payment callbacks."""
import logging

from flask import Blueprint, jsonify, request

from services.recharge_service import fulfill_recharge_order
from services.wechat_pay_service import parse_wechat_notify

logger = logging.getLogger(__name__)
payment_bp = Blueprint("payment", __name__, url_prefix="/api/payment")
payment_compat_bp = Blueprint("payment_compat", __name__, url_prefix="/api/v1/notify")


def _handle_wechat_notify():
    """WeChat Pay async notification endpoint."""
    try:
        notification = parse_wechat_notify(request.get_data() or b"")
        if notification.status == "success":
            # 微信可能重复通知；履约服务内部负责幂等和超时判断。
            fulfill_recharge_order(
                notification.order_no,
                notification.transaction_id,
                notification.amount_cents,
                paid_at=notification.success_time,
            )
        return jsonify({"code": "SUCCESS", "message": "成功"})
    except Exception as exc:
        logger.warning("WeChat payment notify failed: %s", exc, exc_info=True)
        return jsonify({"code": "FAIL", "message": str(exc)})


@payment_bp.route("/wechat/notify", methods=["POST"])
def wechat_notify():
    return _handle_wechat_notify()


# 兼容当前线上 notify_url：/api/v1/notify/wechat。
@payment_compat_bp.route("/wechat", methods=["POST"])
def wechat_notify_v1():
    return _handle_wechat_notify()
