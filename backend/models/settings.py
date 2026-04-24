"""Settings model"""
import json
from datetime import datetime, timezone
from . import db


class Settings(db.Model):
    """
    Settings model - stores global application settings
    """
    __tablename__ = 'settings'

    COPYABLE_FIELDS = (
        'ai_provider_format',
        'api_base_url',
        'api_key',
        'image_resolution',
        'image_aspect_ratio',
        'max_description_workers',
        'max_image_workers',
        'text_model',
        'image_model',
        'mineru_api_base',
        'mineru_token',
        'image_caption_model',
        'output_language',
        'enable_text_reasoning',
        'text_thinking_budget',
        'enable_image_reasoning',
        'image_thinking_budget',
        'description_generation_mode',
        'description_extra_fields',
        'image_prompt_extra_fields',
        'baidu_api_key',
        'text_model_source',
        'image_model_source',
        'image_caption_model_source',
        'lazyllm_api_keys',
        'text_api_key',
        'text_api_base_url',
        'image_api_key',
        'image_api_base_url',
        'image_caption_api_key',
        'image_caption_api_base_url',
        'jwt_secret_key',
        'admin_init_phone',
        'admin_init_username',
        'admin_init_password',
        'sms_provider',
        'sms_access_key_id',
        'sms_access_key_secret',
        'sms_sign_name',
        'sms_template_code',
        'sms_endpoint',
        'sms_code_ttl_minutes',
        'sms_rate_limit_per_day',
        'sms_mock_code',
        'wechat_pay_enabled',
        'wechat_pay_mock',
        'wechat_pay_app_id',
        'wechat_pay_mch_id',
        'wechat_pay_serial_no',
        'wechat_pay_private_key',
        'wechat_pay_api_v3_key',
        'wechat_pay_gateway_url',
        'wechat_pay_notify_url',
        'wechat_pay_order_expire_minutes',
        'recharge_packages',
        'subscription_plans',
    )

    id = db.Column(db.Integer, primary_key=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, unique=True, index=True)
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
    
    # 描述生成模式: streaming / parallel (NULL=默认 streaming)
    description_generation_mode = db.Column(db.String(20), nullable=True)

    # 描述额外字段配置: JSON 数组如 ["排版布局", "视觉素材"] (NULL=默认 DEFAULT_EXTRA_FIELDS)
    description_extra_fields = db.Column(db.Text, nullable=True)
    image_prompt_extra_fields = db.Column(db.Text, nullable=True)  # JSON array: 哪些额外字段传入文生图 prompt

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

    # 用户系统配置
    jwt_secret_key = db.Column(db.String(500), nullable=True)
    admin_init_phone = db.Column(db.String(20), nullable=True)
    admin_init_username = db.Column(db.String(50), nullable=True)
    admin_init_password = db.Column(db.String(255), nullable=True)
    sms_provider = db.Column(db.String(30), nullable=True)
    sms_access_key_id = db.Column(db.String(255), nullable=True)
    sms_access_key_secret = db.Column(db.String(255), nullable=True)
    sms_sign_name = db.Column(db.String(255), nullable=True)
    sms_template_code = db.Column(db.String(255), nullable=True)
    sms_endpoint = db.Column(db.String(500), nullable=True)
    sms_code_ttl_minutes = db.Column(db.Integer, nullable=True)
    sms_rate_limit_per_day = db.Column(db.Integer, nullable=True)
    sms_mock_code = db.Column(db.String(20), nullable=True)
    wechat_pay_enabled = db.Column(db.Boolean, nullable=True)
    wechat_pay_mock = db.Column(db.Boolean, nullable=True)
    wechat_pay_app_id = db.Column(db.String(255), nullable=True)
    wechat_pay_mch_id = db.Column(db.String(255), nullable=True)
    wechat_pay_serial_no = db.Column(db.String(255), nullable=True)
    wechat_pay_private_key = db.Column(db.Text, nullable=True)
    wechat_pay_api_v3_key = db.Column(db.String(255), nullable=True)
    wechat_pay_gateway_url = db.Column(db.String(500), nullable=True)
    wechat_pay_notify_url = db.Column(db.String(500), nullable=True)
    wechat_pay_order_expire_minutes = db.Column(db.Integer, nullable=True)
    recharge_packages = db.Column(db.Text, nullable=True)
    subscription_plans = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def _val(self, attr, defaults):
        """Return DB value, falling back to .env default when None."""
        v = getattr(self, attr)
        return v if v is not None else defaults.get(attr)

    @staticmethod
    def _mask_secret(value, keep_start=4, keep_end=4):
        """Return a masked preview so UI can show that a secret is configured."""
        if not value:
            return None
        normalized = str(value).replace("\r", "").replace("\n", "\\n")
        if len(normalized) <= keep_start + keep_end:
            return "*" * len(normalized)
        return f"{normalized[:keep_start]}***{normalized[-keep_end:]}"

    DEFAULT_EXTRA_FIELDS = ['视觉元素', '视觉焦点', '排版布局', '演讲者备注']
    DEFAULT_IMAGE_PROMPT_FIELDS = ['视觉元素', '视觉焦点', '排版布局']  # 演讲者备注默认不传入图片生成

    def get_description_extra_fields(self):
        """Return parsed extra fields list."""
        if self.description_extra_fields:
            try:
                fields = json.loads(self.description_extra_fields)
                if isinstance(fields, list):
                    return fields
            except (json.JSONDecodeError, TypeError):
                pass
        return list(self.DEFAULT_EXTRA_FIELDS)

    def get_image_prompt_extra_fields(self):
        """Return parsed list of extra fields to include in image prompts."""
        if self.image_prompt_extra_fields:
            try:
                fields = json.loads(self.image_prompt_extra_fields)
                if isinstance(fields, list):
                    return fields
            except (json.JSONDecodeError, TypeError):
                pass
        return list(self.DEFAULT_IMAGE_PROMPT_FIELDS)

    def _get_list_value(self, raw_value, default_values, include_defaults=True):
        if raw_value:
            try:
                fields = json.loads(raw_value)
                if isinstance(fields, list):
                    return fields
            except (json.JSONDecodeError, TypeError):
                pass
        return list(default_values) if include_defaults else []

    def to_dict(self, include_defaults=True):
        """Convert to dictionary, optionally merging .env defaults for None fields."""
        d = Settings._get_config_defaults() if include_defaults else {}
        api_key = self._val('api_key', d) if include_defaults else self.api_key
        mineru_token = self._val('mineru_token', d) if include_defaults else self.mineru_token
        baidu_api_key = self._val('baidu_api_key', d) if include_defaults else self.baidu_api_key
        text_api_key = self._val('text_api_key', d) if include_defaults else self.text_api_key
        image_api_key = self._val('image_api_key', d) if include_defaults else self.image_api_key
        image_caption_api_key = (
            self._val('image_caption_api_key', d)
            if include_defaults
            else self.image_caption_api_key
        )
        jwt_secret_key = self._val('jwt_secret_key', d) if include_defaults else self.jwt_secret_key
        admin_init_password = (
            self._val('admin_init_password', d)
            if include_defaults
            else self.admin_init_password
        )
        sms_access_key_secret = (
            self._val('sms_access_key_secret', d)
            if include_defaults
            else self.sms_access_key_secret
        )
        wechat_pay_private_key = (
            self._val('wechat_pay_private_key', d)
            if include_defaults
            else self.wechat_pay_private_key
        )
        wechat_pay_api_v3_key = (
            self._val('wechat_pay_api_v3_key', d)
            if include_defaults
            else self.wechat_pay_api_v3_key
        )
        return {
            'id': self.id,
            'owner_user_id': self.owner_user_id,
            'scope': 'private' if self.owner_user_id else 'global',
            'ai_provider_format': self._val('ai_provider_format', d) if include_defaults else self.ai_provider_format,
            'api_base_url': self._val('api_base_url', d) if include_defaults else self.api_base_url,
            'api_key_length': len(api_key) if api_key else 0,
            'image_resolution': self._val('image_resolution', d) if include_defaults else self.image_resolution,
            'image_aspect_ratio': self._val('image_aspect_ratio', d) if include_defaults else self.image_aspect_ratio,
            'max_description_workers': self._val('max_description_workers', d) if include_defaults else self.max_description_workers,
            'max_image_workers': self._val('max_image_workers', d) if include_defaults else self.max_image_workers,
            'text_model': self._val('text_model', d) if include_defaults else self.text_model,
            'image_model': self._val('image_model', d) if include_defaults else self.image_model,
            'mineru_api_base': self._val('mineru_api_base', d) if include_defaults else self.mineru_api_base,
            'mineru_token_length': len(mineru_token) if mineru_token else 0,
            'image_caption_model': self._val('image_caption_model', d) if include_defaults else self.image_caption_model,
            'output_language': self._val('output_language', d) if include_defaults else self.output_language,
            'description_generation_mode': (
                (self._val('description_generation_mode', d) or 'streaming')
                if include_defaults
                else self.description_generation_mode
            ),
            'description_extra_fields': self._get_list_value(
                self.description_extra_fields,
                self.DEFAULT_EXTRA_FIELDS,
                include_defaults=include_defaults,
            ),
            'image_prompt_extra_fields': self._get_list_value(
                self.image_prompt_extra_fields,
                self.DEFAULT_IMAGE_PROMPT_FIELDS,
                include_defaults=include_defaults,
            ),
            'enable_text_reasoning': self.enable_text_reasoning,
            'text_thinking_budget': self.text_thinking_budget,
            'enable_image_reasoning': self.enable_image_reasoning,
            'image_thinking_budget': self.image_thinking_budget,
            'baidu_api_key_length': len(baidu_api_key) if baidu_api_key else 0,
            'text_model_source': self._val('text_model_source', d) if include_defaults else self.text_model_source,
            'image_model_source': self._val('image_model_source', d) if include_defaults else self.image_model_source,
            'image_caption_model_source': (
                self._val('image_caption_model_source', d)
                if include_defaults
                else self.image_caption_model_source
            ),
            'lazyllm_api_keys_info': self._get_lazyllm_api_keys_info(
                self._val('lazyllm_api_keys', d) if include_defaults else self.lazyllm_api_keys
            ),
            'text_api_key_length': len(text_api_key) if text_api_key else 0,
            'text_api_base_url': self._val('text_api_base_url', d) if include_defaults else self.text_api_base_url,
            'image_api_key_length': len(image_api_key) if image_api_key else 0,
            'image_api_base_url': self._val('image_api_base_url', d) if include_defaults else self.image_api_base_url,
            'image_caption_api_key_length': len(image_caption_api_key) if image_caption_api_key else 0,
            'image_caption_api_base_url': (
                self._val('image_caption_api_base_url', d)
                if include_defaults
                else self.image_caption_api_base_url
            ),
            'jwt_secret_key_length': len(jwt_secret_key) if jwt_secret_key else 0,
            'jwt_secret_key_masked': self._mask_secret(jwt_secret_key),
            'admin_init_phone': self._val('admin_init_phone', d) if include_defaults else self.admin_init_phone,
            'admin_init_username': self._val('admin_init_username', d) if include_defaults else self.admin_init_username,
            'admin_init_password_length': len(admin_init_password) if admin_init_password else 0,
            'admin_init_password_masked': self._mask_secret(admin_init_password),
            'sms_provider': self._val('sms_provider', d) if include_defaults else self.sms_provider,
            'sms_access_key_id': self._val('sms_access_key_id', d) if include_defaults else self.sms_access_key_id,
            'sms_access_key_secret_length': len(sms_access_key_secret) if sms_access_key_secret else 0,
            'sms_access_key_secret_masked': self._mask_secret(sms_access_key_secret),
            'sms_sign_name': self._val('sms_sign_name', d) if include_defaults else self.sms_sign_name,
            'sms_template_code': self._val('sms_template_code', d) if include_defaults else self.sms_template_code,
            'sms_endpoint': self._val('sms_endpoint', d) if include_defaults else self.sms_endpoint,
            'sms_code_ttl_minutes': self._val('sms_code_ttl_minutes', d) if include_defaults else self.sms_code_ttl_minutes,
            'sms_rate_limit_per_day': self._val('sms_rate_limit_per_day', d) if include_defaults else self.sms_rate_limit_per_day,
            'sms_mock_code': self._val('sms_mock_code', d) if include_defaults else self.sms_mock_code,
            'wechat_pay_enabled': self._val('wechat_pay_enabled', d) if include_defaults else self.wechat_pay_enabled,
            'wechat_pay_mock': self._val('wechat_pay_mock', d) if include_defaults else self.wechat_pay_mock,
            'wechat_pay_app_id': self._val('wechat_pay_app_id', d) if include_defaults else self.wechat_pay_app_id,
            'wechat_pay_mch_id': self._val('wechat_pay_mch_id', d) if include_defaults else self.wechat_pay_mch_id,
            'wechat_pay_serial_no': self._val('wechat_pay_serial_no', d) if include_defaults else self.wechat_pay_serial_no,
            'wechat_pay_private_key_length': len(wechat_pay_private_key) if wechat_pay_private_key else 0,
            'wechat_pay_private_key_masked': self._mask_secret(wechat_pay_private_key, keep_start=12, keep_end=12),
            'wechat_pay_api_v3_key_length': len(wechat_pay_api_v3_key) if wechat_pay_api_v3_key else 0,
            'wechat_pay_api_v3_key_masked': self._mask_secret(wechat_pay_api_v3_key),
            'wechat_pay_gateway_url': self._val('wechat_pay_gateway_url', d) if include_defaults else self.wechat_pay_gateway_url,
            'wechat_pay_notify_url': self._val('wechat_pay_notify_url', d) if include_defaults else self.wechat_pay_notify_url,
            'wechat_pay_order_expire_minutes': (
                self._val('wechat_pay_order_expire_minutes', d)
                if include_defaults
                else self.wechat_pay_order_expire_minutes
            ),
            'recharge_packages': self.recharge_packages,
            'subscription_plans': self.subscription_plans,
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
    def _parse_lazyllm_api_keys(raw):
        """Parse lazyllm_api_keys JSON payload into a plain dict."""
        if not raw:
            return {}
        if isinstance(raw, dict):
            return {vendor: key for vendor, key in raw.items() if key}
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(parsed, dict):
            return {}
        return {vendor: key for vendor, key in parsed.items() if key}

    def to_runtime_config(self, include_secret_defaults=True, lazyllm_namespace=None):
        """
        Build an internal runtime configuration dict for AI services.

        For private runtime settings, callers can disable secret defaults so that empty
        private credentials never fall back to shared/global API keys.
        """
        defaults = Settings._get_config_defaults()

        def _general(attr):
            return self._val(attr, defaults)

        def _secret(attr):
            return self._val(attr, defaults) if include_secret_defaults else getattr(self, attr)

        lazyllm_keys = self.get_lazyllm_api_keys_dict()
        if include_secret_defaults and not lazyllm_keys:
            lazyllm_keys = self._parse_lazyllm_api_keys(defaults.get('lazyllm_api_keys'))

        namespace = lazyllm_namespace
        if not namespace:
            if self.owner_user_id:
                namespace = f"BANANA_{self.owner_user_id}"
            else:
                namespace = "BANANA"

        global_api_key = _secret('api_key')
        global_api_base = _general('api_base_url')

        return {
            'SETTINGS_SCOPE': 'private' if self.owner_user_id else 'global',
            'SETTINGS_OWNER_USER_ID': self.owner_user_id,
            'AI_PROVIDER_FORMAT': _general('ai_provider_format'),
            'GOOGLE_API_KEY': global_api_key,
            'OPENAI_API_KEY': global_api_key,
            'GOOGLE_API_BASE': global_api_base,
            'OPENAI_API_BASE': global_api_base,
            'TEXT_MODEL': _general('text_model'),
            'IMAGE_MODEL': _general('image_model'),
            'IMAGE_CAPTION_MODEL': _general('image_caption_model'),
            'OUTPUT_LANGUAGE': _general('output_language'),
            'DEFAULT_RESOLUTION': _general('image_resolution'),
            'DEFAULT_ASPECT_RATIO': _general('image_aspect_ratio'),
            'MAX_DESCRIPTION_WORKERS': _general('max_description_workers'),
            'MAX_IMAGE_WORKERS': _general('max_image_workers'),
            'DESCRIPTION_EXTRA_FIELDS': self.get_description_extra_fields(),
            'IMAGE_PROMPT_EXTRA_FIELDS': self.get_image_prompt_extra_fields(),
            'ENABLE_TEXT_REASONING': self.enable_text_reasoning,
            'TEXT_THINKING_BUDGET': self.text_thinking_budget,
            'ENABLE_IMAGE_REASONING': self.enable_image_reasoning,
            'IMAGE_THINKING_BUDGET': self.image_thinking_budget,
            'MINERU_API_BASE': _general('mineru_api_base'),
            'MINERU_TOKEN': _secret('mineru_token'),
            'BAIDU_API_KEY': _secret('baidu_api_key'),
            'TEXT_MODEL_SOURCE': _general('text_model_source'),
            'IMAGE_MODEL_SOURCE': _general('image_model_source'),
            'IMAGE_CAPTION_MODEL_SOURCE': _general('image_caption_model_source'),
            'TEXT_API_KEY': _secret('text_api_key'),
            'TEXT_API_BASE': self.text_api_base_url,
            'IMAGE_API_KEY': _secret('image_api_key'),
            'IMAGE_API_BASE': self.image_api_base_url,
            'IMAGE_CAPTION_API_KEY': _secret('image_caption_api_key'),
            'IMAGE_CAPTION_API_BASE': self.image_caption_api_base_url,
            'LAZYLLM_API_KEYS': lazyllm_keys,
            'LAZYLLM_NAMESPACE': namespace,
        }

    @staticmethod
    def _get_config_defaults():
        """Return a dict of default values from Config/env for settings fields."""
        from config import Config
        from services.ai_providers.lazyllm_env import collect_env_lazyllm_api_keys

        def _env(*names, default=None):
            for name in names:
                value = getattr(Config, name, None)
                if value not in (None, ''):
                    return value
                env_value = (__import__('os').getenv(name) or '').strip()
                if env_value:
                    return env_value
            return default

        def _env_int(*names, default=None):
            value = _env(*names, default=None)
            if value in (None, ''):
                return default
            try:
                return int(value)
            except (TypeError, ValueError):
                return default

        def _env_bool(*names, default=None):
            value = _env(*names, default=None)
            if value in (None, ''):
                return default
            if isinstance(value, bool):
                return value
            return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}

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
            'jwt_secret_key': _env('JWT_SECRET_KEY'),
            'admin_init_phone': _env('ADMIN_INIT_PHONE'),
            'admin_init_username': _env('ADMIN_INIT_USERNAME'),
            'admin_init_password': _env('ADMIN_INIT_PASSWORD'),
            'sms_provider': _env('sms.provider', 'SMS_PROVIDER', default='mock'),
            'sms_access_key_id': _env('sms.access_key_id', 'SMS_ACCESS_KEY_ID', 'SMS_SECRET_ID'),
            'sms_access_key_secret': _env('sms.access_key_secret', 'SMS_ACCESS_KEY_SECRET', 'SMS_SECRET_KEY'),
            'sms_sign_name': _env('sms.sign_name', 'SMS_SIGN_NAME'),
            'sms_template_code': _env('sms.template_code', 'SMS_TEMPLATE_CODE', 'SMS_TEMPLATE_ID'),
            'sms_endpoint': _env('sms.endpoint', 'SMS_ENDPOINT', default='https://dysmsapi.aliyuncs.com/'),
            'sms_code_ttl_minutes': _env_int('sms.code_ttl_minutes', 'SMS_CODE_TTL_MINUTES', default=5),
            'sms_rate_limit_per_day': _env_int('sms.rate_limit_per_day', 'SMS_RATE_LIMIT_PER_DAY', default=5),
            'sms_mock_code': _env('sms.mock_code', 'SMS_MOCK_CODE'),
            'wechat_pay_enabled': _env_bool('pay.wechat.enabled', 'WECHAT_PAY_ENABLED', default=False),
            'wechat_pay_mock': _env_bool('pay.wechat.mock', 'WECHAT_PAY_MOCK', default=False),
            'wechat_pay_app_id': _env('pay.wechat.app_id', 'WECHAT_PAY_APP_ID'),
            'wechat_pay_mch_id': _env('pay.wechat.mch_id', 'WECHAT_PAY_MCH_ID'),
            'wechat_pay_serial_no': _env('pay.wechat.serial_no', 'WECHAT_PAY_SERIAL_NO'),
            'wechat_pay_private_key': _env('pay.wechat.private_key', 'WECHAT_PAY_PRIVATE_KEY'),
            'wechat_pay_api_v3_key': _env('pay.wechat.api_v3_key', 'WECHAT_PAY_API_V3_KEY'),
            'wechat_pay_gateway_url': _env('pay.wechat.gateway_url', 'WECHAT_PAY_GATEWAY_URL', default='https://api.mch.weixin.qq.com'),
            'wechat_pay_notify_url': _env('pay.wechat.notify_url', 'WECHAT_PAY_NOTIFY_URL'),
            'wechat_pay_order_expire_minutes': _env_int('pay.wechat.order_expire_minutes', 'WECHAT_PAY_ORDER_EXPIRE_MINUTES', default=5),
        }

    @staticmethod
    def _create_empty_settings(owner_user_id=None):
        settings = Settings(owner_user_id=owner_user_id)
        db.session.add(settings)
        db.session.commit()
        return settings

    @classmethod
    def get_global_settings(cls):
        """Return the shared global settings row."""
        settings = cls.query.filter(cls.owner_user_id.is_(None)).order_by(cls.id.asc()).first()
        if settings is None:
            settings = cls._create_empty_settings()
        return settings

    @classmethod
    def create_private_settings_for_user(cls, user):
        """Create an empty private settings row for a user with isolated runtime config."""
        return cls._create_empty_settings(owner_user_id=user.id)

    @classmethod
    def get_private_settings(cls, user, create_if_missing=True):
        """Return the user-private settings row, creating an empty one on first use."""
        settings = cls.query.filter_by(owner_user_id=user.id).first()
        if settings is None and create_if_missing:
            settings = cls.create_private_settings_for_user(user)
        return settings

    @classmethod
    def get_admin_settings(cls, admin_user, create_if_missing=True):
        """Backward-compatible alias for legacy private-settings callers."""
        return cls.get_private_settings(admin_user, create_if_missing=create_if_missing)

    @classmethod
    def get_settings(cls, user=None):
        """
        Return global settings by default, or user-private settings when the user uses isolated runtime config.
        """
        if user is not None and hasattr(user, 'uses_private_runtime_settings') and user.uses_private_runtime_settings():
            return cls.get_private_settings(user)
        return cls.get_global_settings()

    def __repr__(self):
        return f'<Settings id={self.id}>'
