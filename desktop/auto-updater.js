const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  fetchGitHubJson,
  fetchGitHubReleases,
} = require('./github-release-client');
const {
  isVersionLess,
  normalizeReleaseVersion,
  resolveCurrentBuildTimestamp,
  selectLatestDesktopRelease,
  shouldNotifyUpdate,
} = require('./update-policy');
const {
  readUpdateSettings,
  writeUpdateSettings,
} = require('./update-settings');

const REPO_OWNER = 'Anionex';
const REPO_NAME = 'banana-slides';
const BUILD_META_PATH = path.join(__dirname, 'build-meta.json');
const DEFAULT_INITIAL_CHECK_DELAY_MS = 5000;
const DEFAULT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function readBuildMeta(logger = console) {
  try {
    if (!fs.existsSync(BUILD_META_PATH)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(BUILD_META_PATH, 'utf8'));
  } catch (error) {
    logger.warn('[auto-updater] Failed to read build metadata:', error.message);
    return null;
  }
}

function extractReleaseTimestamp(commitData, releaseData) {
  const commitDate = commitData?.commit?.committer?.date || commitData?.commit?.author?.date;
  if (commitDate) {
    const timestamp = Math.floor(Date.parse(commitDate) / 1000);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  if (releaseData?.published_at) {
    const timestamp = Math.floor(Date.parse(releaseData.published_at) / 1000);
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return null;
}

function releaseNotesToText(releaseNotes) {
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (!Array.isArray(releaseNotes)) return '';
  return releaseNotes
    .map((entry) => entry?.note || '')
    .filter(Boolean)
    .join('\n\n');
}

function createReleaseUrl(version) {
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/v${version}`;
}

function updateInfoToPublicUpdate(updateInfo) {
  const version = normalizeReleaseVersion(updateInfo?.version);
  if (!version) return null;
  return {
    version,
    notes: releaseNotesToText(updateInfo.releaseNotes),
    url: createReleaseUrl(version),
  };
}

function detectAutoUpdateSupport({
  app,
  platform = process.platform,
  execPath = process.execPath,
  env = process.env,
  spawnSyncFn = spawnSync,
}) {
  if (!app.isPackaged) return false;
  if (platform === 'linux') return Boolean(env.APPIMAGE);
  if (platform !== 'darwin') return true;

  const appBundlePath = path.resolve(execPath, '..', '..', '..');
  const result = spawnSyncFn('codesign', ['-d', '--verbose=4', appBundlePath], {
    encoding: 'utf8',
  });
  const signatureInfo = `${result.stdout || ''}\n${result.stderr || ''}`;
  return result.status === 0 && !signatureInfo.includes('Signature=adhoc');
}

async function checkGitHubReleaseFallback({ app, logger = console }) {
  let releases;
  try {
    releases = await fetchGitHubReleases(
      REPO_OWNER,
      REPO_NAME,
      { userAgent: `BananaSlides/${app.getVersion()}` },
    );
  } catch (error) {
    logger.warn('[auto-updater] Failed to fetch releases:', error.message);
    throw error;
  }
  const currentVersion = app.getVersion();
  const release = selectLatestDesktopRelease(releases, currentVersion, process.platform, process.arch);
  if (!release) {
    return {
      status: 'up_to_date',
      currentVersion,
      latestVersion: currentVersion,
      update: null,
      progress: null,
      canAutoUpdate: false,
    };
  }

  const latestVersion = normalizeReleaseVersion(release.tag_name);
  if (!latestVersion) {
    throw new Error(`GitHub release has an invalid version tag: ${release.tag_name}`);
  }
  const buildMeta = readBuildMeta(logger);
  const currentBuildTimestamp = resolveCurrentBuildTimestamp(buildMeta);
  if (shouldNotifyUpdate({ currentVersion, latestVersion })) {
    return {
      status: 'update_available',
      currentVersion,
      latestVersion,
      update: {
        version: latestVersion,
        notes: release.body || '',
        url: release.html_url,
      },
      progress: null,
      canAutoUpdate: false,
    };
  }

  if (isVersionLess(latestVersion, currentVersion)) {
    return {
      status: 'up_to_date',
      currentVersion,
      latestVersion,
      update: null,
      progress: null,
      canAutoUpdate: false,
    };
  }

  let releaseCommit;
  try {
    releaseCommit = await fetchGitHubJson(
      `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${encodeURIComponent(release.tag_name)}`,
      { userAgent: `BananaSlides/${app.getVersion()}` },
    );
  } catch (error) {
    logger.warn('[auto-updater] Failed to fetch release commit:', error.message);
    releaseCommit = null;
  }
  const latestReleaseTimestamp = extractReleaseTimestamp(releaseCommit, release);

  if (shouldNotifyUpdate({ currentVersion, latestVersion, currentBuildTimestamp, latestReleaseTimestamp })) {
    return {
      status: 'update_available',
      currentVersion,
      latestVersion,
      update: {
        version: latestVersion,
        notes: release.body || '',
        url: release.html_url,
      },
      progress: null,
      canAutoUpdate: false,
    };
  }

  return {
    status: 'up_to_date',
    currentVersion,
    latestVersion,
    update: null,
    progress: null,
    canAutoUpdate: false,
  };
}

class DesktopAutoUpdateManager {
  constructor({
    app,
    updater,
    CancellationToken,
    logger = console,
    readSettings = readUpdateSettings,
    writeSettings = writeUpdateSettings,
    checkReleaseFallback = checkGitHubReleaseFallback,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    canAutoUpdate = app.isPackaged === true,
  }) {
    this.app = app;
    this.updater = updater;
    this.CancellationToken = CancellationToken;
    this.logger = logger;
    this.readSettings = readSettings;
    this.writeSettings = writeSettings;
    this.checkReleaseFallback = checkReleaseFallback;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.canAutoUpdate = canAutoUpdate;
    this.listeners = new Set();
    this.checkPromise = null;
    this.activeCheck = null;
    this.automaticCheckGeneration = 0;
    this.downloadPromise = null;
    this.downloadCancellationToken = null;
    this.downloadWasAutomatic = false;
    this.initialCheckTimer = null;
    this.periodicCheckTimer = null;
    this.initialized = false;
    this.settings = { automaticUpdatesEnabled: true };
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      update: null,
      progress: null,
      error: null,
      canAutoUpdate: this.canAutoUpdate,
      automaticUpdatesEnabled: true,
      checkSource: null,
    };
  }

  async initialize() {
    if (this.initialized) return this.getState();
    try {
      this.settings = await this.readSettings(this.app.getPath('userData'));
    } catch (error) {
      this.logger.warn('[auto-updater] Failed to read update preferences, using defaults:', error.message);
      this.settings = { automaticUpdatesEnabled: true };
    }
    this.state.automaticUpdatesEnabled = this.settings.automaticUpdatesEnabled;
    this.updater.logger = this.logger;
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.autoRunAppAfterInstall = true;
    this._bindUpdaterEvents();
    this.initialized = true;
    if (!this.settings.automaticUpdatesEnabled) {
      this._setState({ status: 'disabled' });
    }
    return this.getState();
  }

  _bindUpdaterEvents() {
    this.updater.on('checking-for-update', () => {
      if (this._shouldIgnoreUpdaterCheckEvent()) return;
      this._setState({ status: 'checking', error: null, progress: null });
    });
    this.updater.on('update-available', (info) => {
      if (this._shouldIgnoreUpdaterCheckEvent()) return;
      const update = updateInfoToPublicUpdate(info);
      this._setState({
        status: 'update_available',
        latestVersion: update?.version || this.state.latestVersion,
        update,
        progress: null,
        error: null,
      });
    });
    this.updater.on('update-not-available', (info) => {
      if (this._shouldIgnoreUpdaterCheckEvent()) return;
      const latestVersion = normalizeReleaseVersion(info?.version) || this.app.getVersion();
      this._setState({
        status: 'up_to_date',
        latestVersion,
        update: null,
        progress: null,
        error: null,
      });
    });
    this.updater.on('download-progress', (progress) => {
      this._setState({
        status: 'downloading',
        progress: {
          percent: Number.isFinite(progress?.percent) ? progress.percent : 0,
          bytesPerSecond: Number.isFinite(progress?.bytesPerSecond) ? progress.bytesPerSecond : 0,
          transferred: Number.isFinite(progress?.transferred) ? progress.transferred : 0,
          total: Number.isFinite(progress?.total) ? progress.total : 0,
        },
        error: null,
      });
    });
    this.updater.on('update-downloaded', (info) => {
      const update = updateInfoToPublicUpdate(info) || this.state.update;
      this.downloadCancellationToken = null;
      this.downloadWasAutomatic = false;
      this._setState({
        status: 'update_downloaded',
        latestVersion: update?.version || this.state.latestVersion,
        update,
        progress: this.state.progress,
        error: null,
      });
    });
    this.updater.on('error', (error) => {
      if (error?.name === 'CancellationError') return;
      if (this._shouldIgnoreUpdaterCheckEvent()) return;
      this._setState({
        status: 'error',
        error: error?.message || String(error),
        progress: null,
      });
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      automaticUpdatesEnabled: this.settings.automaticUpdatesEnabled,
    };
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  getState() {
    return {
      ...this.state,
      update: this.state.update ? { ...this.state.update } : null,
      progress: this.state.progress ? { ...this.state.progress } : null,
    };
  }

  getSettings() {
    return { ...this.settings, canAutoUpdate: this.canAutoUpdate };
  }

  _isCheckCurrent(check) {
    return !check.automatic || (
      this.settings.automaticUpdatesEnabled
      && check.generation === this.automaticCheckGeneration
    );
  }

  _shouldIgnoreUpdaterCheckEvent() {
    return Boolean(this.activeCheck && !this._isCheckCurrent(this.activeCheck));
  }

  async setAutomaticUpdatesEnabled(enabled) {
    this.settings = await this.writeSettings(this.app.getPath('userData'), {
      automaticUpdatesEnabled: enabled === true,
    });

    if (!this.settings.automaticUpdatesEnabled) {
      this.automaticCheckGeneration += 1;
      this._clearTimers();
      if (this.downloadWasAutomatic && this.downloadCancellationToken) {
        this.downloadCancellationToken.cancel();
      }
      if (this.state.status !== 'update_downloaded') {
        this._setState({ status: 'disabled', progress: null, error: null });
      } else {
        this._setState({});
      }
    } else {
      this._setState({ status: this.state.status === 'disabled' ? 'idle' : this.state.status });
      this._scheduleAutomaticChecks(0, DEFAULT_CHECK_INTERVAL_MS);
    }

    return this.getSettings();
  }

  startAutomaticChecks({
    initialDelayMs = DEFAULT_INITIAL_CHECK_DELAY_MS,
    intervalMs = DEFAULT_CHECK_INTERVAL_MS,
  } = {}) {
    if (!this.app.isPackaged || !this.settings.automaticUpdatesEnabled) return;
    this._scheduleAutomaticChecks(initialDelayMs, intervalMs);
  }

  _scheduleAutomaticChecks(initialDelayMs, intervalMs) {
    this._clearTimers();
    if (!this.app.isPackaged || !this.settings.automaticUpdatesEnabled) return;

    this.initialCheckTimer = this.setTimeoutFn(() => {
      this.initialCheckTimer = null;
      this.checkForUpdates({ automatic: true }).catch((error) => {
        this.logger.warn('[auto-updater] Automatic update check failed:', error.message);
      });
    }, initialDelayMs);
    this.periodicCheckTimer = this.setIntervalFn(() => {
      this.checkForUpdates({ automatic: true }).catch((error) => {
        this.logger.warn('[auto-updater] Periodic update check failed:', error.message);
      });
    }, intervalMs);
  }

  _clearTimers() {
    if (this.initialCheckTimer) {
      this.clearTimeoutFn(this.initialCheckTimer);
      this.initialCheckTimer = null;
    }
    if (this.periodicCheckTimer) {
      this.clearIntervalFn(this.periodicCheckTimer);
      this.periodicCheckTimer = null;
    }
  }

  async checkForUpdates({ automatic = false } = {}) {
    if (!this.initialized) await this.initialize();
    if (this.state.status === 'downloading' || this.state.status === 'update_downloaded') {
      return this.getState();
    }
    if (automatic && !this.settings.automaticUpdatesEnabled) return this.getState();
    if (this.checkPromise) {
      if (!automatic && this.activeCheck?.automatic) {
        this.activeCheck.automatic = false;
        this._setState({ checkSource: 'manual' });
      }
      if (this.activeCheck && !this._isCheckCurrent(this.activeCheck)) {
        return this.checkPromise
          .catch(() => undefined)
          .then(() => this.checkForUpdates({ automatic }));
      }
      return this.checkPromise;
    }

    const check = {
      automatic,
      generation: this.automaticCheckGeneration,
    };
    this.activeCheck = check;
    const checkPromise = this._checkForUpdates(check).finally(() => {
      if (this.activeCheck === check) {
        this.activeCheck = null;
      }
      if (this.checkPromise === checkPromise) {
        this.checkPromise = null;
      }
    });
    this.checkPromise = checkPromise;
    return checkPromise;
  }

  async _checkForUpdates(check) {
    if (!this.app.isPackaged || !this.canAutoUpdate) {
      const fallbackState = await this.checkReleaseFallback({ app: this.app, logger: this.logger });
      if (!this._isCheckCurrent(check)) return this.getState();
      this._setState({
        ...fallbackState,
        automaticUpdatesEnabled: this.settings.automaticUpdatesEnabled,
        checkSource: check.automatic ? 'automatic' : 'manual',
      });
      return this.getState();
    }

    this._setState({
      status: 'checking',
      error: null,
      progress: null,
      checkSource: check.automatic ? 'automatic' : 'manual',
    });
    const result = await this.updater.checkForUpdates();
    if (!this._isCheckCurrent(check)) return this.getState();
    const update = updateInfoToPublicUpdate(result?.updateInfo);
    const currentVersion = normalizeReleaseVersion(this.app.getVersion());
    if (update?.version === currentVersion && result?.isUpdateAvailable === false) {
      const fallbackState = await this.checkReleaseFallback({ app: this.app, logger: this.logger });
      if (!this._isCheckCurrent(check)) return this.getState();
      this._setState({
        ...fallbackState,
        automaticUpdatesEnabled: this.settings.automaticUpdatesEnabled,
        checkSource: check.automatic ? 'automatic' : 'manual',
      });
      return this.getState();
    }
    const updateIsNewer = update && shouldNotifyUpdate({
      currentVersion,
      latestVersion: update.version,
    });
    if (!update || result?.isUpdateAvailable === false || !updateIsNewer) {
      this._setState({
        status: 'up_to_date',
        latestVersion: update?.version || this.app.getVersion(),
        update: null,
        progress: null,
        error: null,
      });
      return this.getState();
    }

    this._setState({
      status: 'update_available',
      latestVersion: update.version,
      update,
      progress: null,
      error: null,
      canAutoUpdate: this.canAutoUpdate,
    });
    return this.getState();
  }

  async downloadUpdate({ automatic = false } = {}) {
    if (!this.app.isPackaged || !this.canAutoUpdate) return this.getState();
    if (automatic && !this.settings.automaticUpdatesEnabled) return this.getState();
    if (this.state.status === 'update_downloaded') return this.getState();
    if (
      !this.state.update
      || (this.state.status !== 'update_available' && this.state.status !== 'error')
    ) {
      return this.getState();
    }
    if (this.downloadPromise) return this.downloadPromise;

    this.downloadWasAutomatic = automatic;
    this.downloadCancellationToken = new this.CancellationToken();
    this._setState({ status: 'downloading', progress: null, error: null });
    this.downloadPromise = this.updater.downloadUpdate(this.downloadCancellationToken)
      .then(() => {
        if (this.state.status !== 'update_downloaded') {
          this._setState({ status: 'update_downloaded', error: null });
        }
        return this.getState();
      })
      .catch((error) => {
        if (error?.name === 'CancellationError') {
          this._setState({
            status: this.settings.automaticUpdatesEnabled ? 'update_available' : 'disabled',
            progress: null,
            error: null,
          });
          return this.getState();
        }
        this._setState({ status: 'error', error: error?.message || String(error), progress: null });
        throw error;
      })
      .finally(() => {
        this.downloadPromise = null;
        this.downloadCancellationToken = null;
        this.downloadWasAutomatic = false;
      });
    return this.downloadPromise;
  }

  isUpdateDownloaded() {
    return this.state.status === 'update_downloaded';
  }

  shouldInstallOnQuit() {
    return this.canAutoUpdate && this.isUpdateDownloaded();
  }

  quitAndInstall() {
    if (!this.isUpdateDownloaded()) return false;
    this.updater.quitAndInstall(false, true);
    return true;
  }

  dispose() {
    this._clearTimers();
    if (this.downloadCancellationToken) {
      this.downloadCancellationToken.cancel();
    }
    this.listeners.clear();
  }
}

module.exports = {
  DesktopAutoUpdateManager,
  checkGitHubReleaseFallback,
  detectAutoUpdateSupport,
  _internal: {
    createReleaseUrl,
    extractReleaseTimestamp,
    readBuildMeta,
    releaseNotesToText,
    updateInfoToPublicUpdate,
  },
};
