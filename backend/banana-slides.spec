# -*- mode: python ; coding: utf-8 -*-
import os
import sys
import setuptools
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None
cwd = os.path.abspath('.')
backend_dir = cwd if os.path.exists(os.path.join(cwd, 'app.py')) else os.path.join(cwd, 'backend')
project_root = os.path.dirname(backend_dir)

# 手动添加 setuptools/_vendor/jaraco/text/Lorem ipsum.txt
jaraco_text_path = os.path.join(os.path.dirname(setuptools.__file__), '_vendor', 'jaraco', 'text')
_jaraco_datas = []
if os.path.exists(jaraco_text_path):
    lorem_file = os.path.join(jaraco_text_path, 'Lorem ipsum.txt')
    if os.path.exists(lorem_file):
        _jaraco_datas.append((lorem_file, 'setuptools/_vendor/jaraco/text'))
try:
    _jaraco_datas += collect_data_files('setuptools._vendor.jaraco.text', include_py_files=False)
except Exception as e:
    print(f"WARNING: Could not collect jaraco.text data files: {e}")

datas = [
    (os.path.join(backend_dir, 'fonts'), 'fonts'),
    (os.path.join(backend_dir, 'migrations'), 'migrations'),
    (os.path.join(project_root, 'assets'), 'assets'),
] + _jaraco_datas

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
    'services.ai_providers.text', 'services.ai_providers.text.base',
    'services.ai_providers.text.genai_provider',
    'services.ai_providers.text.openai_provider',
    'services.ai_providers.text.anthropic_provider',
    'services.ai_providers.text.lazyllm_provider',
    'services.ai_providers.text.codex_provider',
    'services.ai_providers.image', 'services.ai_providers.image.base',
    'services.ai_providers.image.genai_provider',
    'services.ai_providers.image.openai_provider',
    'services.ai_providers.image.anthropic_provider',
    'services.ai_providers.image.lazyllm_provider',
    'services.ai_providers.image.codex_provider',
    'services.ai_providers.image.baidu_inpainting_provider',
    'services.ai_providers.image.gemini_inpainting_provider',
    'services.ai_providers.image.volcengine_inpainting_provider',
    'services.ai_providers.ocr', 'services.ai_providers.ocr.baidu_accurate_ocr_provider',
    'services.ai_providers.ocr.baidu_table_ocr_provider',
    'services.ai_providers.genai_client', 'services.ai_providers.lazyllm_env',
    'models', 'models.project', 'models.page', 'models.task',
    'models.settings', 'config', 'desktop_bootstrap',
    'utils', 'utils.path_utils', 'utils.image_utils', 'utils.latex_utils',
    'utils.mask_utils', 'utils.page_utils', 'utils.pptx_builder',
    'utils.response', 'utils.validators',
    # Flask ecosystem
    'flask', 'flask.json', 'flask_cors', 'werkzeug', 'werkzeug.serving', 'jinja2',
    # Database
    'sqlite3',
    # AI providers
    'google.ai.generativelanguage', 'google.api_core', 'google.auth',
    'openai', 'anthropic',
    # Document processing
    'pptx.util', 'pptx.dml.color', 'pptx.enum.shapes',
    'PyPDF2', 'img2pdf', 'fitz', 'markdown', 'chardet',
    # Image processing
    'PIL._imagingtk', 'PIL._tkinter_finder', 'numpy',
    # Utilities
    'requests', 'aiohttp', 'tenacity',
    'concurrent', 'concurrent.futures',
]

# collect_submodules 自动抓取所有子模块，避免手动漏写
hiddenimports += collect_submodules('google')
hiddenimports += collect_submodules('openai')
hiddenimports += collect_submodules('anthropic')
hiddenimports += collect_submodules('flask_migrate')
hiddenimports += collect_submodules('flask_sqlalchemy')
hiddenimports += collect_submodules('alembic')
hiddenimports += collect_submodules('pptx')
hiddenimports += collect_submodules('docx')
hiddenimports += collect_submodules('markitdown')
hiddenimports += collect_submodules('reportlab')
hiddenimports += collect_submodules('lxml')
hiddenimports += collect_submodules('aiohttp')
hiddenimports += collect_submodules('httpx')
hiddenimports += collect_submodules('dotenv')
hiddenimports += collect_submodules('PIL')
hiddenimports += collect_submodules('pydantic')
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += collect_submodules('tenacity')
hiddenimports += collect_submodules('cv2')

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
