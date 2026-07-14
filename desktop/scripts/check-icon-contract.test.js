const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertIconComposer,
  assertPng,
  checkIconContract,
  isVersionAtLeast,
  readPngMetadata,
  readTopLevelYamlSection,
} = require('./check-icon-contract');

test('desktop icon assets and packaging follow one contract', () => {
  const checks = checkIconContract();

  assert.equal(checks.length, 5);
  assert.ok(checks.includes('adaptive white and near-black Icon Composer appearances'));
  assert.ok(checks.includes('16px and 32px macOS template Tray icons'));
});

test('legacy app icon fallback must be opaque to avoid the macOS gray backplate', () => {
  const transparentPng = path.resolve(__dirname, '../resources/trayTemplate.png');

  assert.throws(
    () => assertPng(transparentPng, 16, 16, 72, 2),
    /opaque RGB background/,
  );
});

test('Icon Composer contract rejects a drifting dark appearance', () => {
  const sourcePath = path.resolve(__dirname, '../resources/BananaSlides.icon');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-icon-composer-'));
  const composerPath = path.join(tempDir, 'BananaSlides.icon');
  try {
    fs.cpSync(sourcePath, composerPath, { recursive: true });
    const manifestPath = path.join(composerPath, 'icon.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest['fill-specializations'][1].value.solid = 'srgb:0.00000,0.00000,0.00000,1.00000';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    assert.throws(
      () => assertIconComposer(composerPath),
      /#111111 background/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('electron-builder version ranges may omit the patch component', () => {
  assert.equal(isVersionAtLeast('^26.15', '26.3.0'), true);
  assert.equal(isVersionAtLeast('~26.2', '26.3.0'), false);
  assert.equal(isVersionAtLeast('invalid', '26.3.0'), false);
});

test('PNG metadata parser reports a truncated chunk without a RangeError', () => {
  const sourcePath = path.resolve(__dirname, '../resources/trayTemplate.png');
  const source = fs.readFileSync(sourcePath);
  const chunkTypeOffset = source.indexOf(Buffer.from('pHYs'));
  assert.notEqual(chunkTypeOffset, -1);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-truncated-png-'));
  const truncatedPath = path.join(tempDir, 'truncated.png');
  try {
    fs.writeFileSync(truncatedPath, source.subarray(0, chunkTypeOffset + 8));
    assert.throws(
      () => readPngMetadata(truncatedPath),
      /truncated pHYs chunk/,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('PNG metadata parser rejects files shorter than an IHDR chunk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-short-png-'));
  const shortPath = path.join(tempDir, 'short.png');
  try {
    fs.writeFileSync(shortPath, Buffer.alloc(16));
    assert.throws(() => readPngMetadata(shortPath), /too small to be a valid PNG/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('YAML section reader accepts spacing and an inline comment', () => {
  const source = 'files  : # packaged files\n  - "main.js"\n\nmac:\n  icon: icon.icns\n';

  assert.equal(
    readTopLevelYamlSection(source, 'files'),
    'files  : # packaged files\n  - "main.js"\n',
  );
});
