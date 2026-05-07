const fs = require('fs');
const https = require('https');
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');
const { resolveCurrentBuildTimestamp, shouldNotifyUpdate } = require('./update-policy');

const REPO_OWNER = 'Anionex';
const REPO_NAME = 'banana-slides';
const BUILD_META_PATH = path.join(__dirname, 'build-meta.json');

function fetchGitHubJson(requestPath) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: requestPath,
      headers: { 'User-Agent': `BananaSlides/${app.getVersion()}` },
    };

    const req = https.get(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(chunks.join('')));
        } catch (error) {
          log.warn('[auto-updater] Parse error:', error.message);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      log.warn('[auto-updater] Network error:', error.message);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

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
  const release = await fetchGitHubJson(`/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
  if (!release?.tag_name) {
    return null;
  }

  const currentVersion = app.getVersion();
  const latestVersion = release.tag_name.replace(/^v/, '');
  const buildMeta = readBuildMeta();
  const currentBuildTimestamp = resolveCurrentBuildTimestamp(buildMeta);
  const releaseCommit = await fetchGitHubJson(`/repos/${REPO_OWNER}/${REPO_NAME}/commits/${encodeURIComponent(release.tag_name)}`);
  const latestReleaseTimestamp = extractReleaseTimestamp(releaseCommit, release);

  if (shouldNotifyUpdate({ currentVersion, latestVersion, currentBuildTimestamp, latestReleaseTimestamp })) {
    return {
      version: latestVersion,
      notes: release.body || '',
      url: release.html_url,
    };
  }

  return null;
}

module.exports = {
  checkForUpdates,
  _internal: {
    extractReleaseTimestamp,
    readBuildMeta,
  },
};
