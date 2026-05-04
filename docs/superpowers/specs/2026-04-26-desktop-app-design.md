# Banana Slides Desktop App — Design Spec

Date: 2026-04-26

## Overview

将 Banana Slides 打包为桌面应用，支持 Windows (NSIS installer) 和 macOS (DMG)。采用 Electron 作为桌面壳，PyInstaller 打包 Python 后端为独立可执行文件，前端构建产物作为静态资源嵌入。

核心体验目标：**一流品牌感**。自定义无边框标题栏、精致的启动画面、流畅的启动流程，不能有任何廉价感。

## 1. 项目结构

```
desktop/
├── main.js                 # Electron 主进程
├── preload.js              # 预加载脚本（暴露 IPC API）
├── python-manager.js       # Python 后端进程生命周期管理
├── auto-updater.js         # GitHub Releases 版本检测
├── splash.html             # 启动画面
├── package.json            # Electron 项目配置
├── electron-builder.yml    # 打包配置（NSIS + DMG）
├── resources/
│   ├── icon.ico            # Windows 图标
│   ├── icon.icns           # macOS 图标
│   ├── icon.png            # 通用图标
│   ├── installer.nsh       # NSIS 自定义安装脚本
│   └── README.md           # 资源说明
├── scripts/
│   └── build-all.bat       # Windows 一键构建脚本
└── .gitignore
```

## 2. Electron 主进程 (main.js)

### 2.1 窗口配置

使用无边框窗口 + 平台原生窗口控制：

- macOS: `titleBarStyle: 'hidden'`，保留原生红绿灯按钮
- Windows: `titleBarStyle: 'hidden'` + `titleBarOverlay`，使用系统原生最小化/最大化/关闭按钮

```javascript
const win = new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 1024,
  minHeight: 700,
  show: false,
  titleBarStyle: 'hidden',
  ...(process.platform !== 'darwin' ? {
    titleBarOverlay: {
      color: '#00000000',  // 透明背景，融入页面
      symbolColor: '#6b7280',
      height: 48
    }
  } : {}),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  }
});
```

### 2.2 启动流程

1. 显示 splash 窗口（无边框、居中、不可调整大小）
2. 启动 Python 后端进程（通过 python-manager）
3. 轮询 `http://localhost:{port}/health` 等待后端就绪
4. 后端就绪后，主窗口加载前端页面
5. 主窗口 ready-to-show 后，关闭 splash，显示主窗口

### 2.3 系统托盘

关闭窗口时最小化到系统托盘，托盘右键菜单：
- 显示主窗口
- 分隔线
- 退出应用

macOS 上 dock 图标点击时恢复窗口。

### 2.4 应用菜单（中文）

自定义中文菜单栏：
- 文件：新建窗口、退出
- 编辑：撤销、重做、剪切、复制、粘贴、全选
- 视图：重新加载、开发者工具、全屏
- 窗口：最小化、关闭
- 帮助：关于、检查更新

### 2.5 用户数据目录

使用 `app.getPath('userData')` 作为数据根目录：
- Windows: `%APPDATA%/BananaSlides/`
- macOS: `~/Library/Application Support/BananaSlides/`

子目录：
- `data/database.db` — SQLite 数据库
- `uploads/` — 用户上传文件
- `exports/` — 导出的 PPT/PDF
- `logs/` — 应用日志

通过环境变量传递给后端：`DATABASE_PATH`, `UPLOAD_FOLDER`, `EXPORT_FOLDER`。

## 3. 预加载脚本 (preload.js)

通过 `contextBridge` 暴露安全 API：

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // 版本信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  // 更新检查
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // 平台信息
  getPlatform: () => process.platform,
  // 窗口控制（用于自定义标题栏）
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  // 外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
```

## 4. Python 后端管理 (python-manager.js)

### 4.1 职责

- 定位 PyInstaller 打包的后端可执行文件
- 分配可用端口
- 启动后端进程，传递环境变量
- 健康检查轮询
- 进程退出时清理

### 4.2 端口分配

开发模式使用固定端口 5000，打包模式动态分配可用端口（从 15000 开始扫描）。

### 4.3 环境变量传递

启动后端时设置：
- `DATABASE_PATH` — 数据库文件路径
- `UPLOAD_FOLDER` — 上传目录
- `EXPORT_FOLDER` — 导出目录
- `CORS_ORIGINS` — `http://localhost:{electronPort}`
- `FLASK_ENV` — `production`

### 4.4 健康检查

每 500ms 轮询 `/health`，最多等待 30 秒。超时则显示错误对话框并退出。

### 4.5 进程清理

应用退出时（`app.on('before-quit')`）：
- 发送 SIGTERM 给后端进程
- 等待 5 秒
- 如果仍在运行，发送 SIGKILL
- Windows 上使用 `taskkill /F /PID`

## 5. 自动更新检测 (auto-updater.js)

### 5.1 检测逻辑

- 调用 GitHub API: `GET https://api.github.com/repos/Anionex/banana-slides/releases/latest`
- 比较 `tag_name`（semver）与当前 `app.getVersion()`
- 如果有新版本，返回版本号、更新说明、下载链接

### 5.2 触发时机

- 应用启动后 5 秒自动检查一次
- 用户可通过菜单"帮助 → 检查更新"手动触发
- 前端 UpdateChecker 组件通过 IPC 调用

### 5.3 交互方式

检测到新版本后，前端显示非侵入式通知条，包含：
- 新版本号
- 更新说明摘要
- "前往下载"按钮（打开 GitHub Releases 页面）
- "稍后提醒"按钮

## 6. 启动画面 (splash.html)

独立 HTML 文件，无边框窗口加载。设计要求：

