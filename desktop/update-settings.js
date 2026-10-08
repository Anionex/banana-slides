const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPDATE_SETTINGS_FILENAME = 'update-settings.json';
const DEFAULT_UPDATE_SETTINGS = Object.freeze({
  automaticUpdatesEnabled: true,
});

function getUpdateSettingsPath(userDataPath) {
  return path.join(userDataPath, UPDATE_SETTINGS_FILENAME);
}

function normalizeUpdateSettings(value) {
  return {
    automaticUpdatesEnabled: value?.automaticUpdatesEnabled !== false,
  };
}

async function readUpdateSettings(userDataPath) {
  const settingsPath = getUpdateSettingsPath(userDataPath);
  try {
    const raw = await fs.promises.readFile(settingsPath, 'utf8');
    return normalizeUpdateSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return { ...DEFAULT_UPDATE_SETTINGS };
    }
    throw error;
  }
}

async function writeUpdateSettings(userDataPath, settings) {
  const normalized = normalizeUpdateSettings(settings);
  const settingsPath = getUpdateSettingsPath(userDataPath);
  const temporaryPath = `${settingsPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.promises.mkdir(userDataPath, { recursive: true });
  try {
    await fs.promises.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await fs.promises.rename(temporaryPath, settingsPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  return normalized;
}

module.exports = {
  DEFAULT_UPDATE_SETTINGS,
  UPDATE_SETTINGS_FILENAME,
  getUpdateSettingsPath,
  normalizeUpdateSettings,
  readUpdateSettings,
  writeUpdateSettings,
};
