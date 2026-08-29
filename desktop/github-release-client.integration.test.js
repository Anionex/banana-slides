const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchGitHubReleases } = require('./github-release-client');
const { isVersionGreater, normalizeReleaseVersion, selectLatestDesktopRelease } = require('./update-policy');

test('live GitHub releases expose an installable update after rc.3', { timeout: 20000 }, async () => {
  const releases = await fetchGitHubReleases(
    'Anionex',
    'banana-slides',
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
