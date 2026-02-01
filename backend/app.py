"""
Simplified Flask Application Entry Point
"""
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3
from sqlalchemy.exc import SQLAlchemyError
from flask_migrate import Migrate

# Load environment variables from project root .env file
_project_root = Path(__file__).parent.parent
_env_file = _project_root / '.env'
load_dotenv(dotenv_path=_env_file, override=True)

from flask import Flask
from flask_cors import CORS
from models import db
from config import Config
from controllers.material_controller import material_bp, material_global_bp
from controllers.reference_file_controller import reference_file_bp
from controllers.settings_controller import settings_bp
from controllers import project_bp, page_bp, template_bp, user_template_bp, export_bp, file_bp


# Enable SQLite WAL mode for all connections
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """
    Enable WAL mode and related PRAGMAs for each SQLite connection.
    Registered once at import time to avoid duplicate handlers when
    create_app() is called multiple times.
    """
    # Only apply to SQLite connections
    if not isinstance(dbapi_conn, sqlite3.Connection):
        return

    cursor = dbapi_conn.cursor()
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")  # 30 seconds timeout
    finally:
        cursor.close()


def create_app():
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration from Config class
    app.config.from_object(Config)
    
    # Override with environment-specific paths (use absolute path)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    instance_dir = os.path.join(backend_dir, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    
    db_path = os.path.join(instance_dir, 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    
    # Ensure upload folder exists
    project_root = os.path.dirname(backend_dir)
    upload_folder = os.path.join(project_root, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_folder
    
    # CORS configuration (parse from environment)
    raw_cors = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    if raw_cors.strip() == '*':
        cors_origins = '*'
    else:
        cors_origins = [o.strip() for o in raw_cors.split(',') if o.strip()]
    app.config['CORS_ORIGINS'] = cors_origins
    
    # Initialize logging (log to stdout so Docker can capture it)
    log_level = getattr(logging, app.config['LOG_LEVEL'], logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    
    # 设置第三方库的日志级别，避免过多的DEBUG日志
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('werkzeug').setLevel(logging.INFO)  # Flask开发服务器日志保持INFO

    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=cors_origins)
    # Database migrations (Alembic via Flask-Migrate)
    Migrate(app, db)
    
    # Register middleware for user-specific settings
    from middleware.user_settings_middleware import load_user_settings, restore_default_settings
    app.before_request(load_user_settings)
    app.after_request(restore_default_settings)
    
    # Register blueprints
    app.register_blueprint(project_bp)
    app.register_blueprint(page_bp)
    app.register_blueprint(template_bp)
    app.register_blueprint(user_template_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(file_bp)
    app.register_blueprint(material_bp)
    app.register_blueprint(material_global_bp)
    app.register_blueprint(reference_file_bp, url_prefix='/api/reference-files')
    app.register_blueprint(settings_bp)

    with app.app_context():
        # Load settings from database and sync to app.config
        _load_settings_to_config(app)

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'ok', 'message': 'Banana Slides API is running'}
    
    # Site status endpoint
    @app.route('/api/site-status')
    def site_status():
        """
        获取站点状态
        可选值: sufficient (余额充足), insufficient (欠费), maintenance (维护)
        """
        status = os.getenv('SITE_STATUS', 'sufficient')
        return {'status': status}
    
    # Output language endpoint
    @app.route('/api/output-language', methods=['GET'])
    def get_output_language():
        """
        获取用户的输出语言偏好（从数据库 Settings 读取）
        返回: zh, ja, en, auto
        """
        from flask import request, g
        from models import Settings
        try:
            # 优先使用中间件已加载的用户设置
            if hasattr(g, 'user_settings') and g.user_settings is not None:
                settings = g.user_settings
            else:
                # 从请求头获取 user_token
                user_token = request.headers.get('X-User-Token')
                settings = Settings.get_settings(user_token) if user_token else Settings.get_settings()
            return {'data': {'language': settings.output_language}}
        except SQLAlchemyError as db_error:
            logging.warning(f"Failed to load output language from settings: {db_error}")
            return {'data': {'language': Config.OUTPUT_LANGUAGE}}  # 默认中文

    # Root endpoint
    @app.route('/')
    def index():
        return {
            'name': 'Banana Slides API',
            'version': '1.0.0',
            'description': 'AI-powered PPT generation service',
            'endpoints': {
                'health': '/health',
                'site_status': '/api/site-status',
                'api_docs': '/api',
                'projects': '/api/projects'
            }
        }
    
    return app


def _load_settings_to_config(app):
    """Load settings from database and apply to app.config on startup"""
    from models import Settings
    try:
        # 尝试获取默认用户的设置（兼容模式）
        # 注意：这里不传 user_token，会返回第一个设置记录
        settings = Settings.get_settings()
        
        # Load AI provider format (always sync, has default value)
        if settings.ai_provider_format:
            app.config['AI_PROVIDER_FORMAT'] = settings.ai_provider_format
            logging.info(f"Loaded AI_PROVIDER_FORMAT from settings: {settings.ai_provider_format}")
        
        # Load API configuration
        # Note: We load even if value is None/empty to allow clearing settings
        # But we only log if there's an actual value
        if settings.api_base_url is not None:
            # 将数据库中的统一 API Base 同步到 Google/OpenAI 两个配置，确保覆盖环境变量
            app.config['GOOGLE_API_BASE'] = settings.api_base_url
            app.config['OPENAI_API_BASE'] = settings.api_base_url
            if settings.api_base_url:
                logging.info(f"Loaded API_BASE from settings: {settings.api_base_url}")
            else:
                logging.info("API_BASE is empty in settings, using env var or default")

        if settings.api_key is not None:
            # 同步到两个提供商的 key，数据库优先于环境变量
            app.config['GOOGLE_API_KEY'] = settings.api_key
            app.config['OPENAI_API_KEY'] = settings.api_key
            if settings.api_key:
                logging.info("Loaded API key from settings")
            else:
                logging.info("API key is empty in settings, using env var or default")

        # Load image generation settings
        app.config['DEFAULT_RESOLUTION'] = settings.image_resolution
        app.config['DEFAULT_ASPECT_RATIO'] = settings.image_aspect_ratio
        logging.info(f"Loaded image settings: {settings.image_resolution}, {settings.image_aspect_ratio}")

        # Load worker settings
        app.config['MAX_DESCRIPTION_WORKERS'] = settings.max_description_workers
        app.config['MAX_IMAGE_WORKERS'] = settings.max_image_workers
        logging.info(f"Loaded worker settings: desc={settings.max_description_workers}, img={settings.max_image_workers}")

        # Load model settings (FIX for Issue #136: these were missing before)
        if settings.text_model:
            app.config['TEXT_MODEL'] = settings.text_model
            logging.info(f"Loaded TEXT_MODEL from settings: {settings.text_model}")
        
        if settings.image_model:
            app.config['IMAGE_MODEL'] = settings.image_model
            logging.info(f"Loaded IMAGE_MODEL from settings: {settings.image_model}")
        
        # Load MinerU settings
        if settings.mineru_api_base:
            app.config['MINERU_API_BASE'] = settings.mineru_api_base
            logging.info(f"Loaded MINERU_API_BASE from settings: {settings.mineru_api_base}")
        
        if settings.mineru_token:
            app.config['MINERU_TOKEN'] = settings.mineru_token
            logging.info("Loaded MINERU_TOKEN from settings")
        
        # Load image caption model
        if settings.image_caption_model:
            app.config['IMAGE_CAPTION_MODEL'] = settings.image_caption_model
            logging.info(f"Loaded IMAGE_CAPTION_MODEL from settings: {settings.image_caption_model}")
        
        # Load output language
        if settings.output_language:
            app.config['OUTPUT_LANGUAGE'] = settings.output_language
            logging.info(f"Loaded OUTPUT_LANGUAGE from settings: {settings.output_language}")
        
        # Load reasoning mode settings (separate for text and image)
        app.config['ENABLE_TEXT_REASONING'] = settings.enable_text_reasoning
        app.config['TEXT_THINKING_BUDGET'] = settings.text_thinking_budget
        app.config['ENABLE_IMAGE_REASONING'] = settings.enable_image_reasoning
        app.config['IMAGE_THINKING_BUDGET'] = settings.image_thinking_budget
        logging.info(f"Loaded reasoning config: text={settings.enable_text_reasoning}(budget={settings.text_thinking_budget}), image={settings.enable_image_reasoning}(budget={settings.image_thinking_budget})")
        
        # Load Baidu OCR settings
        if settings.baidu_ocr_api_key:
            app.config['BAIDU_OCR_API_KEY'] = settings.baidu_ocr_api_key
            logging.info("Loaded BAIDU_OCR_API_KEY from settings")

    except Exception as e:
        logging.warning(f"Could not load settings from database (this is normal during migration): {e}")


# Create app instance
app = create_app()


if __name__ == '__main__':
    # Run development server
    if os.getenv("IN_DOCKER", "0") == "1":
        port = 5000  # Docker 容器内部固定使用 5000 端口
    else:
        port = int(os.getenv('BACKEND_PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    
    logging.info(
        "\n"
        "╔══════════════════════════════════════╗\n"
        "║   🍌 Banana Slides API Server 🍌   ║\n"
        "╚══════════════════════════════════════╝\n"
        f"Server starting on: http://localhost:{port}\n"
        f"Output Language: {Config.OUTPUT_LANGUAGE}\n"
        f"Environment: {os.getenv('FLASK_ENV', 'development')}\n"
        f"Debug mode: {debug}\n"
        f"API Base URL: http://localhost:{port}/api\n"
        f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}\n"
        f"Uploads: {app.config['UPLOAD_FOLDER']}"
    )
    
    # Using absolute paths for database, so WSL path issues should not occur
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)
