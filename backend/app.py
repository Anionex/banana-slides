"""
Simplified Flask Application Entry Point
"""
import os
import sys
import hmac
import logging
from logging.handlers import RotatingFileHandler
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

from flask import Flask, request
from flask_cors import CORS
from models import db
from config import Config
from controllers.material_controller import material_bp, material_global_bp
from controllers.reference_file_controller import reference_file_bp
from controllers.settings_controller import settings_bp
from controllers.auth_controller import auth_bp
from controllers.payment_controller import payment_bp
from controllers.admin_controller import admin_bp
from controllers.invitation_controller import invitation_bp
from controllers.admin_config_controller import admin_config_bp
from controllers.announcement_controller import announcement_bp
from controllers import project_bp, page_bp, template_bp, user_template_bp, export_bp, file_bp, style_bp


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
    
    database_uri = os.getenv('DATABASE_URL') or app.config.get('SQLALCHEMY_DATABASE_URI')
    if not database_uri:
        db_path = os.path.join(instance_dir, 'database.db')
        database_uri = f'sqlite:///{db_path}'

    # Respect DATABASE_URL / Config so tests and alternate deployments do not
    # silently write into the default instance database.
    if database_uri.startswith('sqlite:///'):
        sqlite_path = database_uri[len('sqlite:///'):]
        if sqlite_path and sqlite_path != ':memory:':
            os.makedirs(os.path.dirname(sqlite_path), exist_ok=True)

    app.config['SQLALCHEMY_DATABASE_URI'] = database_uri
    
    # Ensure upload folder exists
    project_root = os.path.dirname(backend_dir)
    upload_folder = os.path.join(project_root, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_folder
    
    # 设置存储后端环境变量（用于抽象层初始化）
    os.environ['UPLOAD_FOLDER'] = upload_folder
    os.environ['STORAGE_BACKEND'] = app.config.get('STORAGE_BACKEND', os.getenv('STORAGE_BACKEND', 'local'))
    os.environ.setdefault('TASK_QUEUE', 'thread')
    os.environ.setdefault('TASK_QUEUE_WORKERS', '4')
    app.config['STORAGE_BACKEND'] = os.environ['STORAGE_BACKEND']
    
    # CORS configuration (parse from environment)
    raw_cors = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    if raw_cors.strip() == '*':
        cors_origins = '*'
    else:
        cors_origins = [o.strip() for o in raw_cors.split(',') if o.strip()]
    app.config['CORS_ORIGINS'] = cors_origins
    
    # Initialize logging (stdout + rotating file for admin log viewer)
    log_level = getattr(logging, app.config['LOG_LEVEL'], logging.INFO)
    log_format = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    log_file = os.path.join(instance_dir, 'app.log')
    file_handler = RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8'
    )
    file_handler.setFormatter(logging.Formatter(log_format))
    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=[logging.StreamHandler(sys.stdout), file_handler],
    )
    app.config['LOG_FILE_PATH'] = log_file
    
    # 设置第三方库的日志级别，避免过多的DEBUG日志
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('werkzeug').setLevel(logging.INFO)  # Flask开发服务器日志保持INFO
    logging.getLogger('volcenginesdkarkruntime').setLevel(logging.WARNING)

    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=cors_origins)
    # Database migrations (Alembic via Flask-Migrate)
    Migrate(app, db)
    
    # Register blueprints
    app.register_blueprint(auth_bp)  # Auth endpoints
    app.register_blueprint(payment_bp)  # Payment endpoints
    app.register_blueprint(admin_bp)  # Admin dashboard endpoints
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
    app.register_blueprint(invitation_bp)  # Invitation code endpoints
    app.register_blueprint(admin_config_bp)  # Admin system config endpoints
    app.register_blueprint(announcement_bp)  # Announcement endpoints
    app.register_blueprint(style_bp)

    with app.app_context():
        # Load settings from database and sync to app.config
        _load_settings_to_config(app)
        # Create default admin if no admin exists
        _create_default_admin_if_needed()

    # Access code enforcement on all /api/ routes
    @app.before_request
    def _enforce_access_code():
        from flask import request, jsonify
        expected = os.getenv('ACCESS_CODE', '').strip()
        if not expected:
            return  # not enabled
        if not request.path.startswith('/api/'):
            return  # non-API routes (health, static, etc.)
        if request.path.startswith('/api/access-code/'):
            return  # allow check/verify endpoints
        code = request.headers.get('X-Access-Code', '')
        if hmac.compare_digest(code, expected):
            return
        return jsonify({'error': 'Access code required'}), 403

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'ok', 'message': 'Banana Slides API is running'}

    # Access code verification
    @app.route('/api/access-code/check', methods=['GET'])
    def check_access_code():
        """Check if access code protection is enabled"""
        enabled = bool(os.getenv('ACCESS_CODE', '').strip())
        return {'data': {'enabled': enabled}}

    @app.route('/api/access-code/verify', methods=['POST'])
    def verify_access_code():
        """Verify the provided access code"""
        from flask import request, jsonify
        expected = os.getenv('ACCESS_CODE', '').strip()
        if not expected:
            return {'data': {'valid': True}}
        code = (request.json or {}).get('code', '')
        if hmac.compare_digest(code, expected):
            return {'data': {'valid': True}}
        return jsonify({'error': 'Invalid access code'}), 403
    
    # Output language endpoint
    @app.route('/api/output-language', methods=['GET'])
    def get_output_language():
        """
        获取用户的有效输出语言偏好（用户 override > 全局 Settings）
        返回: zh, ja, en, auto
        """
        from services.auth_service import AuthService
        from services.runtime_settings import get_user_effective_config_value
        try:
            # Manually extract and verify token (no @auth_required decorator here)
            auth_header = request.headers.get('Authorization', '')
            token = auth_header[7:] if auth_header.startswith('Bearer ') else auth_header
            if token:
                user = AuthService.verify_access_token(token)
                if user and user.is_active:
                    language = get_user_effective_config_value(
                        user.id,
                        'OUTPUT_LANGUAGE',
                        default=Config.OUTPUT_LANGUAGE,
                    )
                    return {'data': {'language': language or 'zh'}}
            return {'data': {'language': Config.OUTPUT_LANGUAGE}}
        except Exception as e:
            logging.warning(f"Failed to load output language from user settings: {e}")
            return {'data': {'language': Config.OUTPUT_LANGUAGE}}

    # Root endpoint
    @app.route('/')
    def index():
        return {
            'name': 'Banana Slides API',
            'version': '1.0.0',
            'description': 'AI-powered PPT generation service',
            'endpoints': {
                'health': '/health',
                'api_docs': '/api',
                'projects': '/api/projects'
            }
        }
    
    return app


