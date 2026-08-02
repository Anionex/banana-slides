const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CONFIG_VERSION = 1;
const CONFIG_FILENAME = 'storage-config.json';
const INSTALLER_FILENAME = 'installer-data-root.txt';

function storageError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function normalizeDataRoot(dataRoot, platform = process.platform) {
  if (typeof dataRoot !== 'string' || !dataRoot.trim()) {
    throw storageError('INVALID_DATA_ROOT', 'Data storage location is required.');
  }
  const pathApi = platform === 'win32' ? path.win32 : path;
  const trimmed = dataRoot.trim();
  if (!pathApi.isAbsolute(trimmed)) {
    throw storageError('INVALID_DATA_ROOT', 'Data storage location must be an absolute path.');
  }
  const normalized = pathApi.resolve(trimmed);
  if (platform === 'win32' && normalized.startsWith('\\\\')) {
    throw storageError('NETWORK_DATA_ROOT_UNSUPPORTED', 'Windows UNC data storage locations are not supported.');
  }
  return normalized;
}

function getConfigPath(userDataPath) {
  return path.join(userDataPath, CONFIG_FILENAME);
}

function decodeInstallerPath(buffer) {
  if (!buffer.length) return '';
  const hasUtf16Bom = buffer[0] === 0xff && buffer[1] === 0xfe;
  const looksUtf16 = hasUtf16Bom
    || (buffer.length > 3 && buffer[1] === 0 && buffer[3] === 0);
  const decoded = buffer.toString(looksUtf16 ? 'utf16le' : 'utf8');
  return decoded.replace(/^\uFEFF/, '').replace(/\0/g, '').trim();
}

async function readStorageConfig(userDataPath) {
  const configPath = getConfigPath(userDataPath);
  let raw;
  try {
    raw = await fs.promises.readFile(configPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw storageError('CONFIG_READ_FAILED', `Unable to read ${configPath}: ${error.message}`, error);
  }

  try {
    const config = JSON.parse(raw);
    if (config.version !== CONFIG_VERSION) {
      throw new Error(`Unsupported storage configuration version: ${config.version}`);
    }
    return { version: CONFIG_VERSION, dataRoot: normalizeDataRoot(config.dataRoot) };
  } catch (error) {
    throw storageError('CONFIG_INVALID', `Invalid data storage configuration: ${error.message}`, error);
  }
}

async function writeStorageConfig(userDataPath, dataRoot) {
  const normalized = normalizeDataRoot(dataRoot);
  await fs.promises.mkdir(userDataPath, { recursive: true });
  const configPath = getConfigPath(userDataPath);
  const tempPath = `${configPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const contents = `${JSON.stringify({ version: CONFIG_VERSION, dataRoot: normalized }, null, 2)}\n`;
  try {
    await fs.promises.writeFile(tempPath, contents, { encoding: 'utf8', flag: 'wx' });
    await fs.promises.rename(tempPath, configPath);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    throw storageError('CONFIG_WRITE_FAILED', `Unable to save the data storage location: ${error.message}`, error);
  }
  return { version: CONFIG_VERSION, dataRoot: normalized };
}

async function consumeInstallerDataRoot(userDataPath) {
  const config = await readStorageConfig(userDataPath);
  if (config) return config;

  const installerPath = path.join(userDataPath, INSTALLER_FILENAME);
  let buffer;
  try {
    buffer = await fs.promises.readFile(installerPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw storageError('INSTALLER_PATH_READ_FAILED', `Unable to read the installer data location: ${error.message}`, error);
  }

  const dataRoot = normalizeDataRoot(decodeInstallerPath(buffer));
  const saved = await writeStorageConfig(userDataPath, dataRoot);
  // The persisted config is authoritative; a temporary Windows file lock must
  // not prevent startup after the handoff has already succeeded.
  await fs.promises.rm(installerPath, { force: true }).catch(() => {});
  return saved;
}

async function inspectDataRoot(dataRoot) {
  const normalized = normalizeDataRoot(dataRoot);
  let stat;
  try {
    stat = await fs.promises.stat(normalized);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        dataRoot: normalized,
        exists: false,
        writable: false,
        hasDatabase: false,
        isEmpty: true,
      };
    }
    throw storageError('DATA_ROOT_UNAVAILABLE', `Unable to access ${normalized}: ${error.message}`, error);
  }

  if (!stat.isDirectory()) {
    throw storageError('DATA_ROOT_UNAVAILABLE', `The selected location is not a directory: ${normalized}`);
  }

  try {
    await fs.promises.access(normalized, fs.constants.R_OK | fs.constants.W_OK);
    const probePath = path.join(normalized, `.banana-slides-write-test-${process.pid}-${crypto.randomUUID()}`);
    try {
      await fs.promises.writeFile(probePath, 'ok', { flag: 'wx' });
    } finally {
      await fs.promises.rm(probePath, { force: true }).catch(() => {});
    }
    const entries = await fs.promises.readdir(normalized);
    const databasePath = path.join(normalized, 'data', 'database.db');
    let hasDatabase = false;
    try {
      hasDatabase = (await fs.promises.stat(databasePath)).isFile();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return {
      dataRoot: normalized,
      exists: true,
      writable: true,
      hasDatabase,
      isEmpty: entries.length === 0,
    };
  } catch (error) {
    throw storageError('DATA_ROOT_UNAVAILABLE', `Data storage location is not writable: ${normalized}. ${error.message}`, error);
  }
}

async function createAndInspectDataRoot(dataRoot) {
  const normalized = normalizeDataRoot(dataRoot);
  try {
    await fs.promises.mkdir(normalized, { recursive: true });
  } catch (error) {
    throw storageError('DATA_ROOT_UNAVAILABLE', `Unable to create ${normalized}: ${error.message}`, error);
  }
  return inspectDataRoot(normalized);
}

async function prepareDataRoot(dataRoot, allowInitialize = false) {
  let inspection = await inspectDataRoot(dataRoot);
  if (!inspection.hasDatabase && !allowInitialize) {
    throw storageError(
      'EMPTY_DATA_LOCATION',
      'EMPTY_DATA_LOCATION: The selected location has no Banana Slides database.',
    );
  }
  if (!inspection.exists) {
    inspection = await createAndInspectDataRoot(inspection.dataRoot);
  }
  return inspection;
}

async function initializeDataRoot(userDataPath) {
  const config = await consumeInstallerDataRoot(userDataPath);
  const dataRoot = config?.dataRoot || normalizeDataRoot(userDataPath);
  let inspection = await inspectDataRoot(dataRoot);
  if (!inspection.exists) {
    if (config) {
      throw storageError('DATA_ROOT_UNAVAILABLE', `Data storage location does not exist: ${dataRoot}`);
    }
    inspection = await createAndInspectDataRoot(dataRoot);
  }
  return {
    ...inspection,
    isDefault: !config,
  };
}

module.exports = {
  CONFIG_FILENAME,
  CONFIG_VERSION,
  INSTALLER_FILENAME,
  consumeInstallerDataRoot,
  createAndInspectDataRoot,
  decodeInstallerPath,
  getConfigPath,
  initializeDataRoot,
  inspectDataRoot,
  normalizeDataRoot,
  prepareDataRoot,
  readStorageConfig,
  writeStorageConfig,
};
