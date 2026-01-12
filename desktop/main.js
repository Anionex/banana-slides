const { app, BrowserWindow, Tray, Menu, dialog, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const log = require("electron-log");
const PythonManager = require("./python-manager");
const autoUpdater = require("./auto-updater");

// 配置日志
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("userData"), "logs", "main.log");
log.info("Application starting...");

class BananaApp {
  constructor() {
    this.mainWindow = null;
    this.pythonManager = new PythonManager();
    this.tray = null;
    this.isQuitting = false;
  }

  async init() {
    // 单实例锁定
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      log.info("Another instance is running, quitting...");
      app.quit();
      return;
    }

    app.on("second-instance", () => {
      // 检查窗口是否存在且未被销毁
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });

    app.on("ready", () => this.onReady());
    app.on("window-all-closed", () => this.onWindowAllClosed());
    app.on("before-quit", () => this.onBeforeQuit());
    app.on("activate", () => this.onActivate());
  }

  async onReady() {
    log.info("App is ready");

    try {
      // 显示启动画面
      this.showSplash();

      // 启动 Python 后端
      log.info("Starting Python backend...");
      const backendPort = await this.pythonManager.start();
      log.info(`Backend started on port ${backendPort}`);

      // 关闭启动画面，创建主窗口
      if (this.splashWindow) {
        this.splashWindow.close();
        this.splashWindow = null;
      }

      this.createMainWindow(backendPort);
      this.createTray();
      this.setupIpcHandlers(backendPort);
    } catch (error) {
      log.error("Failed to start application:", error);
      dialog.showErrorBox(
        "启动失败",
        `应用启动失败: ${error.message}\n\n请检查日志文件获取详细信息。`
      );
      app.quit();
    }
  }

  /**
   * 设置 IPC 处理器
   */
  setupIpcHandlers(backendPort) {
    // 下载文件处理器
    ipcMain.handle('download-file', async (event, { url, filename }) => {
      log.info(`[Download] Downloading file: ${url}`);

      try {
        // 弹出保存对话框
        const result = await dialog.showSaveDialog(this.mainWindow, {
          defaultPath: filename || 'download',
          filters: [
            { name: '所有文件', extensions: ['*'] },
            { name: 'PowerPoint', extensions: ['pptx'] },
            { name: 'PDF', extensions: ['pdf'] },
          ]
        });

        if (result.canceled || !result.filePath) {
          log.info('[Download] User canceled save dialog');
          return { success: false, canceled: true };
        }

        const savePath = result.filePath;
        log.info(`[Download] Saving to: ${savePath}`);

        // 如果 URL 是相对路径，转换为绝对路径
        let fullUrl = url;
        if (url.startsWith('/')) {
          fullUrl = `http://127.0.0.1:${backendPort}${url}`;
        }

        // 下载文件
        await this.downloadToFile(fullUrl, savePath);

        log.info(`[Download] File saved successfully: ${savePath}`);

        // 可选：打开文件所在目录
        shell.showItemInFolder(savePath);

        return { success: true, path: savePath };
      } catch (error) {
        log.error('[Download] Error:', error);
        return { success: false, error: error.message };
      }
    });

    // 获取后端端口
    ipcMain.handle('get-backend-port', () => backendPort);

    // 获取应用版本
    ipcMain.handle('get-app-version', () => {
      const packageJson = require('./package.json');
      return packageJson.version;
    });

    // 检查更新
    ipcMain.handle('check-for-updates', async () => {
      const packageJson = require('./package.json');
      const currentVersion = packageJson.version;
      return await autoUpdater.checkForUpdates(currentVersion);
    });

    // 打开下载页面
    ipcMain.handle('open-download-page', (event, url) => {
      return autoUpdater.openDownloadPage(url);
    });

    // 打开 GitHub Releases 页面
    ipcMain.handle('open-releases-page', () => {
      autoUpdater.openReleasesPage();
      return true;
    });
  }

  /**
   * 下载文件到指定路径
   */
  downloadToFile(url, filePath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filePath);

      protocol.get(url, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(filePath);
          return this.downloadToFile(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filePath);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(filePath, () => { }); // 删除不完整的文件
        reject(err);
      });
    });
  }

  showSplash() {
    this.splashWindow = new BrowserWindow({
      width: 400,
      height: 300,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 加载启动画面 HTML
    this.splashWindow.loadFile(path.join(__dirname, "splash.html"));
    this.splashWindow.center();
  }

  createMainWindow(backendPort) {
    const isDev = process.argv.includes("--dev");

    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      show: false, // 准备好后再显示
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: !isDev, // 开发模式下禁用 web security
      },
      icon: path.join(__dirname, "resources", "icon.ico"),
      title: "Banana Slides 🍌",
      backgroundColor: "#1a1a2e",
    });

    // 注入后端端口到环境

    if (isDev) {
      // 开发模式：连接到 Vite dev server
      this.mainWindow.loadURL(`http://localhost:3000?backendPort=${backendPort}`);
      this.mainWindow.webContents.openDevTools();
    } else if (app.isPackaged) {
      // 生产模式（已打包）：加载 extraResources 中的前端文件
      const frontendPath = path.join(process.resourcesPath, "frontend", "index.html");
      log.info(`Loading frontend from: ${frontendPath}`);
      this.mainWindow.loadFile(frontendPath, {
        query: { backendPort: backendPort.toString() },
      });
    } else {
      // 本地构建测试模式：使用 __dirname
      const frontendPath = path.join(__dirname, "frontend", "index.html");
      log.info(`Loading frontend from: ${frontendPath}`);
      this.mainWindow.loadFile(frontendPath, {
        query: { backendPort: backendPort.toString() },
      });
    }

    // 窗口准备好后显示
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    // 设置中文应用菜单
    this.setupApplicationMenu();

    // 处理外部链接
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    // 窗口关闭时：直接完全退出应用（杀掉所有进程）
    this.mainWindow.on("close", (event) => {
      if (!this.isQuitting) {
        this.isQuitting = true;
        log.info("Window closing, quitting application...");

        // 先停止后端进程
        this.pythonManager.stop().then(() => {
          log.info("Backend stopped, quitting app");
          app.quit();
        }).catch((err) => {
          log.error("Error stopping backend:", err);
          app.quit();
        });

        // 暂时阻止关闭，等后端停止后再退出
        event.preventDefault();

        // 设置超时强制退出（防止后端停止失败导致卡住）
        setTimeout(() => {
          log.warn("Force quitting after timeout");
          app.exit(0);
        }, 5000);
      }
    });

    log.info("Main window created");
  }

  /**
   * 设置中文应用菜单
   */
  setupApplicationMenu() {
    const isMac = process.platform === 'darwin';

    const template = [
      // macOS 应用菜单
      ...(isMac ? [{
        label: app.name,
        submenu: [
          { label: '关于 Banana Slides', role: 'about' },
          { type: 'separator' },
          {
            label: '偏好设置...', accelerator: 'Cmd+,', click: () => {
              this.mainWindow.webContents.send('navigate', '/settings');
            }
          },
          { type: 'separator' },
          { label: '隐藏 Banana Slides', role: 'hide' },
          { label: '隐藏其他', role: 'hideOthers' },
          { label: '显示全部', role: 'unhide' },
          { type: 'separator' },
          { label: '退出 Banana Slides', role: 'quit' }
        ]
      }] : []),

      // 文件菜单
      {
        label: '文件',
        submenu: [
          {
            label: '新建项目', accelerator: 'CmdOrCtrl+N', click: () => {
              this.mainWindow.webContents.send('navigate', '/');
            }
          },
          {
            label: '历史项目', accelerator: 'CmdOrCtrl+H', click: () => {
              this.mainWindow.webContents.send('navigate', '/history');
            }
          },
          { type: 'separator' },
          isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit' }
        ]
      },

      // 编辑菜单
      {
        label: '编辑',
        submenu: [
          { label: '撤销', role: 'undo' },
          { label: '重做', role: 'redo' },
          { type: 'separator' },
          { label: '剪切', role: 'cut' },
          { label: '复制', role: 'copy' },
          { label: '粘贴', role: 'paste' },
          ...(isMac ? [
            { label: '粘贴并匹配样式', role: 'pasteAndMatchStyle' },
            { label: '删除', role: 'delete' },
            { label: '全选', role: 'selectAll' },
          ] : [
            { label: '删除', role: 'delete' },
            { type: 'separator' },
            { label: '全选', role: 'selectAll' }
          ])
        ]
      },

      // 视图菜单
      {
        label: '视图',
        submenu: [
          { label: '重新加载', role: 'reload' },
          { label: '强制重新加载', role: 'forceReload' },
          { label: '开发者工具', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: '实际大小', role: 'resetZoom' },
          { label: '放大', role: 'zoomIn' },
          { label: '缩小', role: 'zoomOut' },
          { type: 'separator' },
          { label: '全屏', role: 'togglefullscreen' }
        ]
      },

      // 窗口菜单
      {
        label: '窗口',
        submenu: [
          { label: '最小化', role: 'minimize' },
          { label: '缩放', role: 'zoom' },
          ...(isMac ? [
            { type: 'separator' },
            { label: '前置所有窗口', role: 'front' },
          ] : [
            { label: '关闭', role: 'close' }
          ])
        ]
      },

      // 帮助菜单
      {
        label: '帮助',
        submenu: [
          {
            label: '访问 GitHub', click: () => {
              shell.openExternal('https://github.com/zhizinan1997/banana-slides');
            }
          },
          {
            label: '报告问题', click: () => {
              shell.openExternal('https://github.com/zhizinan1997/banana-slides/issues');
            }
          },
          { type: 'separator' },
          {
            label: '检查更新...', click: () => {
              this.mainWindow.webContents.send('check-for-updates');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  createTray() {
    // 在打包模式下，图标嵌入在 app.asar 外部的固定位置
    let iconPath;
    if (app.isPackaged) {
      // 尝试使用安装目录中的图标
      iconPath = path.join(path.dirname(process.execPath), "resources", "icon.ico");
      // 如果不存在，回退到应用图标
      if (!require('fs').existsSync(iconPath)) {
        log.warn(`Tray icon not found at ${iconPath}, skipping tray creation`);
        return; // 跳过托盘创建
      }
    } else {
      iconPath = path.join(__dirname, "resources", "icon.ico");
    }
    log.info(`Creating tray with icon: ${iconPath}`);
    this.tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "显示窗口",
        click: () => {
          this.mainWindow.show();
          this.mainWindow.focus();
        },
      },
      {
        label: "打开日志目录",
        click: () => {
          shell.openPath(path.join(app.getPath("userData"), "logs"));
        },
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          this.isQuitting = true;
          app.quit();
        },
      },
    ]);

    this.tray.setToolTip("Banana Slides 🍌");
    this.tray.setContextMenu(contextMenu);

    this.tray.on("double-click", () => {
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    log.info("System tray created");
  }

  onWindowAllClosed() {
    // macOS 上保持应用运行
    if (process.platform !== "darwin") {
      // Windows/Linux: 全部窗口关闭不退出，由托盘管理
    }
  }

  async onBeforeQuit() {
    log.info("Application quitting...");
    this.isQuitting = true;

    // 停止 Python 后端
    try {
      await this.pythonManager.stop();
      log.info("Python backend stopped");
    } catch (error) {
      log.error("Error stopping Python backend:", error);
    }
  }

  onActivate() {
    // macOS 点击 dock 图标时
    if (this.mainWindow === null) {
      // 重新创建窗口需要重新获取端口
    } else {
      this.mainWindow.show();
    }
  }
}

// 启动应用
const bananaApp = new BananaApp();
bananaApp.init();
