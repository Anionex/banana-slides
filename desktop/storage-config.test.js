const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  INSTALLER_FILENAME,
  consumeInstallerDataRoot,
  createAndInspectDataRoot,
  getConfigPath,
  initializeDataRoot,
  inspectDataRoot,
  normalizeDataRoot,
  prepareDataRoot,
  readStorageConfig,
  writeStorageConfig,
} = require('./storage-config');

const desktopRoot = __dirname;

function makeTempDir(t, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('uses Electron userData as the data root when no config exists', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const info = await initializeDataRoot(userData);

  assert.equal(info.dataRoot, userData);
  assert.equal(info.isDefault, true);
  assert.equal(info.writable, true);
  assert.equal(await readStorageConfig(userData), null);
});

test('creates a missing default Electron userData directory on first launch', async (t) => {
  const parent = makeTempDir(t, 'banana-parent-');
  const userData = path.join(parent, 'new-user-data');

  const info = await initializeDataRoot(userData);

  assert.equal(info.dataRoot, userData);
  assert.equal(info.isDefault, true);
  assert.equal(info.writable, true);
  assert.equal(fs.existsSync(userData), true);
  assert.equal(await readStorageConfig(userData), null);
});

test('atomically saves and reads a Unicode data root', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const dataRoot = path.join(makeTempDir(t, 'banana-parent-'), '幻灯片 Data');

  await writeStorageConfig(userData, dataRoot);

  assert.deepEqual(await readStorageConfig(userData), { version: 1, dataRoot });
  const config = JSON.parse(fs.readFileSync(getConfigPath(userData), 'utf8'));
  assert.deepEqual(config, { version: 1, dataRoot });
  assert.deepEqual(
    fs.readdirSync(userData).filter((name) => name.includes('.tmp')),
    [],
  );
});

test('normalizes trailing separators without changing filesystem roots', () => {
  assert.equal(normalizeDataRoot('/tmp/banana-slides///'), '/tmp/banana-slides');
  assert.equal(normalizeDataRoot('/', 'linux'), '/');
  assert.equal(normalizeDataRoot('C:\\Banana Slides Data\\', 'win32'), 'C:\\Banana Slides Data');
  assert.equal(normalizeDataRoot('C:\\', 'win32'), 'C:\\');
});

for (const encoding of ['utf8', 'utf16le']) {
  test(`consumes a ${encoding} installer path only once`, async (t) => {
    const userData = makeTempDir(t, 'banana-user-data-');
    const dataRoot = path.join(makeTempDir(t, 'banana-parent-'), `installed ${encoding}`);
    const installerPath = path.join(userData, INSTALLER_FILENAME);
    const value = encoding === 'utf16le' ? `\uFEFF${dataRoot}\r\n` : `${dataRoot}\n`;
    fs.writeFileSync(installerPath, value, encoding);

    const config = await consumeInstallerDataRoot(userData);

    assert.equal(config.dataRoot, dataRoot);
    assert.equal(fs.existsSync(installerPath), false);
    assert.equal((await consumeInstallerDataRoot(userData)).dataRoot, dataRoot);
  });
}

test('starts from the saved installer config when the handoff file is temporarily locked', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const dataRoot = path.join(makeTempDir(t, 'banana-parent-'), 'installed locked');
  const installerPath = path.join(userData, INSTALLER_FILENAME);
  fs.writeFileSync(installerPath, dataRoot, 'utf8');

  const originalRm = fs.promises.rm;
  fs.promises.rm = async (target, options) => {
    if (target === installerPath) {
      const error = new Error('file is temporarily locked');
      error.code = 'EPERM';
      throw error;
    }
    return originalRm(target, options);
  };
  t.after(() => {
    fs.promises.rm = originalRm;
  });

  const config = await consumeInstallerDataRoot(userData);

  assert.equal(config.dataRoot, dataRoot);
  assert.equal(fs.existsSync(installerPath), true);
  assert.deepEqual(await readStorageConfig(userData), { version: 1, dataRoot });
  assert.equal((await consumeInstallerDataRoot(userData)).dataRoot, dataRoot);
});

