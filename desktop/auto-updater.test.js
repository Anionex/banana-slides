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

function createManager({
  enabled = true,
  updateInfo = null,
  isUpdateAvailable = Boolean(updateInfo),
  currentVersion = '1.0.0',
  checkReleaseFallback = async () => ({
    status: 'up_to_date',
    currentVersion,
    latestVersion: currentVersion,
    update: null,
    progress: null,
    canAutoUpdate: false,
  }),
} = {}) {
  const updater = new FakeUpdater(updateInfo, isUpdateAvailable);
  const persisted = [];
  const manager = new DesktopAutoUpdateManager({
    app: {
      getVersion: () => currentVersion,
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
    checkReleaseFallback,
    setTimeoutFn: () => ({ type: 'timeout' }),
    clearTimeoutFn: () => {},
    setIntervalFn: () => ({ type: 'interval' }),
    clearIntervalFn: () => {},
    canAutoUpdate: true,
  });
  return { manager, persisted, updater };
}

test('automatic checks wait for the user before downloading an available update', async () => {
  const { manager, updater } = createManager({
    updateInfo: {
      version: '1.1.0',
      releaseNotes: 'Automatic update test',
    },
  });
  await manager.initialize();

  const state = await manager.checkForUpdates({ automatic: true });

  assert.equal(updater.checkCalls, 1);
  assert.equal(updater.downloadCalls, 0);
  assert.equal(state.status, 'update_available');
  assert.equal(state.checkSource, 'automatic');
  assert.equal(state.update.notes, 'Automatic update test');
  assert.equal(manager.shouldInstallOnQuit(), false);
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

test('ignores an in-flight automatic check after automatic updates are disabled', async () => {
  const { manager, updater } = createManager({
    updateInfo: { version: '1.1.0', releaseNotes: 'Late automatic result' },
  });
  let finishCheck;
  updater.checkForUpdates = async () => {
    updater.checkCalls += 1;
    updater.emit('checking-for-update');
    await new Promise((resolve) => {
      finishCheck = resolve;
    });
    updater.emit('update-available', updater.updateInfo);
    return {
      updateInfo: updater.updateInfo,
      isUpdateAvailable: true,
    };
  };
  await manager.initialize();

  const checking = manager.checkForUpdates({ automatic: true });
  await new Promise((resolve) => setImmediate(resolve));
  await manager.setAutomaticUpdatesEnabled(false);
  finishCheck();
  const state = await checking;

  assert.equal(updater.checkCalls, 1);
  assert.equal(state.status, 'disabled');
  assert.equal(state.automaticUpdatesEnabled, false);
  assert.equal(state.update, null);
  assert.equal(manager.getState().status, 'disabled');
});

test('runs a fresh check after re-enabling during an invalidated automatic check', async () => {
  const { manager, updater } = createManager({
    updateInfo: { version: '1.1.0', releaseNotes: 'Fresh automatic result' },
  });
  let finishFirstCheck;
  updater.checkForUpdates = async () => {
    updater.checkCalls += 1;
    updater.emit('checking-for-update');
    if (updater.checkCalls === 1) {
      await new Promise((resolve) => {
        finishFirstCheck = resolve;
      });
    }
    updater.emit('update-available', updater.updateInfo);
    return {
      updateInfo: updater.updateInfo,
      isUpdateAvailable: true,
    };
  };
  await manager.initialize();

  const staleCheck = manager.checkForUpdates({ automatic: true });
  await new Promise((resolve) => setImmediate(resolve));
  await manager.setAutomaticUpdatesEnabled(false);
  await manager.setAutomaticUpdatesEnabled(true);
  const freshCheck = manager.checkForUpdates({ automatic: true });
  finishFirstCheck();
  await staleCheck;
  const state = await freshCheck;

  assert.equal(updater.checkCalls, 2);
  assert.equal(state.status, 'update_available');
  assert.equal(state.automaticUpdatesEnabled, true);
  assert.equal(state.update.version, '1.1.0');
});

test('coalesces a manual request into an in-flight automatic check without an automatic prompt', async () => {
  const { manager, updater } = createManager({
    updateInfo: { version: '1.1.0', releaseNotes: 'One visible prompt' },
  });
  let finishCheck;
  updater.checkForUpdates = async () => {
    updater.checkCalls += 1;
    updater.emit('checking-for-update');
    await new Promise((resolve) => {
      finishCheck = resolve;
    });
    updater.emit('update-available', updater.updateInfo);
    return {
      updateInfo: updater.updateInfo,
      isUpdateAvailable: true,
    };
  };
  await manager.initialize();

  const automaticCheck = manager.checkForUpdates({ automatic: true });
  await new Promise((resolve) => setImmediate(resolve));
  const manualCheck = manager.checkForUpdates();
  finishCheck();
  const [automaticState, manualState] = await Promise.all([automaticCheck, manualCheck]);

  assert.equal(updater.checkCalls, 1);
  assert.equal(automaticState.checkSource, 'manual');
  assert.equal(manualState.checkSource, 'manual');
  assert.equal(manualState.status, 'update_available');
});

test('keeps manual update actions available while automatic updates are disabled', async () => {
  const { manager, updater } = createManager({
    enabled: false,
    updateInfo: { version: '1.1.0', releaseNotes: 'Manual update test' },
  });
  await manager.initialize();

  const checked = await manager.checkForUpdates();
  assert.equal(checked.status, 'update_available');
  assert.equal(checked.checkSource, 'manual');
  assert.equal(updater.downloadCalls, 0);

  const downloaded = await manager.downloadUpdate();
  assert.equal(downloaded.status, 'update_downloaded');
  assert.equal(manager.shouldInstallOnQuit(), true);
  assert.equal(manager.quitAndInstall(), true);
  assert.equal(updater.quitAndInstallCalls, 1);
});

test('preserves a downloaded update when a later check finds the same version', async () => {
  const { manager, updater } = createManager({
    updateInfo: { version: '1.1.0', releaseNotes: 'Ready to install' },
  });
  await manager.initialize();
  await manager.checkForUpdates();
  await manager.downloadUpdate();
  const checksBeforeRetry = updater.checkCalls;
  updater.checkForUpdates = async () => {
    throw new Error('offline');
  };

  const checkedAgain = await manager.checkForUpdates({ automatic: true });

  assert.equal(checkedAgain.status, 'update_downloaded');
  assert.equal(checkedAgain.update.version, '1.1.0');
  assert.equal(updater.checkCalls, checksBeforeRetry);
  assert.equal(updater.downloadCalls, 1);
  assert.equal(manager.shouldInstallOnQuit(), true);
});

test('uses the timestamp-aware release fallback when electron-updater sees the same version', async () => {
  let fallbackCalls = 0;
  const { manager, updater } = createManager({
    updateInfo: {
      version: '1.0.0',
      releaseNotes: 'Rebuilt release',
      releaseDate: '2026-08-30T00:00:00Z',
    },
    isUpdateAvailable: false,
    checkReleaseFallback: async () => {
      fallbackCalls += 1;
      return {
        status: 'update_available',
        currentVersion: '1.0.0',
        latestVersion: '1.0.0',
        update: {
          version: '1.0.0',
          notes: 'Rebuilt release',
          url: 'https://github.com/Anionex/banana-slides/releases/tag/v1.0.0',
        },
        progress: null,
        canAutoUpdate: false,
      };
    },
  });
  await manager.initialize();

  const state = await manager.checkForUpdates();

  assert.equal(updater.checkCalls, 1);
  assert.equal(fallbackCalls, 1);
  assert.equal(state.status, 'update_available');
  assert.equal(state.canAutoUpdate, false);
  assert.equal(state.update.version, '1.0.0');
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
