const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  copyLocalExportToPath,
  downloadToPath,
  resolveLocalExportPath,
} = require('./download-manager');

class FakeDownloadItem extends EventEmitter {
  constructor(url, payload, terminalState = 'completed') {
    super();
    this.url = url;
    this.payload = payload;
    this.terminalState = terminalState;
    this.savePath = null;
  }

  getURL() {
    return this.url;
  }

  getURLChain() {
    return [this.url];
  }

  setSavePath(savePath) {
    this.savePath = savePath;
  }

  cancel() {
    this.emit('done', {}, 'cancelled');
  }

  complete() {
    if (this.terminalState === 'completed') {
      fs.writeFileSync(this.savePath, this.payload);
    }
    this.emit('done', {}, this.terminalState);
  }
}

class FakeDownloadSession extends EventEmitter {
  constructor(payload, terminalState = 'completed') {
    super();
    this.payload = payload;
    this.terminalState = terminalState;
    this.requestedUrl = null;
    this.listenerCountAfterMatch = null;
  }

  downloadURL(url) {
    this.requestedUrl = url;
    const item = new FakeDownloadItem(url, this.payload, this.terminalState);
    queueMicrotask(() => {
      this.emit('will-download', {}, item);
      this.listenerCountAfterMatch = this.listenerCount('will-download');
      queueMicrotask(() => item.complete());
    });
  }
}

test('waits for Session.downloadURL to write a non-empty file', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-download-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const savePath = path.join(tempDir, 'presentation.pptx');
  const downloadSession = new FakeDownloadSession(Buffer.from('pptx bytes'));

  const result = await downloadToPath({
    downloadSession,
    downloadUrl: 'http://127.0.0.1:15000/files/project/exports/presentation.pptx',
    savePath,
  });

  assert.equal(result.success, true);
  assert.equal(result.filePath, savePath);
  assert.equal(fs.readFileSync(savePath, 'utf8'), 'pptx bytes');
  assert.equal(downloadSession.requestedUrl, 'http://127.0.0.1:15000/files/project/exports/presentation.pptx');
  assert.equal(downloadSession.listenerCountAfterMatch, 0);
});

test('reports an interrupted download instead of claiming success', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-download-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const downloadSession = new FakeDownloadSession(Buffer.alloc(0), 'interrupted');

  const result = await downloadToPath({
    downloadSession,
    downloadUrl: 'http://127.0.0.1:15000/files/project/exports/presentation.pptx',
    savePath: path.join(tempDir, 'presentation.pptx'),
  });

  assert.deepEqual(result, {
    success: false,
    state: 'interrupted',
    error: 'Download interrupted.',
  });
});

test('does not touch window listeners after the Electron window is destroyed', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-download-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const downloadSession = new FakeDownloadSession(Buffer.from('pptx bytes'));
  const currentWindow = new EventEmitter();
  currentWindow.isDestroyed = () => true;
  currentWindow.once = () => {
    throw new Error('Object has been destroyed');
  };
  currentWindow.removeListener = () => {
    throw new Error('Object has been destroyed');
  };

  const result = await downloadToPath({
    downloadSession,
    downloadUrl: 'http://127.0.0.1:15000/files/project/exports/presentation.pptx',
    savePath: path.join(tempDir, 'presentation.pptx'),
    currentWindow,
  });

  assert.equal(result.success, true);
});

test('copies an existing desktop export directly to the selected path', async (t) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-user-data-'));
  t.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }));
  const exportDir = path.join(userDataPath, 'uploads', 'project-1', 'exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const sourcePath = path.join(exportDir, 'presentation.pptx');
  const savePath = path.join(userDataPath, 'selected', 'renamed.pptx');
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'real export bytes');

  const resolvedPath = await resolveLocalExportPath(
    'http://127.0.0.1:15000/files/project-1/exports/presentation.pptx?cache=1',
    userDataPath,
  );
  const result = await copyLocalExportToPath(resolvedPath, savePath);

  assert.equal(resolvedPath, sourcePath);
  assert.equal(result.success, true);
  assert.equal(fs.readFileSync(savePath, 'utf8'), 'real export bytes');
});

test('does not resolve traversal or non-local URLs as desktop exports', async () => {
  assert.equal(
    await resolveLocalExportPath(
      'http://127.0.0.1:15000/files/..%2Fsecret/exports/presentation.pptx',
      '/tmp/banana-user-data',
    ),
    null,
  );
  assert.equal(
    await resolveLocalExportPath(
      'https://example.com/files/project-1/exports/presentation.pptx',
      '/tmp/banana-user-data',
    ),
    null,
  );
});

test('packages the download manager with the desktop application', () => {
  const builderConfig = fs.readFileSync(path.join(__dirname, 'electron-builder.yml'), 'utf8');
  assert.match(builderConfig, /- "download-manager\.js"/);
});

test('rechecks the desktop window after resolving an export asynchronously', () => {
  const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.match(
    mainSource,
    /const localExportPath = await resolveLocalExportPath\([^;]+;\s+if \(currentWindow\.isDestroyed\(\)\) return \{ success: false \};\s+const result =/,
  );
});