- 尺寸：480×360，居中显示，不可调整大小
- 背景：渐变色（banana 品牌色系，暖黄到橙色渐变）
- Logo：居中显示应用 logo
- 应用名："Banana Slides" 使用品牌字体
- 加载动画：底部细长进度条 + 状态文字（"正在启动后端服务..."）
- 整体风格：简洁、高级、品牌感强

## 7. 前端自定义标题栏 (DesktopTitleBar.tsx)

### 7.1 设计要求

仅在桌面模式下渲染。高级感、不廉价。

- 高度 48px，与页面内容无缝融合
- 左侧：macOS 上留出红绿灯空间（~70px padding），Windows 上显示应用 logo + 名称
- 中间：可选显示当前页面标题
- 右侧：Windows 上由 `titleBarOverlay` 处理原生按钮，macOS 上可放置功能按钮
- 整个标题栏区域可拖拽（`-webkit-app-region: drag`），按钮区域设为 `no-drag`
- 支持亮色/暗色主题
- 背景使用毛玻璃效果（`backdrop-filter: blur`）或与页面背景融合

### 7.2 实现

- 检测 `window.electronAPI` 是否存在来判断桌面模式
- 通过 CSS `env(titlebar-area-*)` 适配 Windows titleBarOverlay 区域
- macOS 上通过 `navigator.platform` 或 preload 暴露的 `getPlatform()` 判断

## 8. 前端更新检查组件 (UpdateChecker.tsx)

- 应用启动后通过 `window.electronAPI.checkForUpdates()` 检查
- 有新版本时在页面顶部显示通知条（不遮挡内容，推挤布局）
- 通知条样式：品牌色渐变背景，圆角，带关闭按钮
- "前往下载"按钮调用 `window.electronAPI.openExternal(url)`
- 用户关闭后本次会话不再显示

## 9. 前端 API Client 适配 (client.ts)

桌面模式下，前端不通过 Vite proxy 而是直接连接后端：

```typescript
const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;
const API_BASE_URL = isDesktop
  ? `http://localhost:${window.__BACKEND_PORT__ || 5000}`
  : '';
```

后端端口通过 Electron preload 脚本在 `contextBridge.exposeInMainWorld` 中注入到 `window.__BACKEND_PORT__`。主进程在启动后端时确定端口，通过 IPC 传递给 preload。

## 10. Backend 改动 (app.py)

### 10.1 Windows UTF-8 输出

在文件顶部、所有 import 之前：

```python
if sys.platform == 'win32':
    if sys.stdout is not None:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr is not None:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
```

### 10.2 环境变量路径支持

`create_app()` 中检查 `DATABASE_PATH`, `UPLOAD_FOLDER`, `EXPORT_FOLDER` 环境变量。如果存在则使用（桌面模式），否则使用现有的相对路径逻辑（开发模式）。

### 10.3 数据库表自动创建

在 `with app.app_context():` 块中添加 `db.create_all()`，确保打包后首次运行时自动创建表。开发模式下 Alembic 仍然是主要的迁移工具，`db.create_all()` 作为兜底。

## 11. PyInstaller 打包规格 (banana-slides.spec)

### 11.1 入口

`backend/app.py`

### 11.2 数据文件

- `fonts/` — 字体文件
- `migrations/` — Alembic 迁移文件

### 11.3 隐式导入

收集所有关键依赖的子模块：flask, sqlalchemy, google.generativeai, openai, pptx, docx, lxml, httpx, aiohttp, reportlab, markitdown 等。

### 11.4 排除

tkinter, matplotlib, scipy, IPython, jupyter, notebook — 减小体积。

### 11.5 输出

- 可执行文件名：`banana-backend`
- 模式：`console=False`（无控制台窗口）
- 使用 COLLECT 模式（非单文件），便于调试和更新

## 12. electron-builder 配置

```yaml
appId: com.banana.slides
productName: Banana Slides

directories:
  output: dist
  buildResources: resources

files:
  - "main.js"
  - "python-manager.js"
  - "preload.js"
  - "auto-updater.js"
  - "splash.html"
  - "package.json"
  - "node_modules/**/*"

extraResources:
  - from: "backend/"
    to: "backend"
    filter: ["**/*"]
  - from: "frontend/"
    to: "frontend"
    filter: ["**/*"]

win:
  target:
    - target: nsis
      arch: [x64]
  icon: resources/icon.ico
  artifactName: "BananaSlides-${version}-Setup.${ext}"

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  icon: resources/icon.icns
  artifactName: "BananaSlides-${version}.${ext}"

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: "Banana Slides"

compression: maximum
```

## 13. GitHub Actions 发布工作流 (release-desktop.yml)

### 13.1 触发条件

推送 `v*` 标签时触发。

### 13.2 构建矩阵

- Windows: `windows-latest`
- macOS: `macos-latest`

### 13.3 步骤

1. Checkout 代码
2. 从 tag 同步版本号到 `desktop/package.json` 和 `frontend/package.json`
3. 安装 Node.js 依赖
4. 安装 Python + uv
5. 构建前端 (`npm run build`)
6. PyInstaller 打包后端
7. 复制构建产物到 `desktop/frontend/` 和 `desktop/backend/`
8. electron-builder 打包
9. 上传到 GitHub Release

## 14. Vite 配置改动

添加 `base: './'` 确保构建产物使用相对路径，适配 Electron 的 `file://` 协议加载。

## 15. 不在范围内

- 百度 OCR API Key 设置：已在当前代码中实现，无需改动
- 应用内自动下载安装：仅做版本检测 + 引导下载
- Linux 支持：本次不做
- 代码签名：本次不配置，后续可加
