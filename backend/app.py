"""
Simplified Flask Application Entry Point
"""
import os
import sys
import logging
from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3

# Load environment variables BEFORE importing anything else
load_dotenv()

from flask import Flask, request
from flask_cors import CORS
from flask_babel import Babel
from models import db
from config import Config
from default_config import (
    DEFAULT_TEXT_API_KEY,
    DEFAULT_TEXT_API_BASE,
    DEFAULT_IMAGE_API_KEY,
    DEFAULT_IMAGE_API_BASE,
    DEFAULT_MINERU_TOKEN,
    DEFAULT_MINERU_API_BASE
)
from controllers.material_controller import material_bp, material_global_bp
from controllers.reference_file_controller import reference_file_bp
from controllers.proxy_controller import proxy_bp
from controllers import project_bp, page_bp, template_bp, user_template_bp, export_bp, file_bp, settings_bp
from controllers import system_templates_bp
from controllers.i18n_controller import i18n_bp
from controllers.auth_controller import auth_bp
from controllers.oauth_controller import oauth_bp


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
    
    # Basic configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-this')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Database configuration (use absolute path)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    instance_dir = os.path.join(backend_dir, 'instance')
    os.makedirs(instance_dir, exist_ok=True)
    
    db_path = os.path.join(instance_dir, 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    
    # File storage configuration
    project_root = os.path.dirname(backend_dir)
    upload_folder = os.path.join(project_root, 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    
    app.config['UPLOAD_FOLDER'] = upload_folder
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    app.config['ALLOWED_REFERENCE_FILE_EXTENSIONS'] = Config.ALLOWED_REFERENCE_FILE_EXTENSIONS
    
    # AI configuration with built-in defaults
    # Users can override these by setting environment variables
    app.config['GOOGLE_API_KEY'] = os.getenv('GOOGLE_API_KEY', DEFAULT_TEXT_API_KEY)
    app.config['GOOGLE_API_BASE'] = os.getenv('GOOGLE_API_BASE', DEFAULT_TEXT_API_BASE)
    # Image generation can use different API (optional)
    app.config['GOOGLE_IMAGE_API_KEY'] = os.getenv('GOOGLE_IMAGE_API_KEY', DEFAULT_IMAGE_API_KEY)
    app.config['GOOGLE_IMAGE_API_BASE'] = os.getenv('GOOGLE_IMAGE_API_BASE', DEFAULT_IMAGE_API_BASE)
    app.config['MAX_DESCRIPTION_WORKERS'] = int(os.getenv('MAX_DESCRIPTION_WORKERS', '5'))
    app.config['MAX_IMAGE_WORKERS'] = int(os.getenv('MAX_IMAGE_WORKERS', '8'))
    app.config['DEFAULT_ASPECT_RATIO'] = "16:9"
    app.config['DEFAULT_RESOLUTION'] = "2K"
    app.config['LOG_LEVEL'] = os.getenv('LOG_LEVEL', 'INFO').upper()

    # MinerU configuration with built-in default
    app.config['MINERU_TOKEN'] = os.getenv('MINERU_TOKEN', DEFAULT_MINERU_TOKEN)
    app.config['MINERU_API_BASE'] = os.getenv('MINERU_API_BASE', DEFAULT_MINERU_API_BASE)
    app.config['IMAGE_CAPTION_MODEL'] = os.getenv('IMAGE_CAPTION_MODEL', 'gemini-2.5-flash')
    
    # CORS configuration
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

    # Babel configuration
    app.config['LANGUAGES'] = ['zh', 'en']
    app.config['BABEL_DEFAULT_LOCALE'] = 'zh'
    app.config['BABEL_DEFAULT_TIMEZONE'] = 'UTC'

    def get_locale():
        # 1. 从请求头获取语言偏好
        lang = request.accept_languages.best_match(app.config['LANGUAGES'])

        # 2. 从URL参数获取语言
        if 'lang' in request.args:
            lang = request.args['lang']

        # 3. 从Cookie获取语言
        if 'language' in request.cookies:
            lang = request.cookies['language']

        # 4. 从请求头的Accept-Language获取
        if not lang:
            lang = request.accept_languages.best_match(app.config['LANGUAGES']) or app.config['BABEL_DEFAULT_LOCALE']

        return lang

    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=cors_origins)
    babel = Babel(app, locale_selector=get_locale)
    
    # Register blueprints
    app.register_blueprint(auth_bp)  # 认证相关API
    app.register_blueprint(oauth_bp) # OAuth相关API
    app.register_blueprint(project_bp)
    app.register_blueprint(page_bp)
    app.register_blueprint(template_bp)
    app.register_blueprint(user_template_bp)
    app.register_blueprint(system_templates_bp)  # 系统模板API
    app.register_blueprint(export_bp)
    app.register_blueprint(file_bp)
    app.register_blueprint(material_bp)
    app.register_blueprint(material_global_bp)
    app.register_blueprint(reference_file_bp, url_prefix='/api/reference-files')
    app.register_blueprint(settings_bp)
    app.register_blueprint(proxy_bp)
    app.register_blueprint(i18n_bp)
    
    with app.app_context():
        db.create_all()
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        try:
            from utils.memory_monitor import MemoryMonitor
            memory = MemoryMonitor.get_memory_usage()
            from services.task_manager import task_manager

            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'memory': {
                    'rss_mb': round(memory['rss'], 1),
                    'percent': round(memory['percent'], 1)
                },
                'active_tasks': task_manager.get_active_task_count()
            }
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return {
                'status': 'degraded',
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }
    
    # Root endpoint
    @app.route('/')
    def index():
        return {
            'name': 'Banana Pro Slides API',
            'version': '1.0.0',
            'description': 'AI-powered PPT generation service',
            'endpoints': {
                'health': '/health',
                'api_docs': '/api',
                'projects': '/api/projects'
            }
        }
    
    return app


# Create app instance
app = create_app()


if __name__ == '__main__':
    # Run development server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    
    logging.info(
        "\n"
        "╔══════════════════════════════════════╗\n"
        "║   🍌 Banana Pro Slides API Server 🍌   ║\n"
        "╚══════════════════════════════════════╝\n"
        f"Server starting on: http://localhost:{port}\n"
        f"Environment: {os.getenv('FLASK_ENV', 'development')}\n"
        f"Debug mode: {debug}\n"
        f"API Base URL: http://localhost:{port}/api\n"
        f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}\n"
        f"Uploads: {app.config['UPLOAD_FOLDER']}"
    )
    
    # Enable reloader for hot reload in development
    # Using absolute paths for database, so WSL path issues should not occur
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=True)

