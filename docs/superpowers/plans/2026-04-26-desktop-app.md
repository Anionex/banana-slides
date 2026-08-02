# Banana Slides Desktop App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Banana Slides as a premium desktop application for Windows and macOS using Electron + PyInstaller.

**Architecture:** Electron shell manages a frameless window with custom title bar, spawns a PyInstaller-packaged Python backend as a child process, and loads the Vite-built frontend. Auto-updater checks GitHub Releases and shows a non-intrusive notification bar.

**Tech Stack:** Electron 33+, electron-builder, PyInstaller, React/TypeScript (existing), Flask/SQLite (existing), GitHub Actions

---

## File Map

### New Files (desktop/)
| File | Responsibility |
|------|---------------|
| `desktop/package.json` | Electron project config, scripts, dependencies |
| `desktop/main.js` | Main process: window, tray, menu, IPC, lifecycle |
| `desktop/preload.js` | Context bridge: expose safe APIs to renderer |
| `desktop/python-manager.js` | Spawn/monitor/kill Python backend process |
| `desktop/auto-updater.js` | Check GitHub Releases for new versions |
| `desktop/splash.html` | Premium splash screen shown during startup |
| `desktop/electron-builder.yml` | NSIS + DMG packaging config |
| `desktop/.gitignore` | Ignore node_modules, dist, build artifacts |
| `desktop/resources/icon.png` | Placeholder app icon (256x256) |

### New Files (frontend/)
| File | Responsibility |
|------|---------------|
| `frontend/src/components/shared/DesktopTitleBar.tsx` | Custom frameless title bar component |
| `frontend/src/components/shared/UpdateChecker.tsx` | Version update notification bar |

### Modified Files
| File | Change |
|------|--------|
| `backend/app.py` | Windows UTF-8, env-based paths, db.create_all |
| `backend/banana-slides.spec` | PyInstaller packaging spec |
| `frontend/src/api/client.ts` | Desktop mode base URL detection |
| `frontend/src/App.tsx` | Mount DesktopTitleBar + UpdateChecker |
| `frontend/src/components/shared/index.ts` | Export new components |
| `frontend/vite.config.ts` | Add `base: './'` for Electron |
| `.github/workflows/release-desktop.yml` | CI/CD release workflow |

---

### Task 1: Backend Desktop Adaptations (app.py)

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add Windows UTF-8 stdout/stderr reconfiguration**

At the very top of `backend/app.py`, before any other imports, add:

```python
import sys
if sys.platform == 'win32':
    if sys.stdout is not None:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if sys.stderr is not None:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
```

- [ ] **Step 2: Add env-based path support in create_app()**

Inside the `create_app()` function, after the existing `basedir` / `instance_path` logic, add environment variable overrides. Find the line where `SQLALCHEMY_DATABASE_URI` is set and wrap it:

```python
import os

# In create_app(), after existing path setup:
db_path = os.environ.get('DATABASE_PATH')
upload_folder = os.environ.get('UPLOAD_FOLDER')
export_folder = os.environ.get('EXPORT_FOLDER')

if db_path:
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
if upload_folder:
    os.makedirs(upload_folder, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = upload_folder
if export_folder:
    os.makedirs(export_folder, exist_ok=True)
    app.config['EXPORT_FOLDER'] = export_folder
```

- [ ] **Step 3: Add db.create_all() fallback**

Inside the existing `with app.app_context():` block (near the bottom of `create_app()`), add:

```python
from models import db
db.create_all()
```

This is a no-op when tables already exist (Alembic-managed), but ensures tables are created on first run in packaged mode.

- [ ] **Step 4: Verify backend still starts normally**

Run: `cd /home/aa/banana-slides/backend && uv run python -c "from app import create_app; app = create_app(); print('OK')"`

Expected: `OK` with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app.py
git commit -m "feat(backend): add desktop environment support

- Windows UTF-8 stdout/stderr reconfiguration
- Environment variable overrides for DATABASE_PATH, UPLOAD_FOLDER, EXPORT_FOLDER
- db.create_all() fallback for packaged mode"
```

---

### Task 2: PyInstaller Packaging Spec

**Files:**
- Create: `backend/banana-slides.spec`

- [ ] **Step 1: Create the PyInstaller spec file**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/banana-slides.spec
git commit -m "feat(backend): add PyInstaller packaging spec"
```

