const { app, BrowserWindow, Tray, Menu, dialog, shell } = require("electron");
const path = require("path");
const log = require("electron-log");
const PythonManager = require("./python-manager");

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
    } catch (error) {
      log.error("Failed to start application:", error);
      dialog.showErrorBox(
        "启动失败",
        `应用启动失败: ${error.message}\n\n请检查日志文件获取详细信息。`
      );
      app.quit();
    }
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
