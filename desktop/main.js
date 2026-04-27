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
  if (app.isPackaged) {
    return path.join(process.resourcesPath, `icon.${ext}`);
  }
  return path.join(__dirname, 'resources', `icon.${ext}`);
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
    width: 1100,
    height: 750,
    minWidth: 680,
    minHeight: 480,
    show: false,
    frame: false,
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
    { label: '显示主窗口', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
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
      mainWindow.loadURL(`http://localhost:${process.env.FRONTEND_PORT || 3000}`);
    } else {
      mainWindow.loadFile(path.join(process.resourcesPath, 'frontend', 'index.html'));
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

app.on('before-quit', async () => {
  isQuitting = true;
  await pythonManager.stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On Windows/Linux, closing all windows doesn't quit (tray keeps running)
  }
});