---

### Task 3: Electron Project Scaffold (package.json + .gitignore)

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/.gitignore`

- [ ] **Step 1: Create desktop/package.json**

```json
{
  "name": "banana-slides-desktop",
  "version": "0.3.0",
  "description": "Banana Slides Desktop App",
  "main": "main.js",
  "author": "Anionex",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "dev": "cross-env NODE_ENV=development electron .",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:all": "electron-builder --win --mac"
  },
  "dependencies": {
    "electron-log": "^5.1.0",
    "semver": "^7.6.0"
  },
  "devDependencies": {
    "cross-env": "^7.0.3",
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {}
}
```

- [ ] **Step 2: Create desktop/.gitignore**

```
node_modules/
dist/
build/
*.log
```

- [ ] **Step 3: Commit**

```bash
git add desktop/package.json desktop/.gitignore
git commit -m "feat(desktop): scaffold Electron project"
```

---

### Task 4: Preload Script

**Files:**
- Create: `desktop/preload.js`

- [ ] **Step 1: Create desktop/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getPlatform: () => process.platform,
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
```

- [ ] **Step 2: Commit**

```bash
git add desktop/preload.js
git commit -m "feat(desktop): add preload script with IPC bridge"
```

---

### Task 5: Python Backend Manager

**Files:**
- Create: `desktop/python-manager.js`

- [ ] **Step 1: Create desktop/python-manager.js**

```javascript
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');
const http = require('http');
const log = require('electron-log');

let backendProcess = null;
let backendPort = null;

function isDev() {
  return process.env.NODE_ENV === 'development';
}

function getBackendPath() {
  if (isDev()) {
    return null;
  }
  const resourcesPath = process.resourcesPath;
  const exeName = process.platform === 'win32' ? 'banana-backend.exe' : 'banana-backend';
  return path.join(resourcesPath, 'backend', exeName);
}

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      if (startPort < 65535) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error('No available port found'));
      }
    });
  });
}

async function startBackend(userDataPath) {
  if (isDev()) {
    backendPort = parseInt(process.env.BACKEND_PORT || '5000', 10);
    log.info(`[python-manager] Dev mode, assuming backend on port ${backendPort}`);
    return backendPort;
  }

  const backendPath = getBackendPath();
  backendPort = await findAvailablePort(15000);

  const dataDir = path.join(userDataPath, 'data');
  const uploadsDir = path.join(userDataPath, 'uploads');
  const exportsDir = path.join(userDataPath, 'exports');

  const env = {
    ...process.env,
    BACKEND_PORT: String(backendPort),
    DATABASE_PATH: path.join(dataDir, 'database.db'),
    UPLOAD_FOLDER: uploadsDir,
    EXPORT_FOLDER: exportsDir,
    FLASK_ENV: 'production',
  };

  log.info(`[python-manager] Starting backend: ${backendPath} on port ${backendPort}`);

  backendProcess = spawn(backendPath, [], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => {
    log.info(`[backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    log.warn(`[backend:err] ${data.toString().trim()}`);
  });

  backendProcess.on('exit', (code) => {
    log.info(`[python-manager] Backend exited with code ${code}`);
    backendProcess = null;
  });

  return backendPort;
}

function waitForBackend(port, timeoutMs = 30000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Backend startup timed out after 30s'));
        return;
      }
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
      req.on('error', () => setTimeout(check, 500));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    }
    check();
  });
}

function stopBackend() {
  if (!backendProcess) return Promise.resolve();

  return new Promise((resolve) => {
    const pid = backendProcess.pid;
    log.info(`[python-manager] Stopping backend (PID: ${pid})`);

    const forceKillTimer = setTimeout(() => {
      log.warn('[python-manager] Force killing backend');
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true });
        } else {
          backendProcess.kill('SIGKILL');
        }
      } catch (e) {
        log.error('[python-manager] Force kill failed:', e);
      }
      resolve();
    }, 5000);

    backendProcess.on('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(pid)], { windowsHide: true });
      } else {
        backendProcess.kill('SIGTERM');
      }
    } catch (e) {
      clearTimeout(forceKillTimer);
      resolve();
    }
  });
}

