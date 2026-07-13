const fs = require('node:fs');
const path = require('node:path');

function isClientSideDownloadUrl(url) {
  return typeof url === 'string' && /^(data|blob):/i.test(url);
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

function matchesDownload(item, downloadUrl) {
  const itemUrl = item.getURL();
  const urlChain = typeof item.getURLChain === 'function' ? item.getURLChain() : [itemUrl];
  return urlChain.includes(downloadUrl)
    || (isClientSideDownloadUrl(downloadUrl) && itemUrl === downloadUrl);
}

function verifySavedFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) {
      return { success: false, state: 'empty', error: 'The saved file is missing or empty.' };
    }
    return { success: true, state: 'completed', filePath };
  } catch (error) {
    return { success: false, state: 'missing', error: `The saved file was not written: ${error.message}` };
  }
}

function resolveLocalExportPath(downloadUrl, userDataPath) {
  try {
    const parsedUrl = new URL(downloadUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsedUrl.hostname)) {
      return null;
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments.length !== 4 || segments[0] !== 'files' || segments[2] !== 'exports') {
      return null;
    }
    const [, projectId, , filename] = segments;
    if (
      !projectId
      || !filename
      || projectId === '.'
      || projectId === '..'
      || filename === '.'
      || filename === '..'
      || projectId.includes('/')
      || projectId.includes('\\')
      || filename.includes('/')
      || filename.includes('\\')
    ) {
      return null;
    }

    const uploadsRoot = path.resolve(userDataPath, 'uploads');
    const sourcePath = path.resolve(uploadsRoot, projectId, 'exports', filename);
    if (!sourcePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      return null;
    }
    return verifySavedFile(sourcePath).success ? sourcePath : null;
  } catch (error) {
    return null;
  }
}

async function copyLocalExportToPath(sourcePath, savePath) {
  try {
    if (path.resolve(sourcePath) !== path.resolve(savePath)) {
      await fs.promises.copyFile(sourcePath, savePath);
    }
    return verifySavedFile(savePath);
  } catch (error) {
    return { success: false, state: 'failed', error: `The export could not be copied: ${error.message}` };
  }
}

function downloadToPath({
  downloadSession,
  downloadUrl,
  savePath,
  currentWindow,
  timeoutMs = 300000,
}) {
  return new Promise((resolve) => {
    let activeItem = null;
    let cleanupTimer = null;
    let settled = false;

    const cleanup = () => {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      downloadSession.removeListener('will-download', listener);
      if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.removeListener('closed', handleWindowClosed);
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const handleWindowClosed = () => {
      activeItem?.cancel();
      finish({ success: false, state: 'cancelled', error: 'The app window was closed during download.' });
    };

    const listener = (_, item) => {
      if (!matchesDownload(item, downloadUrl)) {
        return;
      }

      activeItem = item;
      item.setSavePath(savePath);
      item.once('done', (_event, state) => {
        if (state !== 'completed') {
          finish({ success: false, state, error: `Download ${state}.` });
          return;
        }

        finish(verifySavedFile(savePath));
      });
    };

    downloadSession.on('will-download', listener);
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.once('closed', handleWindowClosed);
    }
    cleanupTimer = setTimeout(() => {
      activeItem?.cancel();
      finish({ success: false, state: 'timeout', error: 'Download did not finish within five minutes.' });
    }, timeoutMs);

    try {
      // Packaged builds load the UI from file:// and fetch exports from localhost.
      // Session.downloadURL avoids the page-origin checks applied by WebContents.
      downloadSession.downloadURL(downloadUrl);
    } catch (error) {
      finish({ success: false, state: 'failed', error: error.message });
    }
  });
}

module.exports = {
  copyLocalExportToPath,
  createUniqueDownloadUrl,
  downloadToPath,
  isClientSideDownloadUrl,
  matchesDownload,
  resolveLocalExportPath,
  verifySavedFile,
};
