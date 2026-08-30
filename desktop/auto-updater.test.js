const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { DesktopAutoUpdateManager, detectAutoUpdateSupport } = require('./auto-updater');

class FakeCancellationToken {
  constructor() {
    this.cancelled = false;
  }

  cancel() {
    this.cancelled = true;
  }
}

class FakeUpdater extends EventEmitter {
  constructor(updateInfo = null, isUpdateAvailable = Boolean(updateInfo)) {
    super();
    this.updateInfo = updateInfo;
    this.isUpdateAvailable = isUpdateAvailable;
    this.checkCalls = 0;
    this.downloadCalls = 0;
    this.quitAndInstallCalls = 0;
  }

  async checkForUpdates() {
    this.checkCalls += 1;
    this.emit('checking-for-update');
    if (this.updateInfo) {
      this.emit('update-available', this.updateInfo);
    } else {
      this.emit('update-not-available', { version: '1.0.0' });
    }
    return {
      updateInfo: this.updateInfo,
      isUpdateAvailable: this.isUpdateAvailable,
    };
  }

  async downloadUpdate() {
    this.downloadCalls += 1;
    this.emit('download-progress', {
      percent: 42.5,
      bytesPerSecond: 1024,
      transferred: 425,
      total: 1000,
    });
    this.emit('update-downloaded', this.updateInfo);
    return ['/tmp/update'];
  }

  quitAndInstall() {
    this.quitAndInstallCalls += 1;
  }
}

function createManager({ enabled = true, updateInfo = null, isUpdateAvailable = Boolean(updateInfo) } = {}) {
  const updater = new FakeUpdater(updateInfo, isUpdateAvailable);
  const persisted = [];
  const manager = new DesktopAutoUpdateManager({
    app: {
      getVersion: () => '1.0.0',
      getPath: () => '/tmp/banana-auto-update-tests',
      isPackaged: true,
    },
    updater,
    CancellationToken: FakeCancellationToken,
    logger: { info() {}, warn() {}, error() {} },
    readSettings: async () => ({ automaticUpdatesEnabled: enabled }),
    writeSettings: async (_userDataPath, settings) => {
      persisted.push(settings);
      return settings;
    },
    setTimeoutFn: () => ({ type: 'timeout' }),
    clearTimeoutFn: () => {},
    setIntervalFn: () => ({ type: 'interval' }),
    clearIntervalFn: () => {},
    canAutoUpdate: true,
  });
  return { manager, persisted, updater };
}

test('automatically downloads an available update when the preference is enabled', async () => {
  const { manager, updater } = createManager({
    updateInfo: {
      version: '1.1.0',
      releaseNotes: 'Automatic update test',
    },
  });
  const states = [];
  manager.subscribe((state) => states.push(state));
  await manager.initialize();

  await manager.checkForUpdates({ automatic: true });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(updater.checkCalls, 1);
  assert.equal(updater.downloadCalls, 1);
  assert.equal(manager.getState().status, 'update_downloaded');
  assert.equal(manager.shouldInstallOnQuit(), true);
  assert.ok(states.some((state) => state.status === 'downloading' && state.progress?.percent === 42.5));
});

test('does not automatically check or install when automatic updates are disabled', async () => {
  const { manager, updater } = createManager({
    enabled: false,
    updateInfo: { version: '1.1.0', releaseNotes: '' },
  });
  await manager.initialize();

  const state = await manager.checkForUpdates({ automatic: true });

  assert.equal(state.status, 'disabled');
  assert.equal(updater.checkCalls, 0);
  assert.equal(updater.downloadCalls, 0);
  assert.equal(manager.shouldInstallOnQuit(), false);
});

test('keeps manual update actions available while automatic updates are disabled', async () => {
  const { manager, updater } = createManager({
    enabled: false,
    updateInfo: { version: '1.1.0', releaseNotes: 'Manual update test' },
  });
  await manager.initialize();

  const checked = await manager.checkForUpdates();
  assert.equal(checked.status, 'update_available');
  assert.equal(updater.downloadCalls, 0);

  const downloaded = await manager.downloadUpdate();
  assert.equal(downloaded.status, 'update_downloaded');
  assert.equal(manager.shouldInstallOnQuit(), false);
  assert.equal(manager.quitAndInstall(), true);
  assert.equal(updater.quitAndInstallCalls, 1);
});

