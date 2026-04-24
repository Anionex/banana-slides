"""WeChat Pay V3 Native payment service."""
from __future__ import annotations

import base64
import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)


class WechatPayConfigError(RuntimeError):
    pass


class WechatPayError(RuntimeError):
    pass


@dataclass(frozen=True)
class WechatPayResult:
    code_url: str
    qr_code_url: str | None = None

    def to_dict(self):
        return {"code_url": self.code_url, "qr_code_url": self.qr_code_url}


@dataclass(frozen=True)
class WechatPayNotify:
    order_no: str
    transaction_id: str
    amount_cents: int
    status: str
    success_time: datetime | None = None


def _cfg(*names: str, default: str = "") -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
        value = (os.getenv(name.upper()) or "").strip()
        if value:
            return value
    return default


def _pay(key: str, legacy_name: str, default: str = "") -> str:
    return _cfg(f"pay.wechat.{key}", legacy_name, default=default)


def _enabled(value: str) -> bool:
    return value.lower() in {"1", "true", "yes", "on"}


def is_wechat_pay_mock() -> bool:
    return _enabled(_pay("mock", "WECHAT_PAY_MOCK", "false"))


def _trust_env() -> bool:
    # 默认不读取系统代理，避免服务器代理环境导致微信 TLS 握手失败。
    return _enabled(_pay("trust_env", "WECHAT_PAY_TRUST_ENV", "false"))


def is_wechat_pay_configured() -> bool:
    if is_wechat_pay_mock():
        return True
    if not _enabled(_pay("enabled", "WECHAT_PAY_ENABLED", "false")):
        return False

    return all(
        (
            _pay("app_id", "WECHAT_PAY_APP_ID"),
            _pay("mch_id", "WECHAT_PAY_MCH_ID"),
            _pay("serial_no", "WECHAT_PAY_SERIAL_NO"),
            _pay("api_v3_key", "WECHAT_PAY_API_V3_KEY"),
            _pay("private_key", "WECHAT_PAY_PRIVATE_KEY"),
        )
    )


def wechat_pay_notify_url(default: str = "") -> str:
    return _pay("notify_url", "WECHAT_PAY_NOTIFY_URL", default)


def _gateway() -> str:
    return _pay("gateway_url", "WECHAT_PAY_GATEWAY_URL", "https://api.mch.weixin.qq.com").rstrip("/")


def _load_private_key():
    raw = _pay("private_key", "WECHAT_PAY_PRIVATE_KEY").replace("\\n", "\n")
    if not raw:
        raise WechatPayConfigError("pay.wechat.private_key 未配置")
    try:
        return serialization.load_pem_private_key(raw.encode("utf-8"), password=None)
    except ValueError:
        try:
            return serialization.load_der_private_key(base64.b64decode(raw), password=None)
        except Exception as exc:
            raise WechatPayConfigError("微信支付商户私钥解析失败") from exc


def _nonce() -> str:
    return secrets.token_hex(16)


def _sign(message: str) -> str:
    key = _load_private_key()
    signature = key.sign(message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(signature).decode("ascii")


def _authorization(method: str, path: str, body: str) -> str:
    timestamp = str(int(time.time()))
    nonce = _nonce()
    message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body}\n"
    signature = _sign(message)
    return (
        "WECHATPAY2-SHA256-RSA2048 "
        f'mchid="{_pay("mch_id", "WECHAT_PAY_MCH_ID")}",'
        f'nonce_str="{nonce}",'
        f'timestamp="{timestamp}",'
        f'serial_no="{_pay("serial_no", "WECHAT_PAY_SERIAL_NO")}",'
        f'signature="{signature}"'
    )


def _qr_data_url(code_url: str) -> str | None:
    # 后端能生成二维码就直接返回图片；失败时前端会用 code_url 再兜底生成。
    try:
        import qrcode

        image = qrcode.make(code_url)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        return f"data:image/png;base64,{encoded}"
    except Exception as exc:
        logger.warning("Failed to generate WeChat pay QR image: %s", exc)
        return None


