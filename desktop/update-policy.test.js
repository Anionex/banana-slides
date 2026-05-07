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

test('suppresses update when current build is newer than released commit', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0',
      latestVersion: '0.4.0',
      currentBuildTimestamp: 1710002000,
      latestReleaseTimestamp: 1710001000,
    }),
    false,
  );
});

test('shows update when released commit is newer than current build', () => {
  assert.equal(
    updatePolicy.shouldNotifyUpdate({
      currentVersion: '0.3.0',
      latestVersion: '0.3.1',
      currentBuildTimestamp: 1710001000,
      latestReleaseTimestamp: 1710002000,
    }),
    true,
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
