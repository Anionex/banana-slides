# Banana Slides 桌面版交接文档

## 分支信息

- 分支：`feat/electron-desktop`
- Worktree：`/home/aa/banana-slides-electron`
- PR：https://github.com/Anionex/banana-slides/pull/377

---

## 已完成的工作

### 核心功能（已实现）

| 功能 | 状态 | 文件 |
|------|------|------|
| Electron 主进程 | ✅ | `desktop/main.js` |
| 预加载脚本 / IPC | ✅ | `desktop/preload.js` |
| Python 后端进程管理 | ✅ | `desktop/python-manager.js` |
| GitHub Releases 自动更新检测 | ✅ | `desktop/auto-updater.js` |
| 亮色 Splash 启动画面 | ✅ | `desktop/splash.html` |
| electron-builder 配置 | ✅ | `desktop/electron-builder.yml` |
| PyInstaller 打包规格 | ✅ | `backend/banana-slides.spec` |
| 自定义无边框标题栏（50px） | ✅ | `frontend/src/components/shared/DesktopTitleBar.tsx` |
| 标题栏常驻导航按钮 | ✅ | 同上 |
| 更新通知条 | ✅ | `frontend/src/components/shared/UpdateChecker.tsx` |
| HashRouter（file:// 兼容） | ✅ | `frontend/src/App.tsx` |
| API client 桌面模式检测 | ✅ | `frontend/src/api/client.ts` |
| 静态资源相对路径修复 | ✅ | `frontend/src/config/presetStyles.ts`, `TemplateSelector.tsx` |
| Logo import 修复 | ✅ | `DesktopTitleBar.tsx`, `Home.tsx`, `Landing.tsx`, `HelpModal.tsx` |
| Windows NSIS 安装包 | ✅ | 已验证可构建 |
| Linux AppImage + deb | ✅ 配置完成 | `electron-builder.yml`, CI workflow |
| GitHub Actions 发布工作流 | ✅ | `.github/workflows/release-desktop.yml` |
| 单元测试 | ✅ 15/15 | `frontend/src/tests/desktop-*.test.ts` |

---

## 已解决的 Bug

### ✅ 后端启动失败

**现象：** 安装后启动，后端进程立即退出，日志报：
```
Error: Path doesn't exist: migrations. Please use the 'init' command to create a new scripts folder.
```

**根本原因：** `flask_migrate.upgrade()` 找不到 migrations 目录。PyInstaller 把 migrations 打包到了 `_internal/migrations/`，但 `flask_migrate` 默认在当前工作目录找 `migrations/`，而不是 `__file__` 所在目录。

**最终修复：**
- 桌面模式由 Electron 传入 `DATABASE_PATH` / `UPLOAD_FOLDER` / `EXPORT_FOLDER`，这些运行时路径不会被仓库 `.env` 覆盖。
- `backend/app.py` 只在桌面模式（`DATABASE_PATH` 存在）跳过 Alembic，使用 `db.create_all()` 初始化本地 SQLite。
- `backend/desktop_bootstrap.py` 只在桌面模式运行，用于修复旧安装包创建的本地 SQLite schema；Docker/源码部署不执行这段兼容补列逻辑。
- 非桌面模式保留原有 Alembic/fallback 启动路径，避免桌面兼容逻辑影响 Docker、源码部署等用法。

**验证结果：**
- 源码模式：从非 `backend/` 工作目录启动，并设置 `DATABASE_PATH`，`/health` 正常返回 200。
- 旧桌面库：手工创建缺少 `settings.enable_text_reasoning` 的 SQLite 数据库后，启动后端并 PUT `/api/settings` 正常返回 200。
- 打包模式：`C:\tmp\banana-build\backend\banana-backend.exe` 使用桌面数据目录启动，`/health` 正常返回 200，数据库文件正常创建。

**相关文件：**
- `backend/app.py`
- `backend/desktop_bootstrap.py`
- `backend/banana-slides.spec`
- `backend/tests/unit/test_desktop_backend_startup.py`

---

## 构建方法

### 前提条件

- Windows 机器（或 WSL2 + Windows interop）
- Windows 侧：Node.js 20+、Python 3.11（项目 .venv，不要用全局 Python）
- WSL 侧：uv、Node.js

### 一次完整构建流程

