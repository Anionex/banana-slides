# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None
backend_dir = os.path.abspath('.')

hiddenimports = [
    # App modules
    'controllers', 'controllers.project_controller',
    'controllers.page_controller', 'controllers.export_controller',
    'controllers.settings_controller', 'controllers.file_controller',
    'controllers.material_controller', 'controllers.template_controller',
    'controllers.reference_file_controller',
    'controllers.openai_oauth_controller',
    'services', 'services.ai_service', 'services.ai_service_manager',
    'services.export_service', 'services.file_parser_service',
    'services.file_service', 'services.task_manager', 'services.prompts',
    'services.pdf_service', 'services.inpainting_service',
    'services.ai_providers',
    'models', 'models.project', 'models.page', 'models.task',
    'models.settings', 'config',
    # Flask ecosystem
    'flask', 'flask.json', 'flask_cors', 'flask_sqlalchemy', 'flask_migrate',
    'werkzeug', 'werkzeug.serving', 'jinja2',
    # Database
    'sqlalchemy', 'sqlalchemy.dialects.sqlite', 'alembic',
    # AI providers
    'google.genai', 'google.generativeai', 'openai', 'anthropic',
    'httpx', 'httpx._transports',
    # Document processing
    'pptx', 'docx', 'lxml', 'lxml.etree', 'lxml._elementpath',
    'reportlab', 'reportlab.lib', 'reportlab.platypus',
    'markitdown',
    # Image processing
    'PIL', 'PIL.Image', 'img2pdf', 'fitz',
    # Utilities
    'pydantic', 'tenacity', 'dotenv',
]

datas = [
    ('fonts', 'fonts'),
    ('migrations', 'migrations'),
]

excludes = [
    'tkinter', 'matplotlib', 'scipy',
    'IPython', 'jupyter', 'notebook',
    'pytest', 'black', 'flake8',
]

a = Analysis(
    ['app.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='banana-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='banana-backend',
)
