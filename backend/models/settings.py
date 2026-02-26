"""Settings model"""
import json
from datetime import datetime, timezone
from . import db


class Settings(db.Model):
    """
    Settings model - stores global application settings
    """
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True, default=1)
    ai_provider_format = db.Column(db.String(20), nullable=True)   # AI提供商格式: openai, gemini (NULL=use .env)
    api_base_url = db.Column(db.String(500), nullable=True)        # API基础URL
    api_key = db.Column(db.String(500), nullable=True)             # API密钥
    image_resolution = db.Column(db.String(20), nullable=True)     # 图像清晰度: 1K, 2K, 4K (NULL=use .env)
    image_aspect_ratio = db.Column(db.String(10), nullable=True)   # 图像比例: 16:9, 4:3, 1:1 (NULL=use .env)
    max_description_workers = db.Column(db.Integer, nullable=True)  # 描述生成最大工作线程数 (NULL=use .env)
    max_image_workers = db.Column(db.Integer, nullable=True)        # 图像生成最大工作线程数 (NULL=use .env)

    # 新增：大模型与 MinerU 相关可视化配置（可在设置页中编辑）
    text_model = db.Column(db.String(100), nullable=True)  # 文本大模型名称（覆盖 Config.TEXT_MODEL）
    image_model = db.Column(db.String(100), nullable=True)  # 图片大模型名称（覆盖 Config.IMAGE_MODEL）
    mineru_api_base = db.Column(db.String(255), nullable=True)  # MinerU 服务地址（覆盖 Config.MINERU_API_BASE）
    mineru_token = db.Column(db.String(500), nullable=True)  # MinerU API Token（覆盖 Config.MINERU_TOKEN）
    image_caption_model = db.Column(db.String(100), nullable=True)  # 图片识别模型（覆盖 Config.IMAGE_CAPTION_MODEL）
    output_language = db.Column(db.String(10), nullable=True)  # 输出语言偏好（zh, en, ja, auto）(NULL=use .env)
    
    # 推理模式配置（分别控制文本和图像生成）
    enable_text_reasoning = db.Column(db.Boolean, nullable=False, default=False)  # 文本生成是否开启推理
    text_thinking_budget = db.Column(db.Integer, nullable=False, default=1024)  # 文本推理思考负载 (1-8192)
    enable_image_reasoning = db.Column(db.Boolean, nullable=False, default=False)  # 图像生成是否开启推理
    image_thinking_budget = db.Column(db.Integer, nullable=False, default=1024)  # 图像推理思考负载 (1-8192)
    
    # 百度 API 配置
    baidu_api_key = db.Column(db.String(500), nullable=True)  # 百度 API Key

    # 每种模型类型的提供商配置（source 可选 gemini/openai/lazyllm厂商名，NULL=使用全局配置）
    text_model_source = db.Column(db.String(50), nullable=True)           # 文本模型提供商 (gemini, openai, qwen, doubao, deepseek, ...)
    image_model_source = db.Column(db.String(50), nullable=True)          # 图片模型提供商
    image_caption_model_source = db.Column(db.String(50), nullable=True)  # 图片识别模型提供商
    lazyllm_api_keys = db.Column(db.Text, nullable=True)                  # JSON: {"qwen": "key1", "doubao": "key2", ...}

    # Per-model API 凭证（当 source 为 gemini/openai 时使用，NULL=使用全局 api_key/api_base_url）
    text_api_key = db.Column(db.String(500), nullable=True)
    text_api_base_url = db.Column(db.String(500), nullable=True)
    image_api_key = db.Column(db.String(500), nullable=True)
    image_api_base_url = db.Column(db.String(500), nullable=True)
    image_caption_api_key = db.Column(db.String(500), nullable=True)
    image_caption_api_base_url = db.Column(db.String(500), nullable=True)
    
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def _val(self, attr, defaults):
        """Return DB value, falling back to .env default when None."""
        v = getattr(self, attr)
        return v if v is not None else defaults.get(attr)

    def to_dict(self):
        """Convert to dictionary, merging .env defaults for None fields."""
        d = Settings._get_config_defaults()
        api_key = self._val('api_key', d)
        mineru_token = self._val('mineru_token', d)
        baidu_api_key = self._val('baidu_api_key', d)
        text_api_key = self._val('text_api_key', d)
        image_api_key = self._val('image_api_key', d)
        image_caption_api_key = self._val('image_caption_api_key', d)
        return {
            'id': self.id,
            'ai_provider_format': self._val('ai_provider_format', d),
            'api_base_url': self._val('api_base_url', d),
            'api_key_length': len(api_key) if api_key else 0,
            'image_resolution': self._val('image_resolution', d),
            'image_aspect_ratio': self._val('image_aspect_ratio', d),
            'max_description_workers': self._val('max_description_workers', d),
            'max_image_workers': self._val('max_image_workers', d),
            'text_model': self._val('text_model', d),
            'image_model': self._val('image_model', d),
            'mineru_api_base': self._val('mineru_api_base', d),
            'mineru_token_length': len(mineru_token) if mineru_token else 0,
            'image_caption_model': self._val('image_caption_model', d),
            'output_language': self._val('output_language', d),
            'enable_text_reasoning': self.enable_text_reasoning,
            'text_thinking_budget': self.text_thinking_budget,
            'enable_image_reasoning': self.enable_image_reasoning,
            'image_thinking_budget': self.image_thinking_budget,
            'baidu_api_key_length': len(baidu_api_key) if baidu_api_key else 0,
            'text_model_source': self._val('text_model_source', d),
            'image_model_source': self._val('image_model_source', d),
            'image_caption_model_source': self._val('image_caption_model_source', d),
            'lazyllm_api_keys_info': self._get_lazyllm_api_keys_info(self._val('lazyllm_api_keys', d)),
            'text_api_key_length': len(text_api_key) if text_api_key else 0,
            'text_api_base_url': self._val('text_api_base_url', d),
            'image_api_key_length': len(image_api_key) if image_api_key else 0,
            'image_api_base_url': self._val('image_api_base_url', d),
            'image_caption_api_key_length': len(image_caption_api_key) if image_caption_api_key else 0,
            'image_caption_api_base_url': self._val('image_caption_api_base_url', d),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def _get_lazyllm_api_keys_info(self, raw=None):
        """Return vendor names and key lengths (no plaintext) for frontend display."""
        data = raw if raw is not None else self.lazyllm_api_keys
        if not data:
            return {}
        try:
            keys = json.loads(data)
            return {vendor: len(key) for vendor, key in keys.items() if key}
        except (json.JSONDecodeError, TypeError):
            return {}

    def get_lazyllm_api_keys_dict(self):
        """Parse lazyllm_api_keys JSON into a dict."""
        if not self.lazyllm_api_keys:
            return {}
        try:
            return json.loads(self.lazyllm_api_keys)
        except (json.JSONDecodeError, TypeError):
            return {}

    @staticmethod
    def _get_config_defaults():
        """Return a dict of default values from Config/env for settings fields."""
        from config import Config
        from services.ai_providers.lazyllm_env import collect_env_lazyllm_api_keys

        provider = (Config.AI_PROVIDER_FORMAT or '').lower()
        if provider == 'openai':
            api_base = Config.OPENAI_API_BASE or None
            api_key = Config.OPENAI_API_KEY or None
        elif provider == 'lazyllm':
            api_base = None
            api_key = None
        else:
            api_base = Config.GOOGLE_API_BASE or None
            api_key = Config.GOOGLE_API_KEY or None

        return {
            'ai_provider_format': Config.AI_PROVIDER_FORMAT,
            'api_base_url': api_base,
            'api_key': api_key,
            'image_resolution': Config.DEFAULT_RESOLUTION,
            'image_aspect_ratio': Config.DEFAULT_ASPECT_RATIO,
            'max_description_workers': Config.MAX_DESCRIPTION_WORKERS,
            'max_image_workers': Config.MAX_IMAGE_WORKERS,
            'text_model': Config.TEXT_MODEL,
            'image_model': Config.IMAGE_MODEL,
            'mineru_api_base': Config.MINERU_API_BASE,
            'mineru_token': Config.MINERU_TOKEN,
            'image_caption_model': Config.IMAGE_CAPTION_MODEL,
            'output_language': Config.OUTPUT_LANGUAGE,
            'baidu_api_key': Config.BAIDU_API_KEY or None,
            'text_model_source': getattr(Config, 'TEXT_MODEL_SOURCE', None),
            'image_model_source': getattr(Config, 'IMAGE_MODEL_SOURCE', None),
            'image_caption_model_source': getattr(Config, 'IMAGE_CAPTION_MODEL_SOURCE', None),
            'lazyllm_api_keys': collect_env_lazyllm_api_keys(),
        }

    @staticmethod
    def get_settings():
        """
        Get or create the single settings instance.

        Returns the ORM object as-is from the database.  ``.env``
        defaults for ``None`` fields are merged only at serialisation
        time in ``to_dict()``, so this method has no write side-effects.
        """
        settings = Settings.query.first()

        if settings is None:
            settings = Settings(id=1)
            db.session.add(settings)
            db.session.commit()

        return settings

    def __repr__(self):
        return f'<Settings id={self.id}>'
