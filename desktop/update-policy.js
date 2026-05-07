function parseVersion(version) {
  if (typeof version !== 'string') {
    return null;
  }

  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }

  return match.slice(1, 4).map((value) => Number.parseInt(value, 10));
}

function isVersionGreater(latestVersion, currentVersion) {
  const latest = parseVersion(latestVersion);
  const current = parseVersion(currentVersion);

  if (!latest || !current) {
    return false;
  }

  for (let index = 0; index < latest.length; index += 1) {
    if (latest[index] > current[index]) {
      return true;
    }
    if (latest[index] < current[index]) {
      return false;
    }
  }

  return false;
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