test('an existing config takes precedence over an installer handoff', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const configuredRoot = path.join(makeTempDir(t, 'banana-parent-'), 'configured');
  const installerRoot = path.join(makeTempDir(t, 'banana-parent-'), 'installer');
  await writeStorageConfig(userData, configuredRoot);
  fs.writeFileSync(path.join(userData, INSTALLER_FILENAME), installerRoot, 'utf8');

  const config = await consumeInstallerDataRoot(userData);

  assert.equal(config.dataRoot, configuredRoot);
  assert.equal(fs.existsSync(path.join(userData, INSTALLER_FILENAME)), true);
});

test('inspect does not create a missing selected data directory', async (t) => {
  const parent = makeTempDir(t, 'banana-parent-');
  const dataRoot = path.join(parent, 'new data root');

  const first = await inspectDataRoot(dataRoot);
  assert.deepEqual(first, {
    dataRoot,
    exists: false,
    writable: false,
    hasDatabase: false,
    isEmpty: true,
  });
  assert.equal(fs.existsSync(dataRoot), false);
});

test('creates and write-tests a data directory only after initialization is confirmed', async (t) => {
  const parent = makeTempDir(t, 'banana-parent-');
  const dataRoot = path.join(parent, 'confirmed data root');

  const first = await createAndInspectDataRoot(dataRoot);
  assert.equal(first.exists, true);
  assert.equal(first.writable, true);
  assert.equal(first.hasDatabase, false);
  assert.equal(fs.existsSync(dataRoot), true);

  fs.mkdirSync(path.join(dataRoot, 'data'));
  fs.writeFileSync(path.join(dataRoot, 'data', 'database.db'), 'sqlite');
  const second = await inspectDataRoot(dataRoot);
  assert.equal(second.exists, true);
  assert.equal(second.hasDatabase, true);
  assert.equal(second.isEmpty, false);
});

test('cleans up the write probe when writing reports a late failure', async (t) => {
  const dataRoot = makeTempDir(t, 'banana-data-root-');
  const originalWriteFile = fs.promises.writeFile;
  fs.promises.writeFile = async (target, ...args) => {
    const result = await originalWriteFile(target, ...args);
    if (path.basename(target).startsWith('.banana-slides-write-test-')) {
      const error = new Error('simulated late write failure');
      error.code = 'EIO';
      throw error;
    }
    return result;
  };
  t.after(() => {
    fs.promises.writeFile = originalWriteFile;
  });

  await assert.rejects(inspectDataRoot(dataRoot), { code: 'DATA_ROOT_UNAVAILABLE' });
  assert.deepEqual(
    fs.readdirSync(dataRoot).filter((name) => name.startsWith('.banana-slides-write-test-')),
    [],
  );
});

test('does not reject a writable directory when write-probe cleanup is temporarily locked', async (t) => {
  const dataRoot = makeTempDir(t, 'banana-data-root-');
  const originalRm = fs.promises.rm;
  fs.promises.rm = async (target, options) => {
    if (path.basename(target).startsWith('.banana-slides-write-test-')) {
      await originalRm(target, options);
      const error = new Error('simulated antivirus file lock');
      error.code = 'EPERM';
      throw error;
    }
    return originalRm(target, options);
  };
  t.after(() => {
    fs.promises.rm = originalRm;
  });

  const inspection = await inspectDataRoot(dataRoot);
  assert.equal(inspection.writable, true);
  assert.equal(inspection.isEmpty, true);
});

test('preparation rejects an unconfirmed missing location before creating it', async (t) => {
  const parent = makeTempDir(t, 'banana-parent-');
  const dataRoot = path.join(parent, 'not confirmed');

  await assert.rejects(prepareDataRoot(dataRoot, false), {
    code: 'EMPTY_DATA_LOCATION',
  });
  assert.equal(fs.existsSync(dataRoot), false);
});

