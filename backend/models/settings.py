"""Settings model"""
from datetime import datetime, timezone
from . import db


class Settings(db.Model):
    """
    Settings model - stores per-user application settings
    每个用户（通过 user_token 标识）拥有独立的配置
    """
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_token = db.Column(db.String(100), nullable=False, unique=True)  # 用户唯一标识token
    ai_provider_format = db.Column(db.String(20), nullable=False, default='gemini')  # AI提供商格式: openai, gemini
    api_base_url = db.Column(db.String(500), nullable=True)  # API基础URL
    api_key = db.Column(db.String(500), nullable=True)  # API密钥
    image_resolution = db.Column(db.String(20), nullable=False, default='2K')  # 图像清晰度: 1K, 2K, 4K
    image_aspect_ratio = db.Column(db.String(10), nullable=False, default='16:9')  # 图像比例: 16:9, 4:3, 1:1
    max_description_workers = db.Column(db.Integer, nullable=False, default=5)  # 描述生成最大工作线程数
    max_image_workers = db.Column(db.Integer, nullable=False, default=8)  # 图像生成最大工作线程数

    # 新增：大模型与 MinerU 相关可视化配置（可在设置页中编辑）
    text_model = db.Column(db.String(100), nullable=True)  # 文本大模型名称（覆盖 Config.TEXT_MODEL）
    image_model = db.Column(db.String(100), nullable=True)  # 图片大模型名称（覆盖 Config.IMAGE_MODEL）
    mineru_api_base = db.Column(db.String(255), nullable=True)  # MinerU 服务地址（覆盖 Config.MINERU_API_BASE）
    mineru_token = db.Column(db.String(500), nullable=True)  # MinerU API Token（覆盖 Config.MINERU_TOKEN）
    image_caption_model = db.Column(db.String(100), nullable=True)  # 图片识别模型（覆盖 Config.IMAGE_CAPTION_MODEL）
    output_language = db.Column(db.String(10), nullable=False, default='zh')  # 输出语言偏好（zh, en, ja, auto）
    
    # 推理模式配置（分别控制文本和图像生成）
    enable_text_reasoning = db.Column(db.Boolean, nullable=False, default=False)  # 文本生成是否开启推理
    text_thinking_budget = db.Column(db.Integer, nullable=False, default=1024)  # 文本推理思考负载 (1-8192)
    enable_image_reasoning = db.Column(db.Boolean, nullable=False, default=False)  # 图像生成是否开启推理
    image_thinking_budget = db.Column(db.Integer, nullable=False, default=1024)  # 图像推理思考负载 (1-8192)
    
    # 百度 OCR 配置
    baidu_ocr_api_key = db.Column(db.String(500), nullable=True)  # 百度 OCR API Key
    
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'ai_provider_format': self.ai_provider_format,
            'api_base_url': self.api_base_url,
            'api_key_length': len(self.api_key) if self.api_key else 0,
            'image_resolution': self.image_resolution,
            'image_aspect_ratio': self.image_aspect_ratio,
            'max_description_workers': self.max_description_workers,
            'max_image_workers': self.max_image_workers,
            'text_model': self.text_model,
            'image_model': self.image_model,
            'mineru_api_base': self.mineru_api_base,
            'mineru_token_length': len(self.mineru_token) if self.mineru_token else 0,
            'image_caption_model': self.image_caption_model,
            'output_language': self.output_language,
            'enable_text_reasoning': self.enable_text_reasoning,
            'text_thinking_budget': self.text_thinking_budget,
            'enable_image_reasoning': self.enable_image_reasoning,
            'image_thinking_budget': self.image_thinking_budget,
            'baidu_ocr_api_key_length': len(self.baidu_ocr_api_key) if self.baidu_ocr_api_key else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def get_settings(user_token: str = None):
        """
        Get or create settings for a specific user.
        
        Args:
            user_token: 用户唯一标识token。如果为None，则尝试获取第一个（兼容旧逻辑）
        
        Returns:
            Settings instance for the user
        """
        if user_token:
            settings = Settings.query.filter_by(user_token=user_token).first()
        else:
            # 兼容模式：如果没有提供token，返回第一个（通常是default-user）
            settings = Settings.query.first()
        
        if not settings and user_token:
            # 用户首次访问，创建默认配置
            from config import Config

            # 新用户设置不持久化服务器默认密钥；敏感项通过 get_user_config() 回退到 .env
            if (Config.AI_PROVIDER_FORMAT or '').lower() == 'openai':
                default_api_base = Config.OPENAI_API_BASE or None
            else:
                default_api_base = Config.GOOGLE_API_BASE or None

            settings = Settings(
                user_token=user_token,
                ai_provider_format=Config.AI_PROVIDER_FORMAT,
                api_base_url=default_api_base,
                api_key=None,
                image_resolution=Config.DEFAULT_RESOLUTION,
                image_aspect_ratio=Config.DEFAULT_ASPECT_RATIO,
                max_description_workers=Config.MAX_DESCRIPTION_WORKERS,
                max_image_workers=Config.MAX_IMAGE_WORKERS,
                text_model=Config.TEXT_MODEL,
                image_model=Config.IMAGE_MODEL,
                mineru_api_base=Config.MINERU_API_BASE,
                mineru_token=None,
                image_caption_model=Config.IMAGE_CAPTION_MODEL,
                output_language='zh',  # 默认中文
                baidu_ocr_api_key=None,
            )
            db.session.add(settings)
            db.session.commit()
        
        return settings

    def __repr__(self):
        return f'<Settings id={self.id} user_token={self.user_token}>'
