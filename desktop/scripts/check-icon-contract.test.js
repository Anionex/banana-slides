const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertCommandSucceeded,
  assertPixelBuffersClose,
  checkIconContract,
  readPngMetadata,
  readTopLevelYamlSection,
} = require('./check-icon-contract');

test('desktop icon assets and packaging follow one contract', () => {
  const checks = checkIconContract();

  assert.equal(checks.length, 5);
  assert.ok(checks.includes('ICNS generated from the shared master'));
  assert.ok(checks.includes('16px and 32px macOS template Tray icons'));
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

test('command failures include spawn errors', () => {
  assert.throws(
    () => assertCommandSucceeded({
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('spawn iconutil ENOENT'),
    }, 'iconutil'),
    /spawn iconutil ENOENT/,
  );
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

test('pixel comparison tolerates color-profile rounding but rejects different images', () => {
  const expected = Buffer.from([10, 20, 30, 255, 40, 50, 60, 255]);
  assert.doesNotThrow(() => assertPixelBuffersClose(
    Buffer.from([11, 20, 29, 255, 40, 51, 60, 255]),
    expected,
    'close pixels',
  ));
  assert.throws(() => assertPixelBuffersClose(
    Buffer.from([50, 60, 70, 255, 80, 90, 100, 255]),
    expected,
    'different pixels',
  ), /max channel delta/);
});
