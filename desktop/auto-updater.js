const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const { fetchGitHubJson, fetchGitHubReleases } = require('./github-release-client');
const {
  isVersionLess,
  normalizeReleaseVersion,
  resolveCurrentBuildTimestamp,
  selectLatestDesktopRelease,
  shouldNotifyUpdate,
} = require('./update-policy');

const REPO_OWNER = 'Anionex';
const REPO_NAME = 'banana-slides';
const BUILD_META_PATH = path.join(__dirname, 'build-meta.json');

function readBuildMeta() {
  try {
    if (!fs.existsSync(BUILD_META_PATH)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(BUILD_META_PATH, 'utf8'));
  } catch (error) {
    log.warn('[auto-updater] Failed to read build metadata:', error.message);
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

async function checkForUpdates() {
  let releases;
  try {
    releases = await fetchGitHubReleases(
      REPO_OWNER,
      REPO_NAME,
      { userAgent: `BananaSlides/${app.getVersion()}` },
    );
  } catch (error) {
    log.warn('[auto-updater] Failed to fetch releases:', error.message);
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
    };
  }

  const latestVersion = normalizeReleaseVersion(release.tag_name);
  if (!latestVersion) {
    throw new Error(`GitHub release has an invalid version tag: ${release.tag_name}`);
  }
  const buildMeta = readBuildMeta();
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
    };
  }

  if (isVersionLess(latestVersion, currentVersion)) {
    return {
      status: 'up_to_date',
      currentVersion,
      latestVersion,
      update: null,
    };
  }

  let releaseCommit;
  try {
    releaseCommit = await fetchGitHubJson(
      `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${encodeURIComponent(release.tag_name)}`,
      { userAgent: `BananaSlides/${app.getVersion()}` },
    );
  } catch (error) {
    log.warn('[auto-updater] Failed to fetch release commit:', error.message);
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
    };
  }

  return {
    status: 'up_to_date',
    currentVersion,
    latestVersion,
    update: null,
  };
}

module.exports = {
  checkForUpdates,
  _internal: {
    extractReleaseTimestamp,
    readBuildMeta,
  },
};
