const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const fs = require('fs');
const pythonManager = require('./python-manager');
const autoUpdater = require('./auto-updater');
const {
  copyLocalExportToPath,
  createUniqueDownloadUrl,
  downloadToPath,
  resolveLocalExportPath,
} = require('./download-manager');
const {
  getApplicationIconPath,
  getTrayIconPath,
  shouldSetDockIcon,
} = require('./icon-policy');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let backendStopped = false;
let backendStopRequested = false;
const runtimeIconState = {
  dockOverrideApplied: false,
  trayTemplateImage: false,
};

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSmokeCaptureReady(webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  if (webContents.isLoadingMainFrame()) {
    await Promise.race([
      new Promise((resolve) => webContents.once('did-stop-loading', resolve)),
      sleep(10000),
    ]);
  }
  await sleep(Number(process.env.BANANA_DESKTOP_SMOKE_CAPTURE_DELAY_MS || 1500));
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
    iconPolicy: runtimeIconState,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  try {
    if (screenshotPath && mainWindow && !mainWindow.isDestroyed()) {
      await waitForSmokeCaptureReady(mainWindow.webContents);
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
  return getApplicationIconPath({
    platform: process.platform,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    desktopDir: __dirname,
  });
}

function getTrayPath() {
  return getTrayIconPath({
    platform: process.platform,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    desktopDir: __dirname,
  });
}

function shouldOpenInExternalBrowser(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
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
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 16, y: 16 },
          backgroundColor: '#ffffff',
        }
      : {
          frame: false,
          icon: getIconPath(),
        }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (shouldSetDockIcon({ platform: process.platform, isPackaged: app.isPackaged })) {
    app.dock.setIcon(getIconPath());
    runtimeIconState.dockOverrideApplied = true;
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
  let icon = nativeImage.createFromPath(getTrayPath());
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
    runtimeIconState.trayTemplateImage = true;
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }
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
    const localExportPath = await resolveLocalExportPath(downloadUrl, app.getPath('userData'));
    if (currentWindow.isDestroyed()) return { success: false };
    const result = localExportPath
      ? await copyLocalExportToPath(localExportPath, savePath)
      : await downloadToPath({
          downloadSession: currentWindow.webContents.session,
          downloadUrl,
          savePath,
          currentWindow,
        });
    if (!result.success) {
      log.error('[main] Download failed:', { url: downloadUrl, savePath, ...result });
      if (!currentWindow.isDestroyed()) {
        const localizedError = {
          interrupted: '下载被中断，请重试。',
          timeout: '下载超时，请重试。',
          missing: '目标文件没有写入。',
          empty: '目标文件为空。',
          failed: '文件复制或下载失败。',
          cancelled: '下载已取消。',
        }[result.state];
        await dialog.showMessageBox(currentWindow, {
          type: 'error',
          title: '保存失败',
          message: '文件没有保存成功',
          detail: `${localizedError || result.error || '下载失败'}\n\n目标位置：${savePath}`,
        });
      }
    } else {
      log.info('[main] Download completed:', result.filePath);
    }
    return result;
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
