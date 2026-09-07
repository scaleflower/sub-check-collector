const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createServer } = require('../dist/web-server.js');

test('reflects scheduled collection state in the status API', async () => {
  const originalCwd = process.cwd();
  const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-scheduler-test-'));
  process.chdir(emptyCwd);
  process.env.WEB_AUTH_USERNAME = 'tester';
  process.env.WEB_AUTH_PASSWORD = 'secret';
  const authorization = `Basic ${Buffer.from('tester:secret').toString('base64')}`;

  let hooks;
  const scheduler = {
    setHooks(value) { hooks = value; },
    start() { this.started = true; },
    stop() { this.stopped = true; }
  };
  const server = createServer(0, async () => 'done', scheduler);

  try {
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    assert.equal(scheduler.started, true);

    const before = await (await fetch(`${baseUrl}/api/status`, { headers: { authorization } })).json();
    assert.equal(before.running, false);

    hooks.onRunStart();
    const running = await (await fetch(`${baseUrl}/api/status`, { headers: { authorization } })).json();
    assert.equal(running.running, true);
    assert.match(running.lastRun, /\d/);

    hooks.onRunEnd(new Error('scheduled failure'));
    const after = await (await fetch(`${baseUrl}/api/status`, { headers: { authorization } })).json();
    assert.equal(after.running, false);
    assert.equal(after.lastResult, 'fail');
  } finally {
    await new Promise(resolve => server.close(resolve));
    scheduler.stop();
    process.chdir(originalCwd);
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  }
});
