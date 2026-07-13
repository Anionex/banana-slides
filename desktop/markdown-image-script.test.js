const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { assertSafeOutputDirectory } = require('./scripts/test-markdown-image-macos');

test('desktop Markdown test only deletes nested temporary directories', () => {
  const safePath = path.join(os.tmpdir(), `banana-desktop-markdown-${process.pid}`);
  assert.equal(assertSafeOutputDirectory(safePath), path.resolve(safePath));
});

test('desktop Markdown test rejects critical or unrelated directories', () => {
  const unsafePaths = [
    path.parse(process.cwd()).root,
    os.tmpdir(),
    process.env.HOME,
    process.cwd(),
  ].filter(Boolean);

  for (const unsafePath of unsafePaths) {
    assert.throws(
      () => assertSafeOutputDirectory(unsafePath),
      /Unsafe output directory/,
    );
  }
});
