const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  DESKTOP_ICON_RESOURCES,
  SPLASH_ICON_PATH,
} = require('../icon-policy');

const desktopDir = path.resolve(__dirname, '..');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngMetadata(filePath) {
  const data = fs.readFileSync(filePath);
  assert.ok(data.subarray(0, 8).equals(pngSignature), `${filePath} is not a PNG file`);
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR', `${filePath} has no IHDR header`);
  let dpi = null;
  for (let offset = 8; offset + 12 <= data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'pHYs' && length === 9 && data.readUInt8(offset + 16) === 1) {
      dpi = {
        x: data.readUInt32BE(offset + 8) * 0.0254,
        y: data.readUInt32BE(offset + 12) * 0.0254,
      };
      break;
    }
    offset += length + 12;
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data.readUInt8(25),
    dpi,
  };
}

function assertPng(filePath, expectedWidth, expectedHeight, expectedDpi = null) {
  const metadata = readPngMetadata(filePath);
  assert.deepEqual(
    { width: metadata.width, height: metadata.height },
    { width: expectedWidth, height: expectedHeight },
    `${filePath} must be ${expectedWidth}x${expectedHeight}`,
  );
  assert.equal(metadata.colorType, 6, `${filePath} must retain an RGBA alpha channel`);
  if (expectedDpi !== null) {
    assert.ok(metadata.dpi, `${filePath} must declare its pixel density`);
    assert.ok(Math.abs(metadata.dpi.x - expectedDpi) < 0.1,
      `${filePath} must use ${expectedDpi}dpi horizontally`);
    assert.ok(Math.abs(metadata.dpi.y - expectedDpi) < 0.1,
      `${filePath} must use ${expectedDpi}dpi vertically`);
  }
}

function readTopLevelYamlSection(source, sectionName) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${sectionName}:`);
  assert.notEqual(start, -1, `Missing ${sectionName} section`);
  let end = start + 1;
  while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end += 1;
  return lines.slice(start, end).join('\n');
}

function assertCommandSucceeded(result, command) {
  if (result.status === 0) return;
  const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  throw new Error(`${command} failed${details ? `:\n${details}` : ''}`);
}

function assertMacIcnsMatchesMaster(masterPath, icnsPath) {
  if (process.platform !== 'darwin') return;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-icon-contract-'));
  const iconsetPath = path.join(tempDir, 'icon.iconset');
  const expectedPath = path.join(tempDir, 'expected-1024.png');
  try {
    const resize = spawnSync(
      'sips',
      ['-z', '1024', '1024', masterPath, '--out', expectedPath],
      { encoding: 'utf8' },
    );
    assertCommandSucceeded(resize, 'sips');

    const extract = spawnSync(
      'iconutil',
      ['--convert', 'iconset', '--output', iconsetPath, icnsPath],
      { encoding: 'utf8' },
    );
    assertCommandSucceeded(extract, 'iconutil');

    const bundled1024 = path.join(iconsetPath, 'icon_512x512@2x.png');
    assert.ok(fs.readFileSync(bundled1024).equals(fs.readFileSync(expectedPath)),
      'icon.icns must be regenerated from resources/icon.png');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function checkIconContract(rootDir = desktopDir) {
  const resourcesDir = path.join(rootDir, 'resources');
  const masterPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.appPng);
  const icnsPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macBundle);
  const trayPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macTray);
  const tray2xPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macTray2x);
  const splashPath = path.join(rootDir, 'splash.html');
  const builderPath = path.join(rootDir, 'electron-builder.yml');
  const mainPath = path.join(rootDir, 'main.js');
  const packagePath = path.join(rootDir, 'package.json');

  assertPng(masterPath, 1024, 1024);
  assertPng(trayPath, 16, 16, 72);
  assertPng(tray2xPath, 32, 32, 144);

  const icns = fs.readFileSync(icnsPath);
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns', `${icnsPath} is not an ICNS file`);
  assertMacIcnsMatchesMaster(masterPath, icnsPath);

  const splash = fs.readFileSync(splashPath, 'utf8');
  assert.ok(splash.includes(`src="${SPLASH_ICON_PATH}"`),
    `Splash must use the shared ${SPLASH_ICON_PATH} master`);
  assert.ok(!splash.includes('logo.png'), 'Splash must not use the legacy standalone logo.png');
  assert.ok(!fs.existsSync(path.join(rootDir, 'logo.png')), 'Remove the legacy desktop/logo.png asset');

  const builder = fs.readFileSync(builderPath, 'utf8');
  const macSection = readTopLevelYamlSection(builder, 'mac');
  assert.match(macSection, /^\s{2}icon: resources\/icon\.icns$/m,
    'mac.icon must use resources/icon.icns');
  for (const resourceName of [DESKTOP_ICON_RESOURCES.macTray, DESKTOP_ICON_RESOURCES.macTray2x]) {
    assert.ok(builder.includes(`from: "resources/${resourceName}"`),
      `electron-builder must package resources/${resourceName}`);
    assert.ok(builder.includes(`to: "${resourceName}"`),
      `electron-builder must preserve the ${resourceName} filename`);
  }

  const main = fs.readFileSync(mainPath, 'utf8');
  assert.match(
    main,
    /if \(shouldSetDockIcon\([\s\S]{0,160}\)\) \{\s*app\.dock\.setIcon\(getIconPath\(\)\);/,
    'main.js must gate the Dock override behind the development-only icon policy',
  );
  assert.match(
    main,
    /if \(process\.platform === 'darwin'\) \{\s*icon\.setTemplateImage\(true\);/,
    'macOS Tray icon must be marked as a template image',
  );

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  for (const scriptName of ['prebuild:win', 'prebuild:mac', 'prebuild:linux', 'prebuild:all']) {
    assert.ok(packageJson.scripts[scriptName].includes('npm run check:icons'),
      `${scriptName} must enforce the icon contract`);
  }

  return [
    '1024x1024 app icon master',
    'ICNS generated from the shared master',
    'shared splash icon',
    '16px and 32px macOS template Tray icons',
    'packaging and runtime icon policy',
  ];
}

if (require.main === module) {
  const checks = checkIconContract();
  for (const check of checks) console.log(`PASS ${check}`);
}

module.exports = { checkIconContract, readPngMetadata };
