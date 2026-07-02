const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const fs = require('fs');
const pythonManager = require('./python-manager');
const autoUpdater = require('./auto-updater');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let backendStopped = false;
let backendStopRequested = false;

function isDev() {
  return process.env.NODE_ENV === 'development';
}

function isSmokeMode() {
  return process.env.BANANA_DESKTOP_SMOKE === '1';
}

function getSmokeQuitDelayMs() {
  const delay = Number(process.env.BANANA_DESKTOP_SMOKE_QUIT_DELAY_MS || 10000);
  return Number.isFinite(delay) && delay >= 0 ? delay : 10000;
}

async function writeSmokeResult(extra = {}) {
  if (!isSmokeMode()) return;

  const resultPath = process.env.BANANA_DESKTOP_SMOKE_RESULT || '';
  const screenshotPath = process.env.BANANA_DESKTOP_SMOKE_SCREENSHOT || '';
  const result = {
    ok: true,
    version: app.getVersion(),
    platform: process.platform,
    backendPort: pythonManager.getPort(),
    windowBounds: mainWindow?.getBounds() || null,
    windowVisible: mainWindow?.isVisible() || false,
    windowTitle: mainWindow?.getTitle() || '',
    url: mainWindow?.webContents?.getURL() || '',
    timestamp: new Date().toISOString(),
    ...extra,
  };

  try {
    if (screenshotPath && mainWindow && !mainWindow.isDestroyed()) {
      const image = await mainWindow.webContents.capturePage();
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      fs.writeFileSync(screenshotPath, image.toPNG());
      result.screenshotPath = screenshotPath;
    }
    if (resultPath) {
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    }
  } catch (error) {
    log.error('[main] Failed to write smoke result:', error);
    if (resultPath) {
      fs.mkdirSync(path.dirname(resultPath), { recursive: true });
      fs.writeFileSync(resultPath, JSON.stringify({
        ok: false,
        error: error.message,
        ...result,
      }, null, 2));
    }
  } finally {
    setTimeout(() => {
      isQuitting = true;
      app.quit();
    }, getSmokeQuitDelayMs());
  }
}

function getIconPath() {
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `icon.${ext}`);
  }
  return path.join(__dirname, 'resources', `icon.${ext}`);
}

function shouldOpenInExternalBrowser(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

function createUniqueDownloadUrl(url) {
  if (isClientSideDownloadUrl(url)) {
    return url;
  }
  try {
    const parsedUrl = new URL(url);
    parsedUrl.searchParams.set('__bananaDownloadId', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    return parsedUrl.toString();
  } catch (error) {
    return url;
  }
}

function isClientSideDownloadUrl(url) {
  return typeof url === 'string' && /^(data|blob):/i.test(url);
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
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 680,
    minHeight: 480,
    show: false,
    icon: getIconPath(),
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 16, y: 16 },
          backgroundColor: '#ffffff',
        }
      : {
          frame: false,
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isMac) {
    app.dock.setIcon(getIconPath());
  }

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
    mainWindow.webContents.setZoomFactor(0.8);
    mainWindow.show();
    mainWindow.focus();
    setTimeout(() => writeSmokeResult(), 1000);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenInExternalBrowser(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (shouldOpenInExternalBrowser(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Banana Slides');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
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
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+=' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { label: '重置缩放', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '重新加载', role: 'reload' },
        { label: '强制重新加载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
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
  ipcMain.handle('open-external', (_, url) => {
    try {
      const parsedUrl = new URL(url);
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        return shell.openExternal(url);
      }
    } catch (e) {
      log.error('[main] Invalid URL for open-external:', url);
    }
  });

  ipcMain.on('window-minimize', () => { mainWindow?.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window-close', () => { mainWindow?.close(); });

  ipcMain.on('zoom-in', () => {
    const wc = mainWindow?.webContents;
    if (wc) wc.setZoomLevel(wc.getZoomLevel() + 0.5);
  });
  ipcMain.on('zoom-out', () => {
    const wc = mainWindow?.webContents;
    if (wc) wc.setZoomLevel(wc.getZoomLevel() - 0.5);
  });
  ipcMain.on('zoom-reset', () => {
    mainWindow?.webContents?.setZoomLevel(0);
  });
  ipcMain.handle('get-zoom-level', () => {
    return mainWindow?.webContents?.getZoomLevel() ?? 0;
  });

  // 原生下载对话框：前端传入绝对 URL + 建议文件名
  ipcMain.handle('download-file', async (_, { url, filename }) => {
    const currentWindow = mainWindow;
    if (!currentWindow || currentWindow.isDestroyed()) return { success: false };
    const ext = (filename || 'file').split('.').pop() || '*';
    const downloadUrl = createUniqueDownloadUrl(url);
    const { filePath: savePath, canceled } = await dialog.showSaveDialog(currentWindow, {
      defaultPath: filename || 'download',
      filters: [{ name: '所有文件', extensions: [ext, '*'] }],
    });
    if (canceled || !savePath) return { success: false, canceled: true };
    if (currentWindow.isDestroyed()) return { success: false };
    const downloadSession = currentWindow.webContents.session;
    let cleanupTimer = null;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      downloadSession.removeListener('will-download', listener);
      currentWindow.removeListener('closed', cleanup);
    };
    const listener = (_, item) => {
      const itemUrl = item.getURL();
      const urlChain = typeof item.getURLChain === 'function' ? item.getURLChain() : [itemUrl];
      const isMatchingClientSideDownload = isClientSideDownloadUrl(downloadUrl) && itemUrl === downloadUrl;
      if (!urlChain.includes(downloadUrl) && !isMatchingClientSideDownload) {
        return;
      }
      item.setSavePath(savePath);
      cleanup();
    };
    downloadSession.on('will-download', listener);
    currentWindow.once('closed', cleanup);
    cleanupTimer = setTimeout(cleanup, 300000);
    currentWindow.webContents.downloadURL(downloadUrl);
    return { success: true };
  });
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

    if (isDev()) {
      mainWindow.loadURL(`http://localhost:${process.env.FRONTEND_PORT || 3000}?backendPort=${port}`);
    } else {
      mainWindow.loadFile(path.join(process.resourcesPath, 'frontend', 'index.html'), {
        query: { backendPort: String(port) },
      });
    }
  } catch (err) {
    log.error('[main] Startup failed:', err);
    if (splashWindow) splashWindow.close();
    dialog.showErrorBox('启动失败', `后端服务启动失败：${err.message}`);
    app.quit();
  }
}

app.whenReady().then(bootstrap);
if (process.platform === 'win32') {
  app.setAppUserModelId('com.banana.slides');
}

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', (event) => {
  isQuitting = true;
  if (backendStopped) return;

  event.preventDefault();
  if (backendStopRequested) return;
  backendStopRequested = true;

  pythonManager.stopBackend().finally(() => {
    backendStopped = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux, closing all windows doesn't quit (tray keeps running)
  }
});