def _parse_success_time(value: str | None) -> datetime | None:
    """把微信 success_time 转成 UTC naive 时间，方便和本地 expire_at 比较。"""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("Invalid WeChat success_time: %s", value)
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def create_native_order(
    *,
    order_no: str,
    description: str,
    amount_cents: int,
    notify_url: str,
    client_ip: str | None = None,
    expire_at: datetime | None = None,
) -> WechatPayResult:
    """创建微信 Native 支付订单，返回 code_url 和可选二维码图片。"""
    if is_wechat_pay_mock():
        code_url = f"weixin://wxpay/mock/{order_no}"
        return WechatPayResult(code_url=code_url, qr_code_url=_qr_data_url(code_url))

    if not is_wechat_pay_configured():
        raise WechatPayConfigError("微信支付未配置完整")
    if not notify_url:
        raise WechatPayConfigError("pay.wechat.notify_url 未配置")

    path = "/v3/pay/transactions/native"
    payload: dict = {
        "appid": _pay("app_id", "WECHAT_PAY_APP_ID"),
        "mchid": _pay("mch_id", "WECHAT_PAY_MCH_ID"),
        "description": description[:127],
        "out_trade_no": order_no,
        "notify_url": notify_url,
        "amount": {"total": amount_cents, "currency": "CNY"},
    }
    if expire_at:
        payload["time_expire"] = expire_at.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    if client_ip:
        payload["scene_info"] = {"payer_client_ip": client_ip}

    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    headers = {
        "Authorization": _authorization("POST", path, body),
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            _gateway() + path,
            content=body.encode("utf-8"),
            headers=headers,
            timeout=15,
            trust_env=_trust_env(),
        )
    except httpx.HTTPError as exc:
        raise WechatPayError(f"微信支付请求失败：{exc}") from exc
    if response.status_code != 200:
        logger.error("WeChat Native order failed: %s %s", response.status_code, response.text)
        raise WechatPayError(f"微信支付下单失败（状态码 {response.status_code}）")

    data = response.json()
    code_url = data.get("code_url")
    if not code_url:
        raise WechatPayError("微信支付响应缺少 code_url")
    return WechatPayResult(code_url=code_url, qr_code_url=_qr_data_url(code_url))


def parse_wechat_notify(raw_body: bytes) -> WechatPayNotify:
    """解析微信支付回调；这里负责 AES-GCM 解密和基础商户号校验。"""
    api_v3_key = _pay("api_v3_key", "WECHAT_PAY_API_V3_KEY")
    if len(api_v3_key.encode("utf-8")) != 32:
        raise WechatPayConfigError("pay.wechat.api_v3_key 必须是 32 字节")

    payload = json.loads(raw_body.decode("utf-8"))
    resource = payload.get("resource") or {}
    # 微信支付 V3 回调的订单信息在 resource 中加密，必须用 APIv3 Key 解密后才能读取。
    cipher_text = base64.b64decode(resource.get("ciphertext") or "")
    nonce = (resource.get("nonce") or "").encode("utf-8")
    associated_data = (resource.get("associated_data") or "").encode("utf-8")
    plain = AESGCM(api_v3_key.encode("utf-8")).decrypt(nonce, cipher_text, associated_data)
    transaction = json.loads(plain.decode("utf-8"))

    # 回调必须属于当前商户号，避免误处理其他商户或测试环境订单。
    mchid = transaction.get("mchid")
    configured_mchid = _pay("mch_id", "WECHAT_PAY_MCH_ID")
    if mchid and configured_mchid and mchid != configured_mchid:
        raise WechatPayError("微信支付回调 mchid 不匹配")

    trade_state = transaction.get("trade_state")
    status = "success" if trade_state == "SUCCESS" else "fail"
    if trade_state == "REFUND":
        status = "refund"

    return WechatPayNotify(
        order_no=transaction.get("out_trade_no") or "",
        transaction_id=transaction.get("transaction_id") or "",
        amount_cents=int((transaction.get("amount") or {}).get("payer_total") or 0),
        status=status,
        success_time=_parse_success_time(transaction.get("success_time")),
    )
