"""
Lemon Squeezy payment provider for international market
https://www.lemonsqueezy.com/
"""
import os
import hmac
import hashlib
import logging
import requests
from typing import Optional, Dict, Any
from datetime import datetime, timezone

from .base import PaymentProvider, PaymentResult, PaymentStatus, CreditPackage

logger = logging.getLogger(__name__)


class LemonSqueezyProvider(PaymentProvider):
    """Lemon Squeezy 支付提供商（国际市场）"""

    API_BASE = "https://api.lemonsqueezy.com/v1"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.api_key = cfg.get('api_key', os.getenv('LEMON_SQUEEZY_API_KEY', ''))
        self.store_id = cfg.get('store_id', os.getenv('LEMON_SQUEEZY_STORE_ID', ''))
        self.webhook_secret = cfg.get('webhook_secret', os.getenv('LEMON_SQUEEZY_WEBHOOK_SECRET', ''))

        variant_ids = cfg.get('variant_ids') or {}
        # 套餐ID映射（需要在 Lemon Squeezy 后台创建对应产品）
        self.variant_ids = {
            'starter': variant_ids.get('starter', os.getenv('LS_VARIANT_STARTER', '')),
            'basic': variant_ids.get('basic', os.getenv('LS_VARIANT_BASIC', '')),
            'standard': variant_ids.get('standard', os.getenv('LS_VARIANT_STANDARD', '')),
            'pro': variant_ids.get('pro', os.getenv('LS_VARIANT_PRO', '')),
            'enterprise': variant_ids.get('enterprise', os.getenv('LS_VARIANT_ENTERPRISE', '')),
        }

        if not self.api_key:
            logger.warning("Lemon Squeezy API key not configured")
    
    @property
    def provider_name(self) -> str:
        return "lemon_squeezy"
    
    def _get_headers(self) -> Dict[str, str]:
        return {
            'Authorization': f'Bearer {self.api_key}',
            'Accept': 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
        }
    
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
        """
        创建 Lemon Squeezy checkout
        """
        if not self.api_key or not self.store_id:
            return PaymentResult(
                success=False,
                error_message="Lemon Squeezy not configured"
            )
        
        variant_id = self.variant_ids.get(package.id)
        if not variant_id:
            return PaymentResult(
                success=False,
                error_message=f"Package {package.id} not configured in Lemon Squeezy"
            )
        
        # Create checkout session
        checkout_data = {
            'data': {
                'type': 'checkouts',
                'attributes': {
                    'checkout_data': {
                        'custom': {
                            'user_id': user_id,
                            'package_id': package.id,
                        }
                    },
                    'checkout_options': {
                        'button_color': '#7C3AED',  # Purple
                    },
                    'product_options': {
                        'redirect_url': cancel_url or return_url,
                    },
                },
                'relationships': {
                    'store': {
                        'data': {
                            'type': 'stores',
                            'id': self.store_id
                        }
                    },
                    'variant': {
                        'data': {
                            'type': 'variants',
                            'id': variant_id
                        }
                    }
                }
            }
        }
        
        try:
            logger.info(f"Creating Lemon Squeezy checkout for user {user_id}")
            
            response = requests.post(
                f"{self.API_BASE}/checkouts",
                headers=self._get_headers(),
                json=checkout_data,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            checkout_url = result.get('data', {}).get('attributes', {}).get('url')
            checkout_id = result.get('data', {}).get('id')
            
            if checkout_url:
                return PaymentResult(
                    success=True,
                    order_id=checkout_id,
                    payment_url=checkout_url,
                    raw_response=result
                )
            else:
                return PaymentResult(
                    success=False,
                    error_message="Failed to get checkout URL",
                    raw_response=result
                )
                
        except requests.RequestException as e:
            logger.error(f"Lemon Squeezy request failed: {e}")
            return PaymentResult(
                success=False,
                error_message=f"Payment request failed: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Lemon Squeezy unexpected error: {e}")
            return PaymentResult(
                success=False,
                error_message=f"Payment service error: {str(e)}"
            )
    
    def verify_webhook(self, payload: Dict[str, Any], signature: Optional[str] = None, headers: Optional[Dict[str, Any]] = None) -> bool:
        """验证 webhook 签名"""
        if not signature or not self.webhook_secret:
            return False
        
        # Lemon Squeezy uses HMAC-SHA256
        import json
        payload_str = json.dumps(payload, separators=(',', ':'))
        expected_signature = hmac.new(
            self.webhook_secret.encode('utf-8'),
            payload_str.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    def parse_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """解析 webhook 数据"""
        meta = payload.get('meta', {})
        data = payload.get('data', {})
        attributes = data.get('attributes', {})
        
        # 获取自定义数据
        custom_data = meta.get('custom_data', {})
        user_id = custom_data.get('user_id', '')
        package_id = custom_data.get('package_id', '')
        
        # 解析事件类型
        event_name = meta.get('event_name', '')
        
        # 解析状态
        if event_name == 'order_created':
            status = PaymentStatus.PAID
        elif event_name == 'order_refunded':
            status = PaymentStatus.REFUNDED
        else:
            status = PaymentStatus.PENDING
        
        return {
            'order_id': data.get('id', ''),
            'external_order_id': attributes.get('identifier', ''),
            'status': status,
            'amount': float(attributes.get('total', 0)) / 100,  # Lemon Squeezy uses cents
            'user_id': user_id,
            'package_id': package_id,
            'paid_at': datetime.now(timezone.utc) if status == PaymentStatus.PAID else None,
            'event_name': event_name,
            'raw': payload,
        }
    
    def query_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """查询订单状态"""
        if not self.api_key:
            return None
        
        try:
            response = requests.get(
                f"{self.API_BASE}/orders/{order_id}",
                headers=self._get_headers(),
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            data = result.get('data', {})
            attributes = data.get('attributes', {})
            
            status_str = attributes.get('status', '')
            if status_str == 'paid':
                status = PaymentStatus.PAID
            elif status_str == 'refunded':
                status = PaymentStatus.REFUNDED
            else:
                status = PaymentStatus.PENDING
            
            return {
                'order_id': data.get('id', ''),
                'external_order_id': attributes.get('identifier', ''),
                'status': status,
                'amount': float(attributes.get('total', 0)) / 100,
                'raw': result,
            }
            
        except Exception as e:
            logger.error(f"Lemon Squeezy query error: {e}")
            return None
