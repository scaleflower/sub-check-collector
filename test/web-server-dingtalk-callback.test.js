const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createServer } = require('../dist/web-server');

test('accepts an authorized subs-check callback and forwards the node count', async () => {
  const originalCwd = process.cwd();
  const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-dingtalk-test-'));
  process.chdir(emptyCwd);
  process.env.WEB_AUTH_USERNAME = 'tester';
  process.env.WEB_AUTH_PASSWORD = 'secret';
  process.env.SUBS_CHECK_CALLBACK_TOKEN = 'callback-token';

  const notifications = [];
  const notifySubsCheck = async successCount => {
    notifications.push(successCount);
  };
  const server = createServer(0, async () => 'done', undefined, notifySubsCheck);

  try {
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const denied = await fetch(`${baseUrl}/internal/notify/subs-check`, {
      method: 'POST',
      headers: { 'x-callback-token': 'invalid' },
      body: JSON.stringify({ successCount: 10 })
    });
    assert.equal(denied.status, 401);

    const accepted = await fetch(`${baseUrl}/internal/notify/subs-check`, {
      method: 'POST',
      headers: { 'x-callback-token': 'callback-token' },
      body: JSON.stringify({ successCount: 190 })
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(notifications, [190]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    process.chdir(originalCwd);
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  }
});