test('does not offer a release when electron-updater marks it unavailable', async () => {
  const { manager, updater } = createManager({
    updateInfo: { version: '1.1.0', releaseNotes: 'Staged rollout' },
    isUpdateAvailable: false,
  });
  await manager.initialize();

  const checked = await manager.checkForUpdates();

  assert.equal(checked.status, 'up_to_date');
  assert.equal(checked.update, null);
  assert.equal(updater.downloadCalls, 0);
});

test('persists the toggle and immediately schedules checks when re-enabled', async () => {
  const { manager, persisted } = createManager({ enabled: false });
  const scheduledDelays = [];
  manager.setTimeoutFn = (_callback, delay) => {
    scheduledDelays.push(delay);
    return { type: 'timeout' };
  };
  await manager.initialize();

  await manager.setAutomaticUpdatesEnabled(true);

  assert.deepEqual(persisted, [{ automaticUpdatesEnabled: true }]);
  assert.deepEqual(manager.getSettings(), { automaticUpdatesEnabled: true, canAutoUpdate: true });
  assert.deepEqual(scheduledDelays, [0]);
});

test('disables in-place macOS updates for ad hoc signed builds', () => {
  const supported = detectAutoUpdateSupport({
    app: { isPackaged: true },
    platform: 'darwin',
    execPath: '/Applications/Banana Slides.app/Contents/MacOS/Banana Slides',
    spawnSyncFn: () => ({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.banana.slides\nSignature=adhoc\nTeamIdentifier=not set\n',
    }),
  });

  assert.equal(supported, false);
});

test('enables in-place macOS updates when the app has a stable signature', () => {
  const supported = detectAutoUpdateSupport({
    app: { isPackaged: true },
    platform: 'darwin',
    execPath: '/Applications/Banana Slides.app/Contents/MacOS/Banana Slides',
    spawnSyncFn: () => ({
      status: 0,
      stdout: '',
      stderr: 'Identifier=com.banana.slides\nAuthority=Developer ID Application: Anionex\nTeamIdentifier=ABCDE12345\n',
    }),
  });

  assert.equal(supported, true);
});

test('supports automatic updates on packaged Windows and AppImage builds', () => {
  assert.equal(detectAutoUpdateSupport({
    app: { isPackaged: true },
    platform: 'win32',
    spawnSyncFn: () => { throw new Error('codesign should not be called'); },
  }), true);
  assert.equal(detectAutoUpdateSupport({
    app: { isPackaged: true },
    platform: 'linux',
    env: { APPIMAGE: '/opt/BananaSlides.AppImage' },
    spawnSyncFn: () => { throw new Error('codesign should not be called'); },
  }), true);
});

test('uses release notifications instead of in-place updates for Debian packages', () => {
  assert.equal(detectAutoUpdateSupport({
    app: { isPackaged: true },
    platform: 'linux',
    env: {},
    spawnSyncFn: () => { throw new Error('codesign should not be called'); },
  }), false);
});

test('uses safe defaults when update preferences cannot be read', async () => {
  const updater = new FakeUpdater();
  const warnings = [];
  const manager = new DesktopAutoUpdateManager({
    app: {
      getVersion: () => '1.0.0',
      getPath: () => '/read-only-user-data',
      isPackaged: true,
    },
    updater,
    CancellationToken: FakeCancellationToken,
    logger: { info() {}, warn: (...args) => warnings.push(args), error() {} },
    readSettings: async () => { throw new Error('permission denied'); },
    writeSettings: async (_userDataPath, settings) => settings,
    canAutoUpdate: true,
  });

  await manager.initialize();

  assert.deepEqual(manager.getSettings(), {
    automaticUpdatesEnabled: true,
    canAutoUpdate: true,
  });
  assert.equal(warnings.length, 1);
});
