const semver = require('semver');

function isVersionGreater(latestVersion, currentVersion) {
  const latest = semver.valid(latestVersion);
  const current = semver.valid(currentVersion);
  if (!latest || !current) {
    return false;
  }

  return semver.gt(latest, current);
}

function isVersionLess(latestVersion, currentVersion) {
  const latest = semver.valid(latestVersion);
  const current = semver.valid(currentVersion);
  if (!latest || !current) {
    return false;
  }

  return semver.lt(latest, current);
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
  isVersionGreater,
  isVersionLess,
  resolveCurrentBuildTimestamp,
  shouldNotifyUpdate,
};
