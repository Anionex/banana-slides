"""
SystemConfig Model - 系统级配置
存储全局系统配置，如用户策略、积分定价、邀请奖励等
"""
import json
from datetime import datetime, timezone
from models import db


class SystemConfig(db.Model):
    """系统配置 - 单例模式，始终使用 id=1"""
    __tablename__ = 'system_config'

    id = db.Column(db.Integer, primary_key=True, default=1)

    # ==================== 用户策略 ====================
    # 哪些设置字段允许用户自定义（JSON 数组）
    # 例如: ["api_key", "api_base_url", "text_model", "image_model"]
    user_editable_fields = db.Column(db.Text, default='["output_language", "image_resolution", "image_aspect_ratio"]')

    # ==================== 积分定价配置 ====================
    # 注册奖励积分
    registration_bonus = db.Column(db.Integer, default=50)
    # 邀请奖励积分（邀请人和被邀请人各得）
    invitation_bonus = db.Column(db.Integer, default=50)
    # 最大邀请码数量（每用户）
    max_invitation_codes = db.Column(db.Integer, default=3)

    # 生成大纲积分
    cost_generate_outline = db.Column(db.Integer, default=5)
    # 生成描述积分（每页）
    cost_generate_description = db.Column(db.Integer, default=1)
    # 生成图片积分（每页，按分辨率分级）
    cost_generate_image_1k = db.Column(db.Integer, default=4)
    cost_generate_image_2k = db.Column(db.Integer, default=8)
    cost_generate_image_4k = db.Column(db.Integer, default=16)
    # 编辑图片积分
    cost_edit_image = db.Column(db.Integer, default=8)
    # 生成素材积分
    cost_generate_material = db.Column(db.Integer, default=10)
    # 修改大纲积分
    cost_refine_outline = db.Column(db.Integer, default=2)
    # 修改描述积分（每页）
    cost_refine_description = db.Column(db.Integer, default=1)
    # 解析参考文件积分
    cost_parse_file = db.Column(db.Integer, default=5)
    # 导出可编辑PPTX积分（每页）
    cost_export_editable = db.Column(db.Integer, default=15)

    # ==================== 功能开关 ====================
    # 是否允许用户购买积分
    enable_credits_purchase = db.Column(db.Boolean, default=True)
    # 是否允许邀请功能
    enable_invitation = db.Column(db.Boolean, default=True)

    # ==================== 套餐配置 ====================
    # 套餐配置（JSON 格式）
    credit_packages = db.Column(db.Text, default=None)

    # ==================== 文生图渠道池 ====================
    # 多渠道配置（JSON 格式），按优先级自动降级
    image_provider_pool = db.Column(db.Text, default=None)

    # 时间戳
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @staticmethod
    def get_instance():
        """获取或创建系统配置实例（单例）"""
        config = SystemConfig.query.get(1)
        if not config:
            config = SystemConfig(id=1)
            db.session.add(config)
            db.session.commit()
        return config

    def get_user_editable_fields(self):
        """获取用户可编辑字段列表"""
        try:
            return json.loads(self.user_editable_fields or '[]')
        except (json.JSONDecodeError, TypeError):
            return ['output_language', 'image_resolution', 'image_aspect_ratio']

    def set_user_editable_fields(self, fields: list):
        """设置用户可编辑字段"""
        self.user_editable_fields = json.dumps(fields)

    def get_credit_packages(self):
        """获取积分套餐配置"""
        if not self.credit_packages:
            return None
        try:
            return json.loads(self.credit_packages)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_credit_packages(self, packages: list):
        """设置积分套餐配置"""
        self.credit_packages = json.dumps(packages)

    def get_image_provider_pool(self):
        """获取文生图渠道池配置"""
        if not self.image_provider_pool:
            return None
        try:
            return json.loads(self.image_provider_pool)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_image_provider_pool(self, pool: list):
        """设置文生图渠道池配置"""
        self.image_provider_pool = json.dumps(pool)

    def get_image_cost_by_resolution(self, resolution: str) -> int:
        """根据分辨率获取图片生成积分"""
        costs = {
            '1K': self.cost_generate_image_1k,
            '2K': self.cost_generate_image_2k,
            '4K': self.cost_generate_image_4k,
        }
        return costs.get(resolution, self.cost_generate_image_2k)

    def get_credit_costs(self):
        """获取所有积分消耗配置"""
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
        """返回渠道池配置，隐藏 api_key 明文"""
        pool = self.get_image_provider_pool()
        if not pool:
            return pool
        safe = []
        for ch in pool:
            c = dict(ch)
            key = c.get('api_key', '')
            c['api_key_length'] = len(key) if key else 0
            c['api_key'] = ''
            safe.append(c)
        return safe

    def to_dict(self):
        """转换为字典"""
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
            'enable_credits_purchase': self.enable_credits_purchase,
            'enable_invitation': self.enable_invitation,
            'credit_packages': self.get_credit_packages(),
            'image_provider_pool': self._safe_pool_dict(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