def _load_settings_to_config(app):
    """Load settings from database and apply to app.config on startup"""
    from models import Settings
    try:
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

        # Load image generation settings (fall back to .env/Config when NULL)
        resolution = settings.image_resolution or Config.DEFAULT_RESOLUTION
        aspect_ratio = settings.image_aspect_ratio or Config.DEFAULT_ASPECT_RATIO
        app.config['DEFAULT_RESOLUTION'] = resolution
        app.config['DEFAULT_ASPECT_RATIO'] = aspect_ratio
        logging.info(f"Loaded image settings: {resolution}, {aspect_ratio}")

        # Load worker settings (fall back to .env/Config when NULL)
        desc_workers = settings.max_description_workers or Config.MAX_DESCRIPTION_WORKERS
        img_workers = settings.max_image_workers or Config.MAX_IMAGE_WORKERS
        app.config['MAX_DESCRIPTION_WORKERS'] = desc_workers
        app.config['MAX_IMAGE_WORKERS'] = img_workers
        logging.info(f"Loaded worker settings: desc={desc_workers}, img={img_workers}")

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
        
        # Load Baidu API settings
        if settings.baidu_api_key:
            app.config['BAIDU_API_KEY'] = settings.baidu_api_key
            logging.info("Loaded BAIDU_API_KEY from settings")

        # Load LazyLLM source settings
        if settings.text_model_source:
            app.config['TEXT_MODEL_SOURCE'] = settings.text_model_source
            logging.info(f"Loaded TEXT_MODEL_SOURCE from settings: {settings.text_model_source}")
        if settings.image_model_source:
            app.config['IMAGE_MODEL_SOURCE'] = settings.image_model_source
            logging.info(f"Loaded IMAGE_MODEL_SOURCE from settings: {settings.image_model_source}")
        if settings.image_caption_model_source:
            app.config['IMAGE_CAPTION_MODEL_SOURCE'] = settings.image_caption_model_source
            logging.info(f"Loaded IMAGE_CAPTION_MODEL_SOURCE from settings: {settings.image_caption_model_source}")

        # Load per-model API credentials (for gemini/openai per-model overrides)
        for model_type in ('text', 'image', 'image_caption'):
            prefix = model_type.upper()
            for suffix, setting_suffix in [('_API_KEY', '_api_key'), ('_API_BASE', '_api_base_url')]:
                config_key = f'{prefix}{suffix}'
                val = getattr(settings, f'{model_type}{setting_suffix}', None)
                if val:
                    app.config[config_key] = val
                    if suffix == '_API_BASE':
                        logging.info(f"Loaded {config_key} from settings: {val}")
                    else:
                        logging.info(f"Loaded {config_key} from settings")

        # Sync LazyLLM vendor API keys to environment variables
        # Only allow known vendor names to prevent environment variable injection
        from services.ai_providers.lazyllm_env import ALLOWED_LAZYLLM_VENDORS
        if settings.lazyllm_api_keys:
            import json
            try:
                keys = json.loads(settings.lazyllm_api_keys)
                for vendor, key in keys.items():
                    if key and vendor.lower() in ALLOWED_LAZYLLM_VENDORS:
                        os.environ[f"{vendor.upper()}_API_KEY"] = key
                    elif key:
                        logging.warning(f"Ignoring unknown lazyllm vendor: {vendor}")
                logging.info(f"Loaded LazyLLM API keys for vendors: {[v for v, k in keys.items() if k and v.lower() in ALLOWED_LAZYLLM_VENDORS]}")
            except (json.JSONDecodeError, TypeError):
                logging.warning("Failed to parse lazyllm_api_keys from settings")

    except Exception as e:
        if isinstance(e, SQLAlchemyError) and "no such table: settings" in str(e):
            logging.debug(f"Settings table not yet created (expected on first boot): {e}")
        else:
            logging.warning(f"Could not load settings from database: {e}")


