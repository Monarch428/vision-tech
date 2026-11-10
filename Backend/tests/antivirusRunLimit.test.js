const test = require('node:test');
const assert = require('node:assert/strict');

const { getAntivirusRunLimit, canRunAntivirusScan } = require('../src/utils/antivirusRunLimit');

test('default scan limit resolves to a positive number', () => {
  assert.equal(getAntivirusRunLimit(), 3);
});

test('scan is blocked once completed scans reach the configured limit', () => {
  assert.equal(canRunAntivirusScan(3, 3), false);
  assert.equal(canRunAntivirusScan(2, 3), true);
  assert.equal(canRunAntivirusScan(0, 0), true);
});
