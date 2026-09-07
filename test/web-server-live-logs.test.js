const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createServer } = require('../dist/web-server.js');

test('exposes collector output through the logs API before collection completes', async () => {
  const originalCwd = process.cwd();
  const emptyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-web-test-'));
  process.chdir(emptyCwd);
  process.env.WEB_AUTH_USERNAME = 'tester';
  process.env.WEB_AUTH_PASSWORD = 'secret';
  const auth = `Basic ${Buffer.from('tester:secret').toString('base64')}`;

  let finishCollector;
  const collectorFinished = new Promise(resolve => {
    finishCollector = resolve;
  });

  const server = createServer(0, async onOutput => {
    onOutput('LIVE_PROGRESS_MARKER\n');
    await collectorFinished;
    return 'done';
  });

  try {
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthorized = await fetch(`${baseUrl}/api/status`);
    assert.equal(unauthorized.status, 401);

    const runRequest = fetch(`${baseUrl}/api/run`, { headers: { authorization: auth } });
    await new Promise(resolve => setTimeout(resolve, 50));

    const logsResponse = await fetch(`${baseUrl}/api/logs`, { headers: { authorization: auth } });
    const logs = await logsResponse.json();
    assert.match(logs.text, /LIVE_PROGRESS_MARKER/);

    finishCollector();
    const runResponse = await runRequest;
    assert.equal(runResponse.status, 200);
  } finally {
    finishCollector?.();
    await new Promise(resolve => server.close(resolve));
    process.chdir(originalCwd);
    fs.rmSync(emptyCwd, { recursive: true, force: true });
  }
});
