# -*- mode: python ; coding: utf-8 -*-
# Banana Slides Backend - PyInstaller Spec File

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# 收集各种依赖的数据文件
datas = [
    ('fonts', 'fonts'),                    # 字体文件
    ('migrations', 'migrations'),          # Alembic 迁移文件
]

# 手动添加 setuptools 中的 Lorem ipsum.txt 文件（collect_data_files 对 setuptools 无效）
import site
site_packages = site.getsitepackages()[0]
jaraco_text_path = os.path.join(site_packages, 'setuptools', '_vendor', 'jaraco', 'text')
if os.path.exists(jaraco_text_path):
    lorem_file = os.path.join(jaraco_text_path, 'Lorem ipsum.txt')
    if os.path.exists(lorem_file):
        datas.append((lorem_file, 'setuptools/_vendor/jaraco/text'))

# 尝试收集其他可能需要的数据文件
try:
    datas += collect_data_files('setuptools._vendor.jaraco.text', include_py_files=False)
except Exception:
    pass

# 隐式导入的模块
hiddenimports = [
    # Flask 相关
    'flask',
    'flask_cors',
    'flask_sqlalchemy',
    'flask_migrate',
    
    # SQLAlchemy
    'sqlalchemy',
    'sqlalchemy.sql.default_comparator',
    'sqlalchemy.ext.hybrid',
    
    # AI SDK
    'google.generativeai',
    'google.genai',
    'google.ai.generativelanguage',
    'google.api_core',
    'google.auth',
    'openai',
    
    # 图片处理
    'PIL',
    'PIL._imagingtk',
    'PIL._tkinter_finder',
    'cv2',
    
    # Office 文件处理
    'pptx',
    'pptx.util',
    'pptx.dml.color',
    'pptx.enum.shapes',
    'docx',
    'PyPDF2',
    'pdf2image',
    'reportlab',
    'img2pdf',
    
    # Markdown 和文档处理
    'markdown',
    'markitdown',
    'lxml',
    'chardet',
    
    # HTTP 客户端
    'requests',
    'httpx',
    'aiohttp',
    
    # Flask 相关
    'werkzeug',
    'jinja2',
    'click',
    'itsdangerous',
    'markupsafe',
    
    # 数据处理
    'numpy',
    'pandas',
    'pydantic',
    
    # Alembic
    'alembic',
    'alembic.config',
    
    # 其他
    'tenacity',
    'dotenv',
    'encodings',
    'codecs',
]

# 收集子模块
hiddenimports += collect_submodules('google')
hiddenimports += collect_submodules('openai')
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

# 分析阶段
a = Analysis(
    ['app.py'],
    pathex=[os.path.dirname(os.path.abspath('app.py'))],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'scipy',
        'IPython',
        'jupyter',
        'notebook',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# 创建 PYZ 存档
pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher
)

# 创建可执行文件
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
    console=False,  # 无控制台窗口
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../desktop/resources/icon.ico' if os.path.exists('../desktop/resources/icon.ico') else None,
)

# 收集所有文件
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
