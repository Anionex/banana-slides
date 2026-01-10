# Banana Slides Desktop

将 Banana Slides 打包为 Windows 桌面应用的 Electron 项目。

## 项目结构

```
desktop/
├── main.js              # Electron 主进程
├── python-manager.js    # Python 后端进程管理
├── preload.js           # 预加载脚本
├── splash.html          # 启动画面
├── package.json         # Electron 项目配置
├── electron-builder.yml # 打包配置
├── resources/           # 应用图标等资源
│   └── icon.ico         # 应用图标（需要自行添加）
├── scripts/
│   └── build-all.bat    # 一键构建脚本
├── frontend/            # 前端构建产物（构建时自动复制）
└── backend/             # 后端打包产物（构建时自动复制）
```

## 开发模式

开发时需要分别启动前后端：

```bash
# 1. 启动后端（在项目根目录）
cd backend
uv run alembic upgrade head && uv run python app.py

# 2. 启动前端开发服务器（新终端）
cd frontend
npm run dev

# 3. 启动 Electron（新终端）
cd desktop
npm install
npm run dev
```

## 构建安装包

### 前置要求

- Node.js 18+
- Python 3.10+
- PyInstaller (`pip install pyinstaller`)

### 一键构建

```bash
cd desktop/scripts
build-all.bat
```

构建完成后，安装包位于 `desktop/dist/BananaSlides-*-Setup.exe`

### 手动构建步骤

1. 构建前端

   ```bash
   cd frontend
   npm run build
   ```

2. 打包后端

   ```bash
   cd backend
   pyinstaller banana-slides.spec --clean --noconfirm
   ```

3. 复制产物

   ```bash
   xcopy /E /I /Y frontend\dist desktop\frontend
   xcopy /E /I /Y backend\dist\banana-backend desktop\backend
   ```

4. 构建 Electron 安装包
   ```bash
   cd desktop
   npm install
   npm run build:electron
   ```

## 注意事项

1. **图标文件**：构建前需要在 `resources/` 目录放置 `icon.ico` 文件
2. **依赖问题**：PyInstaller 可能遗漏某些隐式依赖，需要在 `banana-slides.spec` 中添加
3. **安装包大小**：预计 300-400 MB（包含 Python 运行时和所有依赖）

## 用户数据位置

安装后，用户数据存储在：

- Windows: `%APPDATA%/BananaSlides/`
  - `data/database.db` - 数据库
  - `uploads/` - 上传的文件
  - `exports/` - 导出的 PPT/PDF
  - `logs/` - 应用日志