def _create_default_admin_if_needed():
    """Create default admin user if no admin exists and env vars are configured"""
    from models import User
    from utils.security import hash_password
    import uuid

    try:
        # Check if any admin exists
        admin_exists = db.session.query(User).filter_by(is_admin=True).first() is not None

        if admin_exists:
            logging.debug("Admin user already exists, skipping default admin creation")
            return

        # Get default admin credentials from environment
        admin_email = os.getenv('DEFAULT_ADMIN_EMAIL')
        admin_password = os.getenv('DEFAULT_ADMIN_PASSWORD')

        if not admin_email or not admin_password:
            logging.info("DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD not set, skipping default admin creation")
            return

        # Check if email is already registered (as non-admin)
        existing_user = db.session.query(User).filter_by(email=admin_email).first()
        if existing_user:
            # Promote existing user to admin
            existing_user.is_admin = True
            db.session.commit()
            logging.info(f"Promoted existing user {admin_email} to admin")
            return

        # Create new admin user
        password_hash = hash_password(admin_password)

        admin_user = User(
            id=str(uuid.uuid4()),
            email=admin_email,
            password_hash=password_hash,
            username='Admin',
            is_active=True,
            is_admin=True,
            email_verified=True,  # Skip email verification for default admin
            credits_balance=9999,  # Give admin plenty of credits
        )

        db.session.add(admin_user)
        db.session.commit()

        logging.info(f"Created default admin user: {admin_email}")

    except Exception as e:
        logging.error(f"Failed to create default admin: {e}")


# Create app instance
app = create_app()


def _compute_worktree_port(base_port: int) -> int:
    """Compute a deterministic port from the worktree directory name.

    Uses MD5 of the project root basename so each worktree gets a unique,
    stable port pair (backend 5xxx, frontend 3xxx) without manual config.
    """
    import hashlib
    basename = _project_root.name
    offset = int(hashlib.md5(basename.encode()).hexdigest()[:8], 16) % 500
    return base_port + offset


if __name__ == '__main__':
    # Local development entrypoint. Production containers should use Gunicorn.
    if os.getenv("IN_DOCKER", "0") == "1":
        port = 5000  # Docker 容器内部固定使用 5000 端口
    elif os.getenv('BACKEND_PORT'):
        port = int(os.getenv('BACKEND_PORT'))
    else:
        port = _compute_worktree_port(5000)
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
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=debug)
