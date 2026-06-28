const semver = require('semver');

function isVersionGreater(latestVersion, currentVersion) {
  const latest = semver.valid(latestVersion);
  const current = semver.valid(currentVersion);
  if (!latest || !current) {
    return false;
  }

  return semver.gt(latest, current);
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
  if (Number.isFinite(currentBuildTimestamp) && Number.isFinite(latestReleaseTimestamp)) {
    return latestReleaseTimestamp > currentBuildTimestamp;
  }

  return isVersionGreater(latestVersion, currentVersion);
}

module.exports = {
  isVersionGreater,
  resolveCurrentBuildTimestamp,
  shouldNotifyUpdate,
};