function getPort() {
  return backendPort;
}

module.exports = { startBackend, waitForBackend, stopBackend, getPort };
```

- [ ] **Step 2: Commit**

```bash
git add desktop/python-manager.js
git commit -m "feat(desktop): add Python backend process manager"
```

---

### Task 6: Auto-Updater Module

**Files:**
- Create: `desktop/auto-updater.js`

- [ ] **Step 1: Create desktop/auto-updater.js**

```javascript
const https = require('https');
const semver = require('semver');
const { app } = require('electron');
const log = require('electron-log');

const REPO_OWNER = 'Anionex';
const REPO_NAME = 'banana-slides';

function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: { 'User-Agent': `BananaSlides/${app.getVersion()}` },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          const release = JSON.parse(data);
          const latestVersion = release.tag_name.replace(/^v/, '');
          const currentVersion = app.getVersion();

          if (semver.valid(latestVersion) && semver.gt(latestVersion, currentVersion)) {
            resolve({
              version: latestVersion,
              notes: release.body || '',
              url: release.html_url,
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          log.warn('[auto-updater] Parse error:', e.message);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      log.warn('[auto-updater] Network error:', e.message);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

module.exports = { checkForUpdates };
```

- [ ] **Step 2: Commit**

```bash
git add desktop/auto-updater.js
git commit -m "feat(desktop): add GitHub Releases auto-updater"
```

---

### Task 7: Splash Screen

**Files:**
- Create: `desktop/splash.html`

- [ ] **Step 1: Create desktop/splash.html**

A self-contained HTML file with inline CSS. Premium brand feel: warm gradient, centered logo text, subtle animated progress bar.

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Banana Slides</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 480px; height: 360px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #FFF8E1 0%, #FFE082 40%, #FFB74D 100%);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    user-select: none; -webkit-app-region: drag;
  }
  .logo-area {
    display: flex; flex-direction: column;
    align-items: center; gap: 12px;
  }
  .logo-icon {
    font-size: 56px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1));
  }
  .app-name {
    font-size: 28px; font-weight: 700;
    color: #4E342E; letter-spacing: 1px;
  }
  .tagline {
    font-size: 13px; color: #795548;
    margin-top: 4px; font-weight: 400;
  }
  .progress-area {
    position: absolute; bottom: 40px;
    width: 200px; text-align: center;
  }
  .progress-bar {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.4);
    border-radius: 2px; overflow: hidden;
  }
  .progress-fill {
    height: 100%; width: 30%;
    background: linear-gradient(90deg, #FF8F00, #F57C00);
    border-radius: 2px;
    animation: progress 2s ease-in-out infinite;
  }
  @keyframes progress {
    0% { width: 10%; margin-left: 0; }
    50% { width: 40%; margin-left: 30%; }
    100% { width: 10%; margin-left: 90%; }
  }
  .status-text {
    margin-top: 10px; font-size: 12px;
    color: #6D4C41; opacity: 0.8;
  }
</style>
</head>
<body>
  <div class="logo-area">
    <div class="logo-icon">🍌</div>
    <div class="app-name">Banana Slides</div>
    <div class="tagline">AI-Native Presentation Generator</div>
  </div>
  <div class="progress-area">
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="status-text" id="status">正在启动...</div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add desktop/splash.html
git commit -m "feat(desktop): add premium splash screen"
```

---

### Task 8: Electron Main Process

**Files:**
- Create: `desktop/main.js`

- [ ] **Step 1: Create desktop/main.js**

This is the core Electron file. It orchestrates window creation, splash screen, backend startup, tray, menu, and IPC handlers.

```javascript
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const pythonManager = require('./python-manager');
const autoUpdater = require('./auto-updater');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

function isDev() {
  return process.env.NODE_ENV === 'development';
}

function getIconPath() {
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  if (isDev()) {
    return path.join(__dirname, 'resources', `icon.${ext}`);
  }
  return path.join(process.resourcesPath, `icon.${ext}`);
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 360,
    frame: false,
    resizable: false,
    transparent: false,
    center: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? {
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#6b7280',
        height: 48,
      },
    } : {}),
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Banana Slides');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function createAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于 Banana Slides', role: 'about' },
        { type: 'separator' },
        { label: '隐藏', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '全部显示', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        ...(!isMac ? [
          { type: 'separator' },
          { label: '退出', role: 'quit' },
        ] : [
          { label: '关闭窗口', role: 'close' },
        ]),
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        ...(isMac ? [
          { type: 'separator' },
          { label: '前置全部窗口', role: 'front' },
        ] : [
          { label: '关闭', role: 'close' },
        ]),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新...',
          click: async () => {
            const update = await autoUpdater.checkForUpdates();
            if (update) {
              const result = await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '发现新版本',
                message: `新版本 v${update.version} 可用`,
                detail: update.notes.substring(0, 300),
                buttons: ['前往下载', '稍后'],
              });
              if (result.response === 0) {
                shell.openExternal(update.url);
              }
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '检查更新',
                message: '当前已是最新版本',
              });
            }
          },
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 Banana Slides',
              message: `Banana Slides v${app.getVersion()}`,
              detail: 'AI-Native Presentation Generator',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupIPC() {
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-backend-port', () => pythonManager.getPort());
  ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

  ipcMain.on('window-minimize', () => { mainWindow?.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => { mainWindow?.close(); });
}

async function bootstrap() {
  createSplashWindow();
  createMainWindow();
  createTray();
  createAppMenu();
  setupIPC();

  try {
    const port = await pythonManager.startBackend(app.getPath('userData'));
    await pythonManager.waitForBackend(port);

    const frontendUrl = isDev()
      ? `http://localhost:${process.env.FRONTEND_PORT || 3000}`
      : `file://${path.join(process.resourcesPath, 'frontend', 'index.html')}`;

    mainWindow.loadURL(frontendUrl);
  } catch (err) {
    log.error('[main] Startup failed:', err);
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox('启动失败', `后端服务启动失败：${err.message}`);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  await pythonManager.stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux, closing all windows doesn't quit (tray keeps running)
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add desktop/main.js
git commit -m "feat(desktop): add Electron main process

- Frameless window with platform-native controls
- Splash screen → backend startup → main window flow
- System tray with minimize-on-close
- Chinese application menu
- IPC handlers for version, updates, window control"
```

---

### Task 9: Frontend — DesktopTitleBar Component

**Files:**
- Create: `frontend/src/components/shared/DesktopTitleBar.tsx`
- Modify: `frontend/src/components/shared/index.ts`

- [ ] **Step 1: Create DesktopTitleBar.tsx**

```tsx
import { useEffect, useState } from 'react';

const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

export function DesktopTitleBar() {
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    if (isDesktop) {
      setPlatform((window as any).electronAPI.getPlatform());
    }
  }, []);

  if (!isDesktop) return null;

  const isMac = platform === 'darwin';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center select-none"
      style={{
        WebkitAppRegion: 'drag' as any,
        backdropFilter: 'blur(12px)',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* macOS: leave space for traffic lights */}
      {isMac && <div className="w-[70px] flex-shrink-0" />}

      {/* Windows: show logo + app name */}
      {!isMac && (
        <div
          className="flex items-center gap-2 pl-4 flex-shrink-0"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          <span className="text-lg">🍌</span>
          <span className="text-sm font-semibold text-gray-700 tracking-wide">
            Banana Slides
          </span>
        </div>
      )}

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right side: macOS can have extra buttons here if needed */}
      {isMac && <div className="w-4 flex-shrink-0" />}
    </div>
  );
}
```

- [ ] **Step 2: Export from shared/index.ts**

Add to `frontend/src/components/shared/index.ts`:

```typescript
export { DesktopTitleBar } from './DesktopTitleBar';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/DesktopTitleBar.tsx frontend/src/components/shared/index.ts
git commit -m "feat(frontend): add DesktopTitleBar component

