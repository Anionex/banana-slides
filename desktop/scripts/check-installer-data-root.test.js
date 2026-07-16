const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const desktopRoot = path.resolve(__dirname, '..');
const installerScript = fs.readFileSync(path.join(desktopRoot, 'resources', 'installer.nsh'), 'utf8');
const builderConfig = fs.readFileSync(path.join(desktopRoot, 'electron-builder.yml'), 'utf8');
const smokeScript = fs.readFileSync(path.join(desktopRoot, 'scripts', 'smoke-windows.ps1'), 'utf8');

test('electron-builder includes the custom bilingual NSIS installer', () => {
  assert.match(builderConfig, /include: resources\/installer\.nsh/);
  assert.match(builderConfig, /installerLanguages:\s*\n\s*- en_US\s*\n\s*- zh_CN/);
  assert.match(installerScript, /LangString DataStorageTitle 1033/);
  assert.match(installerScript, /LangString DataStorageTitle 2052/);
  assert.match(builderConfig, /productName: Banana Slides/);
  assert.match(installerScript, /\$APPDATA\\Banana Slides\\installer-data-root\.txt/);
  assert.doesNotMatch(installerScript, /\$APPDATA\\banana-slides-desktop/);
});

test('data storage page follows the installation-directory page and skips upgrades', () => {
  assert.match(installerScript, /!macro customPageAfterChangeDir[\s\S]*Page custom DataStoragePageCreate DataStoragePageLeave/);
  assert.match(installerScript, /Function DataStoragePageCreate[\s\S]*\$\{If\} \$\{isUpdated\}[\s\S]*Abort/);
  assert.match(installerScript, /Function ValidateDataStorageRoot[\s\S]*CreateDirectory[\s\S]*GetFullPathName[\s\S]*GetTempFileName[\s\S]*Delete/);
  assert.match(installerScript, /StrCpy \$R0 \$DataStorageRoot 2[\s\S]*\$R0 == "\\\\"/);
  assert.match(installerScript, /StrCpy \$R0 \$DataStorageRoot 1 1[\s\S]*\$R0 != ":"/);
});

test('first install persists the selected path before install and supports silent install', () => {
  assert.match(installerScript, /\$\{GetOptions\} \$R0 "\/DATA_ROOT=" \$R1/);
  assert.match(installerScript, /\$\{IfNot\} \$\{isUpdated\}[\s\S]*\$\{AndIf\} \$\{Silent\}[\s\S]*Call WriteDataStorageBootstrap/);
  assert.match(installerScript, /Function DataStoragePageLeave[\s\S]*Call WriteDataStorageBootstrap/);
  assert.match(installerScript, /Function WriteDataStorageBootstrap[\s\S]*installer-data-root\.txt/);
  assert.match(installerScript, /FileWriteUTF16LE \/BOM \$R0 "\$DataStorageRoot"/);
  assert.doesNotMatch(installerScript, /customInstall|customUnInstall|customRemoveFiles/);
  assert.match(smokeScript, /\/S \/DATA_ROOT=/);
  assert.match(smokeScript, /data\\database\.db/);
  assert.match(smokeScript, /custom data root/i);
  assert.match(smokeScript, /Smoke result dataRoot is missing/);
  assert.match(smokeScript, /Installer bootstrap was not consumed/);
  assert.match(smokeScript, /storage-config\.json/);
  assert.match(smokeScript, /Banana Slides\\installer-data-root\.txt/);
  assert.match(smokeScript, /Banana Slides\\storage-config\.json/);
});