test('preparation creates a missing location after initialization is confirmed', async (t) => {
  const parent = makeTempDir(t, 'banana-parent-');
  const dataRoot = path.join(parent, 'confirmed');

  const inspection = await prepareDataRoot(dataRoot, true);

  assert.equal(inspection.exists, true);
  assert.equal(inspection.writable, true);
  assert.equal(fs.existsSync(dataRoot), true);
});

test('startup rejects and does not create a missing configured data root', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const parent = makeTempDir(t, 'banana-parent-');
  const missingRoot = path.join(parent, 'disconnected-volume', 'Banana Slides Data');
  await writeStorageConfig(userData, missingRoot);

  await assert.rejects(initializeDataRoot(userData), {
    code: 'DATA_ROOT_UNAVAILABLE',
  });
  assert.equal(fs.existsSync(path.join(parent, 'disconnected-volume')), false);
});

test('rejects relative and non-directory paths with stable error codes', async (t) => {
  assert.throws(() => normalizeDataRoot('relative/path'), { code: 'INVALID_DATA_ROOT' });
  assert.throws(
    () => normalizeDataRoot('\\\\server\\share\\Banana Slides', 'win32'),
    { code: 'NETWORK_DATA_ROOT_UNSUPPORTED' },
  );

  const parent = makeTempDir(t, 'banana-parent-');
  const filePath = path.join(parent, 'not-a-directory');
  fs.writeFileSync(filePath, 'content');
  await assert.rejects(inspectDataRoot(filePath), {
    code: 'DATA_ROOT_UNAVAILABLE',
    message: `The selected location is not a directory: ${filePath}`,
  });
});

test('does not silently fall back when configured storage is unavailable', async (t) => {
  const userData = makeTempDir(t, 'banana-user-data-');
  const parent = makeTempDir(t, 'banana-parent-');
  const filePath = path.join(parent, 'not-a-directory');
  fs.writeFileSync(filePath, 'content');
  await writeStorageConfig(userData, filePath);

  await assert.rejects(initializeDataRoot(userData), {
    code: 'DATA_ROOT_UNAVAILABLE',
  });
});

test('packaged smoke tests set Electron userData explicitly before app readiness', () => {
  const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.js'), 'utf8');
  const macSmoke = fs.readFileSync(path.join(desktopRoot, 'scripts', 'smoke-macos-dmg.sh'), 'utf8');
  const linuxSmoke = fs.readFileSync(path.join(desktopRoot, 'scripts', 'smoke-linux-appimage.sh'), 'utf8');

  assert.match(mainSource, /BANANA_DESKTOP_SMOKE_USER_DATA_DIR/);
  assert.match(mainSource, /app\.setPath\('userData', resolvedPath\)/);
  assert.match(mainSource, /configureSmokeUserDataPath\(\);\s*app\.whenReady\(\)/);
  assert.match(
    mainSource,
    /setTimeout\(async \(\) =>[\s\S]*mainWindow\.hide\(\)[\s\S]*await pythonManager\.stopBackend\(\)[\s\S]*app\.relaunch\(\)[\s\S]*app\.exit\(0\)/,
  );
  assert.match(mainSource, /let skipErrorDialog = false;[\s\S]*if \(!skipErrorDialog\)[\s\S]*skipErrorDialog = true;[\s\S]*continue;/);
  assert.match(mainSource, /splashWindow && !splashWindow\.isDestroyed\(\) \? splashWindow : null/);
  assert.match(macSmoke, /BANANA_DESKTOP_SMOKE_USER_DATA_DIR="\$user_data_dir"/);
  assert.match(linuxSmoke, /BANANA_DESKTOP_SMOKE_USER_DATA_DIR="\$user_data_dir"/);
});
