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

async function findAvailablePort(startPort) {
  let port = startPort;
  while (port <= 65535) {
    try {
      return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(port, () => {
          server.close(() => resolve(port));
        });
        server.on('error', reject);
      });
    } catch (err) {
      port++;
    }
  }
  throw new Error('No available port found');
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
    CORS_ORIGINS: '*',
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

  const isWin = process.platform === 'win32';
  return new Promise((resolve) => {
    const pid = backendProcess.pid;
    log.info(`[python-manager] Stopping backend (PID: ${pid})`);

    const forceKillTimer = setTimeout(() => {
      log.warn('[python-manager] Force killing backend');
      try {
        if (isWin) {
          spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
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
      if (isWin) {
        spawn('taskkill', ['/T', '/PID', String(pid)], { windowsHide: true });
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
