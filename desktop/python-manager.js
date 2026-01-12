const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const log = require('electron-log');
const getPort = require('get-port');

class PythonManager {
    constructor() {
        this.process = null;
        this.port = null;
        this.isRunning = false;
    }

    /**
     * 启动 Python 后端
     * @returns {Promise<number>} 后端端口号
     */
    async start() {
        // 1. 获取可用端口
        this.port = await getPort({ port: [5000, 5001, 5002, 5003, 5004, 5005] });
        log.info(`Found available port: ${this.port}`);

        // 2. 确定后端路径
        const backendPath = this.getBackendPath();
        log.info(`Backend path: ${backendPath}`);

        // 3. 准备环境变量
        const env = {
            ...process.env,
            PORT: this.port.toString(),
            DATABASE_PATH: this.getDatabasePath(),
            UPLOAD_FOLDER: this.getUploadFolder(),
            EXPORT_FOLDER: this.getExportFolder(),
            // 禁用调试模式
            FLASK_ENV: 'production',
            FLASK_DEBUG: '0'
        };

        // 4. 启动后端进程
        log.info('Spawning backend process...');
        this.process = spawn(backendPath, [], {
            env,
            cwd: this.getWorkingDir(),
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true // Windows 上隐藏控制台窗口
        });

        // 5. 处理进程输出
        this.process.stdout.on('data', (data) => {
            log.info(`[Backend] ${data.toString().trim()}`);
        });

        this.process.stderr.on('data', (data) => {
            log.error(`[Backend Error] ${data.toString().trim()}`);
        });

        this.process.on('error', (error) => {
            log.error('Backend process error:', error);
            this.isRunning = false;
        });

        this.process.on('exit', (code, signal) => {
            log.info(`Backend process exited with code ${code}, signal ${signal}`);
            this.isRunning = false;
        });

        // 6. 等待后端就绪
        await this.waitForReady();
        this.isRunning = true;

        return this.port;
    }

    /**
     * 等待后端服务就绪
     * 默认超时120秒（打包应用加载大量模块需要较长时间）
     */
    async waitForReady(maxRetries = 240, retryInterval = 500) {
        log.info('Waiting for backend to be ready...');

        for (let i = 0; i < maxRetries; i++) {
            try {
                log.info(`Health check attempt ${i + 1}/${maxRetries} on port ${this.port}...`);
                // 使用 127.0.0.1 而不是 localhost，因为后端只监听 IPv4，而 localhost 可能解析为 IPv6 (::1)
                const response = await axios.get(`http://127.0.0.1:${this.port}/health`, {
                    timeout: 2000
                });
                if (response.status === 200) {
                    log.info('Backend is ready!');
                    return;
                }
            } catch (error) {
                // 每10次输出一次错误信息
                if (i % 10 === 0) {
                    log.warn(`Health check failed (attempt ${i + 1}): ${error.message}`);
                }
            }
            await this.sleep(retryInterval);
        }

        throw new Error(`Backend failed to start after ${maxRetries * retryInterval / 1000} seconds`);
    }

    /**
     * 停止 Python 后端
     */
    async stop() {
        if (!this.process) {
            log.info('No backend process to stop');
            return;
        }

        log.info('Stopping backend process...');

        return new Promise((resolve) => {
            // 设置超时强制终止
            const forceKillTimeout = setTimeout(() => {
                log.warn('Force killing backend process...');
                this.process.kill('SIGKILL');
                resolve();
            }, 5000);

            this.process.on('exit', () => {
                clearTimeout(forceKillTimeout);
                log.info('Backend process stopped gracefully');
                resolve();
            });

            // 尝试优雅关闭
            if (process.platform === 'win32') {
                // Windows 上使用 taskkill
                spawn('taskkill', ['/pid', this.process.pid.toString(), '/f', '/t']);
            } else {
                this.process.kill('SIGTERM');
            }
        });
    }

    /**
     * 获取后端可执行文件路径
     */
    getBackendPath() {
        const isDev = process.argv.includes('--dev');
        // Windows 使用 .exe 后缀，macOS/Linux 无后缀
        const exeName = process.platform === 'win32' ? 'banana-backend.exe' : 'banana-backend';

        if (app.isPackaged) {
            // 打包后：resourcesPath/backend/banana-backend[.exe]
            return path.join(process.resourcesPath, 'backend', exeName);
        } else if (isDev) {
            // 开发模式：直接使用源码运行（需要单独启动后端）
            // 这里返回一个占位符，实际上开发时应该手动启动后端
            throw new Error('Development mode: Please start backend manually with "cd backend && uv run python app.py"');
        } else {
            // 本地构建测试
            return path.join(__dirname, 'backend', exeName);
        }
    }

    /**
     * 获取工作目录
     */
    getWorkingDir() {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'backend');
        }
        return path.join(__dirname, 'backend');
    }

    /**
     * 获取数据库路径
     */
    getDatabasePath() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'data', 'database.db');
    }

    /**
     * 获取上传文件夹路径
     */
    getUploadFolder() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'uploads');
    }

    /**
     * 获取导出文件夹路径
     */
    getExportFolder() {
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'exports');
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = PythonManager;
