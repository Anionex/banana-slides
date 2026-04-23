"""
虎皮椒支付提供商
XunhuPay (虎皮椒) payment provider for Chinese market
https://www.xunhupay.com/
"""
import os
import hashlib
import time
import uuid
import logging
import requests
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from .base import PaymentProvider, PaymentResult, PaymentStatus, CreditPackage

logger = logging.getLogger(__name__)


class XunhuPayProvider(PaymentProvider):
    """虎皮椒支付提供商"""

    # API endpoints
    API_BASE = "https://api.xunhupay.com/payment"
    WECHAT_PAY_URL = f"{API_BASE}/do.html"
    ALIPAY_URL = f"{API_BASE}/do.html"
    QUERY_URL = f"{API_BASE}/query.html"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self._config_app_id = cfg.get('app_id', '')
        self._config_app_secret = cfg.get('app_secret', '')
        self._env_app_id = os.getenv('XUNHUPAY_APP_ID', '')
        self._env_app_secret = os.getenv('XUNHUPAY_APP_SECRET', '')

    def _load_credentials(self):
        """Load credentials: DB first, env fallback."""
        try:
            from models import SystemConfig
            system_config = SystemConfig.get_instance()
            app_id = self._config_app_id or system_config.xunhupay_app_id or self._env_app_id
            app_secret = self._config_app_secret or system_config.xunhupay_app_secret or self._env_app_secret
        except Exception:
            app_id = self._config_app_id or self._env_app_id
            app_secret = self._config_app_secret or self._env_app_secret
        return app_id, app_secret
    
    @property
    def provider_name(self) -> str:
        return "xunhupay"
    
    @staticmethod
    def _generate_sign(params: Dict[str, Any], app_secret: str) -> str:
        """
        生成签名
        签名规则：按参数名ASCII码排序，拼接成 key=value&key=value 格式，
        最后直接拼接 appsecret（不带前缀），然后 MD5
        """
        filtered = {k: v for k, v in params.items() if v and k not in ('sign', 'hash')}
        sorted_params = sorted(filtered.items(), key=lambda x: x[0])
        query_string = '&'.join([f"{k}={v}" for k, v in sorted_params])
        sign_str = f"{query_string}{app_secret}"
        return hashlib.md5(sign_str.encode('utf-8')).hexdigest()
    
    def _generate_order_id(self) -> str:
        """生成订单号"""
        timestamp = int(time.time() * 1000)
        random_part = uuid.uuid4().hex[:8]
        return f"BS{timestamp}{random_part}"
    
    def create_order(
        self,
        user_id: str,
        package: CreditPackage,
        notify_url: str,
        return_url: str,
        client_ip: Optional[str] = None,
        payment_type: Optional[str] = 'wechat',  # 'wechat' or 'alipay'
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> PaymentResult:
        """
        创建支付订单
        
        Args:
            user_id: 用户ID
            package: 积分套餐
            notify_url: 支付回调URL
            return_url: 支付完成后跳转URL
            client_ip: 客户端IP
            payment_type: 支付方式 'wechat' 或 'alipay'
        """
        app_id, app_secret = self._load_credentials()
        if not app_id or not app_secret:
            return PaymentResult(
                success=False,
                error_message="支付服务未配置"
            )

        payment_type = payment_type or 'wechat'
        return_url = cancel_url or return_url
        order_id = self._generate_order_id()

        params = {
            'version': '1.1',
            'appid': app_id,
            'trade_order_id': order_id,
            'total_fee': str(package.price_cny),
            'title': f"Banana Slides - {package.name}",
            'time': str(int(time.time())),
            'notify_url': notify_url,
            'return_url': return_url,
            'callback_url': return_url,
            'nonce_str': uuid.uuid4().hex[:16],
            'type': payment_type,
            'attach': f"{user_id}|{package.id}",
        }

        if client_ip:
            params['mch_ip'] = client_ip

        params['hash'] = self._generate_sign(params, app_secret)
        
        try:
            logger.info(f"Creating XunhuPay order: {order_id} for user {user_id}")
            
            response = requests.post(
                self.WECHAT_PAY_URL if payment_type == 'wechat' else self.ALIPAY_URL,
                data=params,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            logger.debug(f"XunhuPay response: {result}")
            
            if result.get('errcode') == 0:
                return PaymentResult(
                    success=True,
                    order_id=order_id,
                    external_order_id=result.get('openid'),  # 虎皮椒订单号
                    payment_url=result.get('url'),
                    qr_code_url=result.get('url_qrcode'),
                    raw_response=result
                )
            else:
                error_msg = result.get('errmsg', '创建订单失败')
                logger.error(f"XunhuPay order creation failed: {error_msg}")
                return PaymentResult(
                    success=False,
                    order_id=order_id,
                    error_message=error_msg,
                    raw_response=result
                )
                
        except requests.RequestException as e:
            logger.error(f"XunhuPay request failed: {e}")
            return PaymentResult(
                success=False,
                order_id=order_id,
                error_message=f"支付请求失败: {str(e)}"
            )
        except Exception as e:
            logger.error(f"XunhuPay unexpected error: {e}")
            return PaymentResult(
                success=False,
                order_id=order_id,
                error_message=f"支付服务异常: {str(e)}"
            )
    
    def verify_webhook(self, payload: Dict[str, Any], signature: Optional[str] = None, headers: Optional[Dict[str, Any]] = None) -> bool:
        """验证 webhook 签名"""
        if not payload:
            return False

        received_hash = payload.get('hash', '')
        if not received_hash:
            return False

        _app_id, app_secret = self._load_credentials()
        if not app_secret:
            return False

        # 重新计算签名
        expected_hash = self._generate_sign(payload, app_secret)

        return received_hash.lower() == expected_hash.lower()
    
    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """解析 webhook 数据"""
        # 解析附加数据
        attach = payload.get('attach', '')
        user_id, package_id = '', ''
        if '|' in attach:
            parts = attach.split('|')
            user_id = parts[0]
            package_id = parts[1] if len(parts) > 1 else ''
        
        # 解析状态
        status_code = payload.get('status', '')
        if status_code == 'OD':  # 已支付
            status = PaymentStatus.PAID
        elif status_code == 'WP':  # 待支付
            status = PaymentStatus.PENDING
        else:
            status = PaymentStatus.FAILED
        
        return {
            'order_id': payload.get('trade_order_id', ''),
            'external_order_id': payload.get('open_order_id', ''),
            'status': status,
            'amount': float(payload.get('total_fee', 0)),
            'user_id': user_id,
            'package_id': package_id,
            'paid_at': datetime.now(timezone.utc) if status == PaymentStatus.PAID else None,
            'raw': payload,
        }
    
    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """查询订单状态"""
        app_id, app_secret = self._load_credentials()
        if not app_id or not app_secret:
            return None

        params = {
            'appid': app_id,
            'out_trade_order': order_id,
            'time': str(int(time.time())),
            'nonce_str': uuid.uuid4().hex[:16],
        }
        params['hash'] = self._generate_sign(params, app_secret)
        
        try:
            response = requests.post(self.QUERY_URL, data=params, timeout=30)
            response.raise_for_status()
            result = response.json()
            
            if result.get('errcode') == 0:
                return self.parse_webhook(result.get('data', {}))
            else:
                logger.error(f"XunhuPay query failed: {result.get('errmsg')}")
                return None
                
        except Exception as e:
            logger.error(f"XunhuPay query error: {e}")
            return None
