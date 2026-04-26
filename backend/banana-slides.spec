# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

backend_dir = os.path.abspath('.')

hiddenimports = []
for pkg in [
    'flask', 'flask_cors', 'flask_sqlalchemy', 'flask_migrate',
    'sqlalchemy', 'alembic',
    'google.genai', 'google.generativeai',
    'openai', 'anthropic', 'httpx',
    'pptx', 'docx', 'lxml',
    'reportlab', 'markitdown',
    'PIL', 'img2pdf', 'fitz',
    'pydantic', 'tenacity',
    'dotenv', 'werkzeug', 'jinja2',
]:
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        pass

hiddenimports += [
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
    'models.settings',
    'config',
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