```bash
# 1. 在 WSL 里构建前端
cd /home/aa/banana-slides-electron/frontend
./node_modules/.bin/vite build

# 2. 同步文件到 Windows 构建目录
rsync -a /home/aa/banana-slides-electron/desktop/ /mnt/c/tmp/banana-build/desktop/ --exclude=node_modules --exclude=dist
rsync -a /home/aa/banana-slides-electron/frontend/dist/ /mnt/c/tmp/banana-build/frontend/
rsync -a /home/aa/banana-slides-electron/backend/ /mnt/c/tmp/banana-build/backend_src/ \
  --exclude=__pycache__ --exclude=.venv --exclude=dist --exclude=build --exclude='*.egg-info'

# 3. 在 Windows 侧用干净 venv 跑 PyInstaller（重要：不能用全局 Python，全局有 torch 会卡死）
# 先确保 C:\tmp\banana-build\.venv 存在（uv sync 创建）
powershell.exe -Command "cd 'C:\tmp\banana-build\backend_src'; & '..\\.venv\\Scripts\\python.exe' -m PyInstaller banana-slides.spec --noconfirm --log-level WARN"

# 4. 把 PyInstaller 输出移到 backend/
powershell.exe -Command "Remove-Item -Recurse -Force 'C:\tmp\banana-build\backend'; Copy-Item -Recurse 'C:\tmp\banana-build\backend_src\dist\banana-backend' 'C:\tmp\banana-build\backend'"

# 5. electron-builder 打包
powershell.exe -Command "
  \$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
  \$env:CSC_IDENTITY_AUTO_DISCOVERY='false'
  cd 'C:\tmp\banana-build\desktop'
  npx electron-builder --win --config.win.signAndEditExecutable=false
"
```

输出：`C:\tmp\banana-build\desktop\dist\BananaSlides-0.3.0-Setup.exe`

### 重要注意事项

1. **PyInstaller 必须用项目 .venv 的 Python**，不能用全局 Python（全局有 torch 等大包，分析阶段会卡死 10+ 分钟）
2. **`package.json` 里不能有 `"build": {}`**，空对象会覆盖 `electron-builder.yml` 的所有配置
3. **`extraResources` 的 `from` 路径**相对于 `desktop/` 目录，backend 和 frontend 是兄弟目录，需要 `../backend/` 和 `../frontend/`
4. **Windows SmartScreen** 会拦截未签名的 exe，右键 → 属性 → 解除锁定，或右键以管理员身份运行

---

## 开发模式（快速调试）

```bash
# WSL 里启动后端
cd /home/aa/banana-slides-electron/backend
nohup uv run python app.py > /tmp/electron-backend.log 2>&1 &

# WSL 里启动前端
cd /home/aa/banana-slides-electron/frontend
nohup ./node_modules/.bin/vite --port 3034 > /tmp/electron-frontend.log 2>&1 &

# Windows 侧启动 Electron（C:\tmp\electron-app 里已有装好的 node_modules）
# 在 PowerShell 里：
cd C:\tmp\electron-app
$env:NODE_ENV='development'
$env:FRONTEND_PORT='3034'
$env:BACKEND_PORT='5034'
node node_modules\electron\cli.js .
```

---

## 设计原则（用户确认过的，不要改）

- 标题栏高度 50px，纯白背景 `#ffffff`，`z-index: 9999`
- 导航按钮常驻标题栏（素材生成、素材中心、历史、设置、Zoom、语言、主题）
- 素材生成/素材中心通过 URL params `?action=material-generate` / `?action=material-center` 触发 Home 页面 modal
- Home 页面在桌面模式下隐藏 web 导航栏
- Splash 亮色主题（白色到暖黄渐变），真实 logo，浮动动画
- Windows 窗口控制按钮：最小化/最大化灰色悬停，关闭红色悬停
- 默认窗口 1100×750，最小 680×480
- `isDesktop` 统一从 `@/utils` 导入，不在各文件重复定义

---

## 文件结构

```
desktop/
├── main.js                 # 主进程
├── preload.js              # IPC bridge
├── python-manager.js       # 后端进程管理
├── auto-updater.js         # 版本检测
├── splash.html             # 启动画面
├── electron-builder.yml    # 打包配置
├── package.json            # 注意：不要加 "build": {}
└── resources/
    ├── icon.ico            # 应用图标（Windows）
    ├── icon.png            # 应用图标（Linux/通用）
    ├── installer-icon.ico  # 安装包图标（通用下载图标）
    ├── installerSidebar.bmp
    └── installerHeader.bmp

backend/
└── banana-slides.spec      # PyInstaller 规格

frontend/src/
├── components/shared/
│   ├── DesktopTitleBar.tsx # 自定义标题栏（含导航按钮）
│   └── UpdateChecker.tsx   # 更新通知条
├── App.tsx                 # HashRouter/BrowserRouter 切换
├── api/client.ts           # 桌面模式 baseURL 检测
└── utils/index.ts          # isDesktop 共享常量

.github/workflows/
└── release-desktop.yml     # v* tag 触发，Win + macOS + Linux
```
