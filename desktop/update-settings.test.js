const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  getUpdateSettingsPath,
  readUpdateSettings,
  writeUpdateSettings,
} = require('./update-settings');

async function createTempDirectory(t) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'banana-update-settings-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('enables automatic updates by default when no preference exists', async (t) => {
  const userDataPath = await createTempDirectory(t);

  assert.deepEqual(await readUpdateSettings(userDataPath), {
    automaticUpdatesEnabled: true,
  });
});

test('persists an explicit automatic update preference', async (t) => {
  const userDataPath = await createTempDirectory(t);

  await writeUpdateSettings(userDataPath, { automaticUpdatesEnabled: false });

  assert.deepEqual(await readUpdateSettings(userDataPath), {
    automaticUpdatesEnabled: false,
  });
  assert.deepEqual(
    JSON.parse(await fs.promises.readFile(getUpdateSettingsPath(userDataPath), 'utf8')),
    { automaticUpdatesEnabled: false },
  );
});

test('normalizes missing fields from older preference files', async (t) => {
  const userDataPath = await createTempDirectory(t);
  await fs.promises.writeFile(getUpdateSettingsPath(userDataPath), '{}\n', 'utf8');

  assert.deepEqual(await readUpdateSettings(userDataPath), {
    automaticUpdatesEnabled: true,
  });
});

test('recovers from a malformed preference file without blocking app startup', async (t) => {
  const userDataPath = await createTempDirectory(t);
  await fs.promises.writeFile(getUpdateSettingsPath(userDataPath), '{broken json', 'utf8');

  assert.deepEqual(await readUpdateSettings(userDataPath), {
    automaticUpdatesEnabled: true,
  });
});
