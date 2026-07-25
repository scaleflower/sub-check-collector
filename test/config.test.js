const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../dist/config');

test('parses common enabled and disabled boolean environment values', () => {
  const original = process.env.VALIDATE_LINKS;

  try {
    for (const value of ['true', 'TRUE', 'yes', '1', 'on']) {
      process.env.VALIDATE_LINKS = value;
      assert.equal(loadConfig().validateLinks, true, `${value} should enable validation`);
    }

    for (const value of ['false', 'FALSE', 'no', '0', 'off']) {
      process.env.VALIDATE_LINKS = value;
      assert.equal(loadConfig().validateLinks, false, `${value} should disable validation`);
    }
  } finally {
    if (original === undefined) {
      delete process.env.VALIDATE_LINKS;
    } else {
      process.env.VALIDATE_LINKS = original;
    }
  }
});
