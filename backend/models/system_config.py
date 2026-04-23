"""SystemConfig Model - 系统级配置"""
from __future__ import annotations

import copy
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models import db
from services.provider_metadata import (
    PAYMENT_PROVIDER_SECRET_FIELDS,
    STORAGE_PROVIDER_SECRET_FIELDS,
)


class SystemConfig(db.Model):
    """系统配置 - 单例模式，始终使用 id=1"""
    __tablename__ = 'system_config'

    id = db.Column(db.Integer, primary_key=True, default=1)

    # ==================== 用户策略 ====================
    user_editable_fields = db.Column(
        db.Text,
        default='["output_language", "image_resolution", "image_aspect_ratio", "description_generation_mode", "description_extra_fields", "image_prompt_extra_fields"]',
    )

    # ==================== 积分定价配置 ====================
    registration_bonus = db.Column(db.Integer, default=50)
    invitation_bonus = db.Column(db.Integer, default=50)
    max_invitation_codes = db.Column(db.Integer, default=3)

    cost_generate_outline = db.Column(db.Integer, default=5)
    cost_generate_description = db.Column(db.Integer, default=1)
    cost_generate_image_1k = db.Column(db.Integer, default=4)
    cost_generate_image_2k = db.Column(db.Integer, default=8)
    cost_generate_image_4k = db.Column(db.Integer, default=16)
    cost_edit_image = db.Column(db.Integer, default=8)
    cost_generate_material = db.Column(db.Integer, default=10)
    cost_refine_outline = db.Column(db.Integer, default=2)
    cost_refine_description = db.Column(db.Integer, default=1)
    cost_parse_file = db.Column(db.Integer, default=5)
    cost_export_editable = db.Column(db.Integer, default=15)

    # ==================== 旧支付配置（兼容） ====================
    xunhupay_app_id = db.Column(db.String(100), default='')
    xunhupay_app_secret = db.Column(db.String(200), default='')

    # ==================== 功能开关 ====================
    enable_credits_purchase = db.Column(db.Boolean, default=True)
    enable_alipay = db.Column(db.Boolean, default=False)
    enable_invitation = db.Column(db.Boolean, default=True)

    # ==================== 套餐配置 ====================
    credit_packages = db.Column(db.Text, default=None)

    # ==================== 文生图渠道池 ====================
    image_provider_pool = db.Column(db.Text, default=None)

    # ==================== 新支付 / 存储配置 ====================
    default_payment_provider = db.Column(db.String(50), default='stripe')
    enabled_payment_providers = db.Column(db.Text, default='["stripe"]')
    payment_provider_configs = db.Column(db.Text, default=None)

    storage_backend = db.Column(db.String(50), default='local')
    storage_provider_configs = db.Column(db.Text, default=None)
    cdn_base_url = db.Column(db.String(512), default=None)

    # 时间戳
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @staticmethod
    def get_instance():
        """获取或创建系统配置实例（单例）"""
        config = SystemConfig.query.get(1)
        if not config:
            config = SystemConfig(id=1)
            db.session.add(config)
            db.session.commit()
        return config

    @staticmethod
    def _loads_json(raw: Optional[str], default: Any):
        if raw in (None, ''):
            return copy.deepcopy(default)
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return copy.deepcopy(default)

    @staticmethod
    def _dumps_json(value: Any) -> Optional[str]:
        if value is None:
            return None
        return json.dumps(value)

    def get_user_editable_fields(self) -> List[str]:
        return self._loads_json(
            self.user_editable_fields,
            ['output_language', 'image_resolution', 'image_aspect_ratio'],
        )

    def set_user_editable_fields(self, fields: List[str]):
        self.user_editable_fields = self._dumps_json(fields)

    def get_credit_packages(self):
        return self._loads_json(self.credit_packages, None)

    def set_credit_packages(self, packages: Optional[list]):
        self.credit_packages = self._dumps_json(packages)

    def get_image_provider_pool(self):
        return self._loads_json(self.image_provider_pool, None)

    def set_image_provider_pool(self, pool: Optional[list]):
        self.image_provider_pool = self._dumps_json(pool)

    def get_enabled_payment_providers(self) -> List[str]:
        providers = self._loads_json(self.enabled_payment_providers, ['stripe']) or []
        return [str(provider).strip().lower() for provider in providers if provider]

    def set_enabled_payment_providers(self, providers: List[str]):
        normalized = [str(provider).strip().lower() for provider in providers if provider]
        self.enabled_payment_providers = self._dumps_json(normalized)

    def get_payment_provider_configs(self, raw: bool = False) -> Dict[str, Any]:
        configs = self._loads_json(self.payment_provider_configs, {}) or {}
        if raw:
            return configs
        return self._mask_provider_configs(configs, PAYMENT_PROVIDER_SECRET_FIELDS)

    def set_payment_provider_configs(self, configs: Optional[Dict[str, Any]]):
        self.payment_provider_configs = self._dumps_json(configs or {})

    def get_storage_provider_configs(self, raw: bool = False) -> Dict[str, Any]:
        configs = self._loads_json(self.storage_provider_configs, {}) or {}
        if raw:
            return configs
        return self._mask_provider_configs(configs, STORAGE_PROVIDER_SECRET_FIELDS)

    def set_storage_provider_configs(self, configs: Optional[Dict[str, Any]]):
        self.storage_provider_configs = self._dumps_json(configs or {})

    def get_image_cost_by_resolution(self, resolution: str) -> int:
        costs = {
            '1K': self.cost_generate_image_1k,
            '2K': self.cost_generate_image_2k,
            '4K': self.cost_generate_image_4k,
        }
        return costs.get(resolution, self.cost_generate_image_2k)

    def get_credit_costs(self):
        return {
            'generate_outline': self.cost_generate_outline,
            'generate_description': self.cost_generate_description,
            'generate_image_1k': self.cost_generate_image_1k,
            'generate_image_2k': self.cost_generate_image_2k,
            'generate_image_4k': self.cost_generate_image_4k,
            'edit_image': self.cost_edit_image,
            'generate_material': self.cost_generate_material,
            'refine_outline': self.cost_refine_outline,
            'refine_description': self.cost_refine_description,
            'parse_file': self.cost_parse_file,
            'export_editable': self.cost_export_editable,
        }

    def _safe_pool_dict(self):
        pool = self.get_image_provider_pool()
        if not pool:
            return pool
        safe = []
        for channel in pool:
            item = dict(channel)
            key = item.get('api_key', '')
            item['api_key_length'] = len(key) if key else 0
            item['api_key'] = ''
            safe.append(item)
        return safe

    @staticmethod
    def _mask_provider_configs(configs: Dict[str, Any], secret_fields_map: Dict[str, List[str]]) -> Dict[str, Any]:
        safe_configs: Dict[str, Any] = copy.deepcopy(configs or {})
        for provider_name, secret_fields in secret_fields_map.items():
            provider_cfg = safe_configs.get(provider_name)
            if not isinstance(provider_cfg, dict):
                continue
            for field in secret_fields:
                value = provider_cfg.get(field, '')
                provider_cfg[f'{field}_length'] = len(value) if isinstance(value, str) and value else 0
                provider_cfg[field] = ''
        return safe_configs

    def to_dict(self):
        return {
            'id': self.id,
            'user_editable_fields': self.get_user_editable_fields(),
            'registration_bonus': self.registration_bonus,
            'invitation_bonus': self.invitation_bonus,
            'max_invitation_codes': self.max_invitation_codes,
            'cost_generate_outline': self.cost_generate_outline,
            'cost_generate_description': self.cost_generate_description,
            'cost_generate_image_1k': self.cost_generate_image_1k,
            'cost_generate_image_2k': self.cost_generate_image_2k,
            'cost_generate_image_4k': self.cost_generate_image_4k,
            'cost_edit_image': self.cost_edit_image,
            'cost_generate_material': self.cost_generate_material,
            'cost_refine_outline': self.cost_refine_outline,
            'cost_refine_description': self.cost_refine_description,
            'cost_parse_file': self.cost_parse_file,
            'cost_export_editable': self.cost_export_editable,
            'xunhupay_app_id': self.xunhupay_app_id or '',
            'xunhupay_app_secret_length': len(self.xunhupay_app_secret or ''),
            'enable_credits_purchase': self.enable_credits_purchase,
            'enable_alipay': self.enable_alipay,
            'enable_invitation': self.enable_invitation,
            'credit_packages': self.get_credit_packages(),
            'image_provider_pool': self._safe_pool_dict(),
            'default_payment_provider': (self.default_payment_provider or 'stripe').strip().lower(),
            'enabled_payment_providers': self.get_enabled_payment_providers(),
            'payment_provider_configs': self.get_payment_provider_configs(raw=False),
            'storage_backend': (self.storage_backend or 'local').strip().lower(),
            'storage_provider_configs': self.get_storage_provider_configs(raw=False),
            'cdn_base_url': self.cdn_base_url or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
