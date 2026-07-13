const assert = require('node:assert/strict');
const test = require('node:test');
const { checkIconContract } = require('./check-icon-contract');

test('desktop icon assets and packaging follow one contract', () => {
  const checks = checkIconContract();

  assert.equal(checks.length, 5);
  assert.ok(checks.includes('ICNS generated from the shared master'));
  assert.ok(checks.includes('16px and 32px macOS template Tray icons'));
});
