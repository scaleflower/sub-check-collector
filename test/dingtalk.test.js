const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const test = require('node:test');
const { buildSignedWebhook, sendDingTalkMarkdown } = require('../dist/dingtalk');

test('signs a DingTalk webhook with timestamp and HMAC', () => {
  const signed = new URL(buildSignedWebhook('https://oapi.example/send?token=a', 'secret'));
  const timestamp = signed.searchParams.get('timestamp');
  const expected = crypto.createHmac('sha256', 'secret')
    .update(`${timestamp}\nsecret`)
    .digest('base64');
  assert.equal(signed.searchParams.get('sign'), expected);
});

test('sends a markdown payload and rejects a DingTalk business error', async () => {
  let received;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      received = { url: new URL(req.url, 'http://localhost'), body: JSON.parse(body) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ errcode: 0, errmsg: 'ok' }));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/send`;

  try {
    await sendDingTalkMarkdown({ title: 'Test', text: 'body', webhook: url, secret: 'secret' });
    assert.equal(received.body.msgtype, 'markdown');
    assert.equal(received.body.markdown.title, 'Test');
    assert.equal(received.url.searchParams.has('timestamp'), true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
