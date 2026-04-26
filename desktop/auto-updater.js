const https = require('https');
const semver = require('semver');
const { app } = require('electron');
const log = require('electron-log');

const REPO_OWNER = 'Anionex';
const REPO_NAME = 'banana-slides';

function checkForUpdates() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: { 'User-Agent': `BananaSlides/${app.getVersion()}` },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          const release = JSON.parse(data);
          const latestVersion = release.tag_name.replace(/^v/, '');
          const currentVersion = app.getVersion();

          if (semver.valid(latestVersion) && semver.gt(latestVersion, currentVersion)) {
            resolve({
              version: latestVersion,
              notes: release.body || '',
              url: release.html_url,
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          log.warn('[auto-updater] Parse error:', e.message);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      log.warn('[auto-updater] Network error:', e.message);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

module.exports = { checkForUpdates };
