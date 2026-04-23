"""
微信支付官方 V3 API 提供商
WeChat Pay V3 provider — Native (PC QR) + H5 (mobile browser)
"""
import base64
import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .base import CreditPackage, PaymentProvider, PaymentResult, PaymentStatus

logger = logging.getLogger(__name__)

API_HOST = "https://api.mch.weixin.qq.com"


class WechatPayProvider(PaymentProvider):

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self._cfg = cfg

    @property
    def provider_name(self) -> str:
        return "wechatpay"

    def _cred(self):
        cfg = self._cfg
        try:
            from models import SystemConfig
            sc = SystemConfig.get_instance()
            db_cfg = (sc.get_payment_provider_configs(raw=True) or {}).get('wechatpay') or {}
        except Exception:
            db_cfg = {}

        def _pick(key):
            return cfg.get(key) or db_cfg.get(key) or os.getenv(f'WECHATPAY_{key.upper()}', '')

        return {
            'mch_id': _pick('mch_id'),
            'app_id': _pick('app_id'),
            'api_v3_key': _pick('api_v3_key'),
            'private_key': _pick('private_key'),
            'cert_serial_no': _pick('cert_serial_no'),
            'wxpay_public_key_id': _pick('wxpay_public_key_id'),
            'wxpay_public_key': _pick('wxpay_public_key'),
        }

    @staticmethod
    def _load_private_key(pem_str: str):
        pem_str = pem_str.strip()
        if not pem_str.startswith('-----'):
            pem_str = f"-----BEGIN PRIVATE KEY-----\n{pem_str}\n-----END PRIVATE KEY-----"
        return serialization.load_pem_private_key(pem_str.encode(), password=None)

    @staticmethod
    def _load_public_key(pem_str: str):
        pem_str = pem_str.strip()
        if not pem_str.startswith('-----'):
            pem_str = f"-----BEGIN PUBLIC KEY-----\n{pem_str}\n-----END PUBLIC KEY-----"
        return serialization.load_pem_public_key(pem_str.encode())

    def _sign(self, method: str, url_path: str, body: str, cred: dict) -> str:
        ts = str(int(time.time()))
        nonce = uuid.uuid4().hex
        sign_str = f"{method}\n{url_path}\n{ts}\n{nonce}\n{body}\n"
        pk = self._load_private_key(cred['private_key'])
        sig = pk.sign(sign_str.encode(), padding.PKCS1v15(), hashes.SHA256())
        sig_b64 = base64.b64encode(sig).decode()
        return (
            f'WECHATPAY2-SHA256-RSA2048 '
            f'mchid="{cred["mch_id"]}",'
            f'nonce_str="{nonce}",'
            f'timestamp="{ts}",'
            f'serial_no="{cred["cert_serial_no"]}",'
            f'signature="{sig_b64}"'
        ), ts, nonce

    def _request(self, method: str, path: str, body_dict: Optional[dict], cred: dict) -> dict:
        body_str = json.dumps(body_dict, ensure_ascii=False) if body_dict else ''
        auth, _ts, _nonce = self._sign(method, path, body_str, cred)
        headers = {
            'Authorization': auth,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        if cred.get('wxpay_public_key_id'):
            headers['Wechatpay-Serial'] = cred['wxpay_public_key_id']

        url = API_HOST + path
        if method == 'POST':
            resp = requests.post(url, data=body_str.encode('utf-8'), headers=headers, timeout=30)
        else:
            resp = requests.get(url, headers=headers, timeout=30)

        if 200 <= resp.status_code < 300:
            return resp.json() if resp.text else {}
        raise WechatPayAPIError(resp.status_code, resp.text)

    @staticmethod
    def _generate_order_id() -> str:
        return f"WX{int(time.time() * 1000)}{uuid.uuid4().hex[:8]}"

    def create_order(
        self,
        user_id: str,
        package: CreditPackage,
        notify_url: str,
        return_url: str,
        client_ip: Optional[str] = None,
        payment_type: Optional[str] = 'native',
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> PaymentResult:
        cred = self._cred()
        if not cred['mch_id'] or not cred['private_key']:
            return PaymentResult(success=False, error_message="微信支付未配置")

        order_id = self._generate_order_id()
        amount_fen = int(round(package.price_cny * 100))
        payment_type = payment_type or 'native'

        body = {
            'appid': cred['app_id'],
            'mchid': cred['mch_id'],
            'description': f"Banana Slides - {package.name}",
            'out_trade_no': order_id,
            'notify_url': notify_url,
            'amount': {'total': amount_fen, 'currency': 'CNY'},
            'attach': f"{user_id}|{package.id}",
        }

        try:
            if payment_type == 'h5':
                body['scene_info'] = {
                    'payer_client_ip': client_ip or '127.0.0.1',
                    'h5_info': {'type': 'Wap'},
                }
                resp = self._request('POST', '/v3/pay/transactions/h5', body, cred)
                h5_url = resp.get('h5_url', '')
                if success_url:
                    from urllib.parse import quote
                    h5_url += f"&redirect_url={quote(success_url, safe='')}"
                return PaymentResult(
                    success=True, order_id=order_id,
                    payment_url=h5_url, raw_response=resp,
                )
            else:
                resp = self._request('POST', '/v3/pay/transactions/native', body, cred)
                return PaymentResult(
                    success=True, order_id=order_id,
                    qr_code_url=resp.get('code_url', ''),
                    raw_response=resp,
                )
        except WechatPayAPIError as e:
            logger.error("WechatPay create_order failed: %s %s", e.status_code, e.body)
            return PaymentResult(success=False, order_id=order_id, error_message=str(e))
        except Exception as e:
            logger.error("WechatPay create_order error: %s", e)
            return PaymentResult(success=False, order_id=order_id, error_message=str(e))

    def verify_webhook(
        self,
        payload: Dict[str, Any],
        signature: Optional[str] = None,
        headers: Optional[Dict[str, Any]] = None,
    ) -> bool:
        if not headers:
            return False
        cred = self._cred()
        pub_key_pem = cred.get('wxpay_public_key')
        if not pub_key_pem:
            logger.error("WechatPay public key not configured")
            return False

        h = {k: v for k, v in headers.items()}
        ts = h.get('Wechatpay-Timestamp', '')
        nonce = h.get('Wechatpay-Nonce', '')
        sig_b64 = h.get('Wechatpay-Signature', '')
        body_str = payload.get('_raw_body', '') if isinstance(payload, dict) else ''

        if not all([ts, nonce, sig_b64, body_str]):
            return False

        if abs(int(time.time()) - int(ts)) > 300:
            logger.warning("WechatPay webhook timestamp expired")
            return False

        verify_str = f"{ts}\n{nonce}\n{body_str}\n"
        try:
            pub_key = self._load_public_key(pub_key_pem)
            pub_key.verify(
                base64.b64decode(sig_b64),
                verify_str.encode(),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return True
        except Exception as e:
            logger.warning("WechatPay webhook signature verification failed: %s", e)
            return False

    def _decrypt_resource(self, resource: dict, api_v3_key: str) -> dict:
        nonce = resource['nonce']
        ciphertext = base64.b64decode(resource['ciphertext'])
        aad = resource.get('associated_data', '')
        aesgcm = AESGCM(api_v3_key.encode('utf-8'))
        plaintext = aesgcm.decrypt(nonce.encode(), ciphertext, aad.encode() if aad else None)
        return json.loads(plaintext.decode())

    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        cred = self._cred()
        resource = payload.get('resource', {})
        try:
            data = self._decrypt_resource(resource, cred['api_v3_key'])
        except Exception as e:
            logger.error("WechatPay decrypt callback failed: %s", e)
            return {'status': PaymentStatus.FAILED, 'error': str(e)}

        trade_state = data.get('trade_state', '')
        if trade_state == 'SUCCESS':
            status = PaymentStatus.PAID
        elif trade_state in ('NOTPAY', 'USERPAYING'):
            status = PaymentStatus.PENDING
        elif trade_state == 'REFUND':
            status = PaymentStatus.REFUNDED
        elif trade_state == 'CLOSED':
            status = PaymentStatus.CANCELLED
        else:
            status = PaymentStatus.FAILED

        attach = data.get('attach', '')
        user_id, package_id = '', ''
        if '|' in attach:
            parts = attach.split('|')
            user_id = parts[0]
            package_id = parts[1] if len(parts) > 1 else ''

        return {
            'order_id': data.get('out_trade_no', ''),
            'external_order_id': data.get('transaction_id', ''),
            'status': status,
            'amount': data.get('amount', {}).get('total', 0) / 100.0,
            'user_id': user_id,
            'package_id': package_id,
            'paid_at': datetime.now(timezone.utc) if status == PaymentStatus.PAID else None,
            'raw': data,
        }

    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        cred = self._cred()
        if not cred['mch_id'] or not cred['private_key']:
            return None
        try:
            path = f"/v3/pay/transactions/out-trade-no/{order_id}?mchid={cred['mch_id']}"
            data = self._request('GET', path, None, cred)
            trade_state = data.get('trade_state', '')
            if trade_state == 'SUCCESS':
                status = 'paid'
            elif trade_state in ('NOTPAY', 'USERPAYING'):
                status = 'pending'
            elif trade_state == 'REFUND':
                status = 'refunded'
            elif trade_state == 'CLOSED':
                status = 'cancelled'
            else:
                status = 'failed'
            return {
                'order_id': data.get('out_trade_no'),
                'external_order_id': data.get('transaction_id'),
                'status': status,
                'trade_state': trade_state,
                'trade_state_desc': data.get('trade_state_desc'),
                'amount': data.get('amount', {}).get('total', 0) / 100.0,
            }
        except Exception as e:
            logger.error("WechatPay query_order error: %s", e)
            return None


class WechatPayAPIError(Exception):
    def __init__(self, status_code: int, body: str):
        self.status_code = status_code
        self.body = body
        super().__init__(f"WechatPay API {status_code}: {body}")