Custom frameless title bar with platform-aware layout:
- macOS: traffic light space reserved
- Windows: logo + app name, titleBarOverlay handles controls
- Frosted glass background, seamless page integration"
```

---

### Task 10: Frontend — UpdateChecker Component

**Files:**
- Create: `frontend/src/components/shared/UpdateChecker.tsx`
- Modify: `frontend/src/components/shared/index.ts`

- [ ] **Step 1: Create UpdateChecker.tsx**

```tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface UpdateInfo {
  version: string;
  notes: string;
  url: string;
}

const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

export function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    const timer = setTimeout(async () => {
      try {
        const result = await (window as any).electronAPI.checkForUpdates();
        if (result) setUpdate(result);
      } catch {
        // silently ignore update check failures
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isDesktop || !update || dismissed) return null;

  return (
    <div
      className="fixed top-12 left-0 right-0 z-40 flex items-center justify-center px-4 py-2"
      style={{
        background: 'linear-gradient(135deg, #FFF8E1, #FFE082)',
        borderBottom: '1px solid rgba(255, 183, 77, 0.3)',
      }}
    >
      <div className="flex items-center gap-3 text-sm text-amber-900">
        <span className="font-medium">
          新版本 v{update.version} 可用
        </span>
        <button
          onClick={() => (window as any).electronAPI.openExternal(update.url)}
          className="px-3 py-1 rounded-full text-xs font-medium
                     bg-amber-600 text-white hover:bg-amber-700
                     transition-colors"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          前往下载
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-amber-200/50 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          <X size={14} className="text-amber-700" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from shared/index.ts**

Add to `frontend/src/components/shared/index.ts`:

```typescript
export { UpdateChecker } from './UpdateChecker';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/shared/UpdateChecker.tsx frontend/src/components/shared/index.ts
git commit -m "feat(frontend): add UpdateChecker notification bar

Non-intrusive update notification with brand-colored gradient,
download link via electronAPI.openExternal, dismissible per session"
```

---

### Task 11: Frontend — App.tsx + client.ts + vite.config.ts Adaptations

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Modify App.tsx to mount desktop components**

Add imports and render DesktopTitleBar + UpdateChecker. The title bar is fixed at top, so add padding to the main content area when in desktop mode.

In `frontend/src/App.tsx`, add imports:

```typescript
import { useToast, AccessCodeGuard, DesktopTitleBar, UpdateChecker } from './components/shared';
```

(This replaces the existing import that only imports `useToast, AccessCodeGuard`.)

Then wrap the return JSX — add the desktop components before `<AccessCodeGuard>` and add a spacer div:

```tsx
const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

return (
  <>
    <DesktopTitleBar />
    <UpdateChecker />
    <div style={isDesktop ? { paddingTop: '48px' } : undefined}>
      <AccessCodeGuard>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/project/:projectId/outline" element={<OutlineEditor />} />
            <Route path="/project/:projectId/detail" element={<DetailEditor />} />
            <Route path="/project/:projectId/preview" element={<SlidePreview />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer />
        </BrowserRouter>
      </AccessCodeGuard>
    </div>
  </>
);
```

- [ ] **Step 2: Modify client.ts for desktop base URL**

In `frontend/src/api/client.ts`, find where the axios instance is created (the `baseURL` config). Add desktop detection before it:

```typescript
const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

function getBaseURL(): string {
  if (!isDesktop) return '';
  const port = (window as any).__BACKEND_PORT__ || 5000;
  return `http://localhost:${port}`;
}
```

Then use `getBaseURL()` as the `baseURL` in the axios instance config. Also, in the preload, the port is exposed via IPC — so add an initialization call at module level:

```typescript
if (isDesktop) {
  (window as any).electronAPI.getBackendPort().then((port: number) => {
    (window as any).__BACKEND_PORT__ = port;
  });
}
```

Place this at the top of client.ts, after the `isDesktop` const.

- [ ] **Step 3: Modify vite.config.ts — add base: './'**

In `frontend/vite.config.ts`, inside the returned config object (at the same level as `envDir`, `plugins`, etc.), add:

```typescript
base: './',
```

This ensures all asset paths are relative, which is required for Electron's `file://` protocol loading.

- [ ] **Step 4: Verify frontend builds**

Run: `cd /home/aa/banana-slides/frontend && npm run build`

Expected: Build succeeds with no errors. Check that `dist/index.html` uses relative paths (`./ ` prefix, not `/`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/api/client.ts frontend/vite.config.ts
git commit -m "feat(frontend): adapt for desktop mode

- App.tsx: mount DesktopTitleBar + UpdateChecker, add top padding
- client.ts: detect desktop mode, use direct backend URL via IPC port
- vite.config.ts: set base './' for Electron file:// loading"
```

---

### Task 12: electron-builder Configuration

**Files:**
- Create: `desktop/electron-builder.yml`
- Create: `desktop/resources/icon.png` (placeholder)

- [ ] **Step 1: Create desktop/electron-builder.yml**

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
    filter:
      - "**/*"
  - from: "frontend/"
    to: "frontend"
    filter:
      - "**/*"

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico
  artifactName: "BananaSlides-${version}-Setup.${ext}"

mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
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

- [ ] **Step 2: Create placeholder icon**

Create a minimal 1x1 PNG as placeholder (real icons will be added by the designer):

Run: `cd /home/aa/banana-slides/desktop && mkdir -p resources && python3 -c "
import struct, zlib
def create_png(path, w=256, h=256):
    raw = b''
    for y in range(h):
        raw += b'\\x00' + bytes([255, 200, 50, 255] * w)
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\\x89PNG\\r\\n\\x1a\\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(raw)))
        f.write(chunk(b'IEND', b''))
create_png('resources/icon.png')
"`

- [ ] **Step 3: Commit**

```bash
git add desktop/electron-builder.yml desktop/resources/icon.png
git commit -m "feat(desktop): add electron-builder config and placeholder icon"
```

---

### Task 13: GitHub Actions Release Workflow

**Files:**
- Create: `.github/workflows/release-desktop.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Release Desktop App

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: macos-latest
            platform: mac

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Sync version from tag
        shell: bash
        run: |
          VERSION="${GITHUB_REF_NAME#v}"
          cd desktop && node -e "
            const pkg = require('./package.json');
            pkg.version = '${VERSION}';
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
          "

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Build frontend
        run: cd frontend && npm run build

      - name: Install backend dependencies
        run: cd backend && uv sync

      - name: Install PyInstaller
        run: uv pip install pyinstaller

      - name: Package backend
        run: cd backend && uv run pyinstaller banana-slides.spec --noconfirm

      - name: Prepare desktop build
        shell: bash
        run: |
          cp -r frontend/dist desktop/frontend
          cp -r backend/dist/banana-backend desktop/backend

      - name: Install Electron dependencies
        run: cd desktop && npm ci

      - name: Build desktop app
        run: cd desktop && npx electron-builder --${{ matrix.platform }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload to Release
        uses: softprops/action-gh-release@v2
        with:
          files: desktop/dist/*
          draft: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-desktop.yml
git commit -m "ci: add GitHub Actions desktop release workflow

Triggered on v* tags. Builds Windows (NSIS) and macOS (DMG)
installers using electron-builder. Uploads artifacts to GitHub
Release as draft."
```

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Backend desktop adaptations | `backend/app.py` |
| 2 | PyInstaller spec | `backend/banana-slides.spec` |
| 3 | Electron scaffold | `desktop/package.json`, `desktop/.gitignore` |
| 4 | Preload script | `desktop/preload.js` |
| 5 | Python manager | `desktop/python-manager.js` |
| 6 | Auto-updater | `desktop/auto-updater.js` |
| 7 | Splash screen | `desktop/splash.html` |
| 8 | Main process | `desktop/main.js` |
| 9 | DesktopTitleBar | `frontend/src/components/shared/DesktopTitleBar.tsx` |
| 10 | UpdateChecker | `frontend/src/components/shared/UpdateChecker.tsx` |
| 11 | Frontend adaptations | `App.tsx`, `client.ts`, `vite.config.ts` |
| 12 | electron-builder config | `desktop/electron-builder.yml` |
| 13 | CI/CD release workflow | `.github/workflows/release-desktop.yml` |
