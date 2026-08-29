const semver = require('semver');

function normalizeReleaseVersion(tagName) {
  if (typeof tagName !== 'string') {
    return null;
  }

  return semver.valid(tagName.trim().replace(/^v/i, ''));
}

function isVersionGreater(latestVersion, currentVersion) {
  const latest = normalizeReleaseVersion(latestVersion);
  const current = normalizeReleaseVersion(currentVersion);
  if (!latest || !current) {
    return false;
  }

  return semver.gt(latest, current);
}

function isVersionLess(latestVersion, currentVersion) {
  const latest = normalizeReleaseVersion(latestVersion);
  const current = normalizeReleaseVersion(currentVersion);
  if (!latest || !current) {
    return false;
  }

  return semver.lt(latest, current);
}

function getDesktopAssetPatterns(platform, arch) {
  if (platform === 'win32' && arch === 'x64') {
    return [/(?:win|windows)[-_]x64.*\.exe$/i];
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return [/(?:mac|macos)[-_]arm64.*\.dmg$/i];
  }
  if (platform === 'darwin' && arch === 'x64') {
    return [/(?:mac|macos)[-_]x64.*\.dmg$/i];
  }
  if (platform === 'linux' && arch === 'x64') {
    return [
      /linux[-_](?:x64|x86_64).*\.appimage$/i,
      /linux[-_](?:x64|amd64).*\.deb$/i,
    ];
  }
  if (platform === 'linux' && arch === 'arm64') {
    return [
      /linux[-_](?:arm64|aarch64).*\.appimage$/i,
      /linux[-_](?:arm64|aarch64).*\.deb$/i,
    ];
  }
  return [];
}

function releaseHasDesktopAsset(release, platform, arch) {
  const patterns = getDesktopAssetPatterns(platform, arch);
  if (patterns.length === 0 || !Array.isArray(release?.assets)) {
    return false;
  }

  return release.assets.some((asset) => {
    const name = typeof asset?.name === 'string' ? asset.name : '';
    return patterns.some((pattern) => pattern.test(name));
  });
}

function selectLatestDesktopRelease(releases, currentVersion, platform, arch) {
  const current = normalizeReleaseVersion(currentVersion);
  if (!current || !Array.isArray(releases)) {
    return null;
  }

  const includePrereleases = semver.prerelease(current) !== null;
  const candidates = releases.filter((release) => {
    if (!release || release.draft) {
      return false;
    }

    const version = normalizeReleaseVersion(release.tag_name);
    if (!version) {
      return false;
    }
    if (!includePrereleases && (release.prerelease || semver.prerelease(version) !== null)) {
      return false;
    }

    return releaseHasDesktopAsset(release, platform, arch);
  });

  candidates.sort((left, right) => {
    const leftVersion = normalizeReleaseVersion(left.tag_name);
    const rightVersion = normalizeReleaseVersion(right.tag_name);
    return semver.rcompare(leftVersion, rightVersion);
  });

  return candidates[0] || null;
}

function resolveCurrentBuildTimestamp(buildMeta) {
  if (!buildMeta || typeof buildMeta !== 'object') {
    return null;
  }

  if (buildMeta.dirty && Number.isFinite(buildMeta.buildTimestamp)) {
    return buildMeta.buildTimestamp;
  }

  if (Number.isFinite(buildMeta.commitTimestamp)) {
    return buildMeta.commitTimestamp;
  }

  if (Number.isFinite(buildMeta.buildTimestamp)) {
    return buildMeta.buildTimestamp;
  }

  return null;
}

function shouldNotifyUpdate({ currentVersion, latestVersion, currentBuildTimestamp, latestReleaseTimestamp }) {
  if (isVersionGreater(latestVersion, currentVersion)) {
    return true;
  }

  if (isVersionLess(latestVersion, currentVersion)) {
    return false;
  }

  if (Number.isFinite(currentBuildTimestamp) && Number.isFinite(latestReleaseTimestamp)) {
    return latestReleaseTimestamp > currentBuildTimestamp;
  }

  return false;
}

module.exports = {
  normalizeReleaseVersion,
  isVersionGreater,
  isVersionLess,
  releaseHasDesktopAsset,
  selectLatestDesktopRelease,
  resolveCurrentBuildTimestamp,
  shouldNotifyUpdate,
};
