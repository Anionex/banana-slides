const test = require('node:test');
const assert = require('node:assert/strict');

const updatePolicy = require('./update-policy');

test('uses commit timestamp for clean builds', () => {
  assert.equal(
    updatePolicy.resolveCurrentBuildTimestamp({
      commitTimestamp: 1710000000,
      buildTimestamp: 1710000999,
      dirty: false,
    }),
    1710000000,
  );
});

test('uses build timestamp for dirty builds', () => {
  assert.equal(
    updatePolicy.resolveCurrentBuildTimestamp({
      commitTimestamp: 1710000000,
      buildTimestamp: 1710000999,
      dirty: true,
    }),
    1710000999,
  );
});

test('shows semver upgrade even when current build timestamp is newer', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0',
      latestVersion: '0.4.0',
      currentBuildTimestamp: 1710002000,
      latestReleaseTimestamp: 1710001000,
    }),
    true,
  );
});

test('uses timestamp when versions are equal', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0-ci.377.4',
      latestVersion: '0.3.0-ci.377.4',
      currentBuildTimestamp: 1710001000,
      latestReleaseTimestamp: 1710002000,
    }),
    true,
  );
});

test('suppresses downgrade prompts even when latest release timestamp is newer', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0',
      latestVersion: '0.2.0',
      currentBuildTimestamp: 1710001000,
      latestReleaseTimestamp: 1710002000,
    }),
    false,
  );
});

test('falls back to semver when timestamps are unavailable', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0',
      latestVersion: '0.3.1',
      currentBuildTimestamp: null,
      latestReleaseTimestamp: null,
    }),
    true,
  );
});

test('treats stable releases as newer than pre-release builds', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0-ci.377.4',
      latestVersion: '0.3.0',
      currentBuildTimestamp: null,
      latestReleaseTimestamp: null,
    }),
    true,
  );
});

test('selects a newer pre-release for an app already on the pre-release channel', () => {
  const release = updatePolicy.selectLatestDesktopRelease([
    {
      tag_name: 'v0.4.0',
      draft: false,
      prerelease: false,
      assets: [],
    },
    {
      tag_name: 'v0.9.0-rc.4',
      draft: false,
      prerelease: true,
      assets: [{ name: 'BananaSlides-0.9.0-rc.4-mac-arm64.dmg' }],
    },
    {
      tag_name: 'v0.9.0-rc.3',
      draft: false,
      prerelease: true,
      assets: [{ name: 'BananaSlides-0.9.0-rc.3-mac-arm64.dmg' }],
    },
  ], '0.9.0-rc.3', 'darwin', 'arm64');

  assert.equal(release?.tag_name, 'v0.9.0-rc.4');
});

test('stable builds do not opt into pre-release updates', () => {
  const release = updatePolicy.selectLatestDesktopRelease([
    {
      tag_name: 'v1.0.0-rc.1',
      draft: false,
      prerelease: true,
      assets: [{ name: 'BananaSlides-1.0.0-rc.1-win-x64-Setup.exe' }],
    },
    {
      tag_name: 'v0.9.0',
      draft: false,
      prerelease: false,
      assets: [{ name: 'BananaSlides-0.9.0-win-x64-Setup.exe' }],
    },
  ], '0.9.0', 'win32', 'x64');

  assert.equal(release?.tag_name, 'v0.9.0');
});

test('ignores releases without an installer for the current platform', () => {
  const release = updatePolicy.selectLatestDesktopRelease([
    {
      tag_name: 'v0.9.1',
      draft: false,
      prerelease: false,
      assets: [{ name: 'BananaSlides-0.9.1-win-x64-Setup.exe' }],
    },
    {
      tag_name: 'v0.9.0',
      draft: false,
      prerelease: false,
      assets: [{ name: 'BananaSlides-0.9.0-mac-arm64.dmg' }],
    },
  ], '0.8.0', 'darwin', 'arm64');

  assert.equal(release?.tag_name, 'v0.9.0');
});

test('accepts electron-builder Linux x64 artifact names', () => {
  assert.equal(updatePolicy.releaseHasDesktopAsset({
    assets: [{ name: 'BananaSlides-0.9.1-linux-x64.AppImage' }],
  }, 'linux', 'x64'), true);
  assert.equal(updatePolicy.releaseHasDesktopAsset({
    assets: [{ name: 'BananaSlides-0.9.1-linux-x64.deb' }],
  }, 'linux', 'x64'), true);
});
