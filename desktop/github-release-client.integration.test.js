const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { fetchGitHubJson } = require('./github-release-client');
const { isVersionGreater, normalizeReleaseVersion, selectLatestDesktopRelease } = require('./update-policy');

test('packages the GitHub release client with the desktop application', () => {
  const builderConfig = fs.readFileSync(path.join(__dirname, 'electron-builder.yml'), 'utf8');
  assert.match(builderConfig, /- "github-release-client\.js"/);
});

test('live GitHub releases expose an installable update after rc.3', { timeout: 20000 }, async () => {
  const releases = await fetchGitHubJson(
    '/repos/Anionex/banana-slides/releases?per_page=30',
    {
      token: process.env.GITHUB_TOKEN || '',
      userAgent: 'BananaSlides-update-check-integration-test',
    },
  );

  assert.ok(Array.isArray(releases));
  const latest = selectLatestDesktopRelease(releases, '0.9.0-rc.3', 'darwin', 'arm64');
  assert.ok(latest, 'expected a macOS arm64 desktop release newer than rc.3');
  assert.equal(latest.draft, false);
  assert.equal(isVersionGreater(normalizeReleaseVersion(latest.tag_name), '0.9.0-rc.3'), true);
  assert.ok(
    latest.assets.some((asset) => /mac-arm64.*\.dmg$/i.test(asset.name)),
    'expected the selected release to contain a macOS arm64 DMG',
  );
});
