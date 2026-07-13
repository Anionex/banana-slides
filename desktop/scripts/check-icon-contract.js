const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DESKTOP_ICON_RESOURCES,
  SPLASH_ICON_PATH,
} = require('../icon-policy');

const desktopDir = path.resolve(__dirname, '..');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngMetadata(filePath) {
  const data = fs.readFileSync(filePath);
  assert.ok(data.length >= 33, `${filePath} is too small to be a valid PNG`);
  assert.ok(data.subarray(0, 8).equals(pngSignature), `${filePath} is not a PNG file`);
  assert.equal(data.readUInt32BE(8), 13, `${filePath} has an invalid IHDR length`);
  assert.equal(data.subarray(12, 16).toString('ascii'), 'IHDR', `${filePath} has no IHDR header`);
  let dpi = null;
  for (let offset = 8; offset + 12 <= data.length;) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    assert.ok(offset + length + 12 <= data.length,
      `${filePath} has a truncated ${type || 'unknown'} chunk`);
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

function assertPng(filePath, expectedWidth, expectedHeight, expectedDpi = null, expectedColorType = 6) {
  const metadata = readPngMetadata(filePath);
  assert.deepEqual(
    { width: metadata.width, height: metadata.height },
    { width: expectedWidth, height: expectedHeight },
    `${filePath} must be ${expectedWidth}x${expectedHeight}`,
  );
  const colorTypeDescription = expectedColorType === 2
    ? 'an opaque RGB background'
    : 'an RGBA alpha channel';
  assert.equal(metadata.colorType, expectedColorType,
    `${filePath} must retain ${colorTypeDescription}`);
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
  const sectionPattern = new RegExp(`^${sectionName}\\s*:(?:\\s*#.*)?$`);
  const start = lines.findIndex((line) => sectionPattern.test(line));
  assert.notEqual(start, -1, `Missing ${sectionName} section`);
  let end = start + 1;
  while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end += 1;
  return lines.slice(start, end).join('\n');
}

function isVersionAtLeast(versionRange, minimumVersion) {
  const parse = (value) => {
    const match = String(value).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
  };
  const version = parse(versionRange);
  const minimum = parse(minimumVersion);
  if (!version || !minimum) return false;
  for (let index = 0; index < minimum.length; index += 1) {
    if (version[index] !== minimum[index]) return version[index] > minimum[index];
  }
  return true;
}

function assertIconComposer(composerPath) {
  const manifestPath = path.join(composerPath, 'icon.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const fills = manifest['fill-specializations'];
  assert.ok(Array.isArray(fills), `${manifestPath} must define adaptive background fills`);

  const defaultFill = fills.find((fill) => !fill.appearance);
  const darkFill = fills.find((fill) => fill.appearance === 'dark');
  assert.equal(defaultFill?.value?.solid, 'srgb:1.00000,1.00000,1.00000,1.00000',
    'Default Icon Composer appearance must use a white background');
  assert.equal(darkFill?.value?.solid, 'srgb:0.06667,0.06667,0.06667,1.00000',
    'Dark Icon Composer appearance must use a #111111 background');

  const layers = (manifest.groups || []).flatMap((group) => group.layers || []);
  const brandFileName = path.basename(DESKTOP_ICON_RESOURCES.brandPng);
  const brandLayer = layers.find((layer) => layer['image-name'] === brandFileName);
  assert.ok(brandLayer, `Icon Composer must use ${brandFileName}`);
  assert.ok(brandLayer.position?.scale > 0 && brandLayer.position.scale <= 0.8,
    'Icon Composer foreground must stay inside the macOS safe zone');
}

function checkIconContract(rootDir = desktopDir) {
  const resourcesDir = path.join(rootDir, 'resources');
  const fallbackPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.appPng);
  const brandPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.brandPng);
  const composerPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macComposer);
  const trayPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macTray);
  const tray2xPath = path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macTray2x);
  const splashPath = path.join(rootDir, 'splash.html');
  const builderPath = path.join(rootDir, 'electron-builder.yml');
  const mainPath = path.join(rootDir, 'main.js');
  const packagePath = path.join(rootDir, 'package.json');

  assertPng(fallbackPath, 1024, 1024, null, 2);
  assertPng(brandPath, 1024, 1024);
  assertPng(trayPath, 16, 16, 72);
  assertPng(tray2xPath, 32, 32, 144);
  assertIconComposer(composerPath);
  assert.ok(!fs.existsSync(path.join(resourcesDir, DESKTOP_ICON_RESOURCES.macBundle)),
    'Do not track a stale legacy ICNS; electron-builder generates the fallback from Icon Composer');

  const splash = fs.readFileSync(splashPath, 'utf8');
  assert.ok(splash.includes(`src="${SPLASH_ICON_PATH}"`),
    `Splash must use the shared ${SPLASH_ICON_PATH} master`);
  assert.ok(!fs.existsSync(path.join(rootDir, 'logo.png')), 'Remove the legacy desktop/logo.png asset');
  assert.ok(splash.includes('@media (prefers-color-scheme: dark)'),
    'Splash must follow the system light/dark appearance');
  assert.ok(splash.includes('--icon-background: #ffffff'),
    'Splash light appearance must use a white icon background');
  assert.ok(splash.includes('--icon-background: #111111'),
    'Splash dark appearance must use a #111111 icon background');

  const builder = fs.readFileSync(builderPath, 'utf8');
  const filesSection = readTopLevelYamlSection(builder, 'files');
  assert.ok(!filesSection.includes('resources/icon.icns'), 'Do not duplicate icon.icns inside app.asar');
  assert.ok(!filesSection.includes('resources/icon.ico'), 'Do not duplicate icon.ico inside app.asar');
  assert.ok(filesSection.includes(`resources/${DESKTOP_ICON_RESOURCES.brandPng}`),
    'Splash brand artwork must be packaged inside app.asar');
  assert.ok(filesSection.includes(`resources/${DESKTOP_ICON_RESOURCES.appPng}`),
    'Default fallback icon must be packaged inside app.asar');
  const macSection = readTopLevelYamlSection(builder, 'mac');
  assert.match(macSection, /^\s{2}icon: resources\/BananaSlides\.icon$/m,
    'mac.icon must use the adaptive Icon Composer asset');
  assert.match(macSection, /^\s{2}darkModeSupport: true$/m,
    'mac.darkModeSupport must allow the system to select the dark icon appearance');
  for (const resourceName of [DESKTOP_ICON_RESOURCES.macTray, DESKTOP_ICON_RESOURCES.macTray2x]) {
    assert.ok(builder.includes(`from: "resources/${resourceName}"`),
      `electron-builder must package resources/${resourceName}`);
    assert.ok(builder.includes(`to: "${resourceName}"`),
      `electron-builder must preserve the ${resourceName} filename`);
  }

  const main = fs.readFileSync(mainPath, 'utf8');
  assert.match(
    main,
    /if \(app\.dock && shouldSetDockIcon\([\s\S]{0,160}\)\) \{\s*app\.dock\.setIcon\(getIconPath\(\)\);/,
    'main.js must gate the Dock override behind the development-only icon policy',
  );
  assert.match(
    main,
    /if \(usesTemplateImage\) \{\s*icon\.setTemplateImage\(true\);/,
    'macOS Tray icon must be marked as a template image',
  );
  assert.match(
    main,
    /} else if \(process\.platform === 'linux' \|\| usesFallbackImage\) \{\s*icon = icon\.resize\(\{ width: 16, height: 16 \}\);/,
    'only a large PNG Tray icon should be resized',
  );
  assert.ok(main.includes('if (icon.isEmpty())'), 'Tray icon loading must handle missing or corrupt files');
  assert.ok(main.includes("backgroundColor: nativeTheme.shouldUseDarkColors ? '#111111' : '#ffffff'"),
    'Splash BrowserWindow background must match the active icon appearance');

  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.ok(isVersionAtLeast(packageJson.devDependencies['electron-builder'], '26.3.0'),
    'electron-builder 26.3.0 or newer is required for Icon Composer assets');
  for (const scriptName of ['prebuild:win', 'prebuild:mac', 'prebuild:linux', 'prebuild:all']) {
    assert.ok(packageJson.scripts[scriptName].includes('npm run check:icons'),
      `${scriptName} must enforce the icon contract`);
  }

  return [
    'white legacy app icon fallback',
    'adaptive white and near-black Icon Composer appearances',
    'shared adaptive splash artwork',
    '16px and 32px macOS template Tray icons',
    'packaging and runtime icon policy',
  ];
}

if (require.main === module) {
  const checks = checkIconContract();
  for (const check of checks) console.log(`PASS ${check}`);
}

module.exports = {
  assertIconComposer,
  assertPng,
  checkIconContract,
  isVersionAtLeast,
  readPngMetadata,
  readTopLevelYamlSection,
};
