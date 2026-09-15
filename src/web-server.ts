import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import { buildSubsCheckMessage, sendDingTalkMarkdown } from './dingtalk';

interface RunState { running: boolean; lastRun: string|null; lastResult: string|null; }
let state: RunState = { running: false, lastRun: null, lastResult: null };
type CollectorRunner = (onOutput: (chunk: string) => void) => Promise<string>;
interface SchedulerHandle {
  start(): void;
  stop(): void;
  setHooks(hooks: { onRunStart?: () => void; onRunEnd?: (error?: unknown) => void }): void;
}
const MAX_LIVE_OUTPUT_CHARS = 200_000;
let liveOutput = '';

function logDir(): string {
  return path.join(process.cwd(), 'logs');
}

function envPath(): string {
  return path.join(process.cwd(), '.env');
}

function appendLiveOutput(chunk: string): void {
  liveOutput = (liveOutput + chunk).slice(-MAX_LIVE_OUTPUT_CHARS);
}

function readLogTail(n: number = 100): string {
  try {
    if (liveOutput) {
      return liveOutput.split('\n').filter(Boolean).slice(-n).join('\n');
    }
    const dir = logDir();
    if (!fs.existsSync(dir)) return '';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.log')).sort().reverse();
    if (!files.length) return '';
    const c = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    return c.split('\n').filter(Boolean).slice(-n).join('\n');
  } catch { return ''; }
}

function runCollector(onOutput: (chunk: string) => void): Promise<string> {
  return new Promise(r => {
    const child = spawn('node', [path.join(process.cwd(), 'dist', 'index.js'), 'once'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => {
      const chunk = d.toString();
      out += chunk;
      onOutput(chunk);
    });
    child.stderr.on('data', (d) => {
      const chunk = d.toString();
      out += chunk;
      onOutput(chunk);
    });
    child.on('close', (c) => r(out + '\n[exit: ' + c + ']'));
    child.on('error', (e) => r('error: ' + e.message));
  });
}

function getLinkCount(): number {
  try {
    const configFile = process.env.CONFIG_YAML_PATH || './config.yaml';
    if (!fs.existsSync(configFile)) return 0;
    const c = fs.readFileSync(configFile, 'utf-8');
    return (c.match(/  - http/g) || []).length;
  } catch { return 0; }
}

function subsCheckPanelLink(): string {
  const url = process.env.SUBS_CHECK_PANEL_URL;
  if (!url) return '';
  return '<a href="' + url + '" target="_blank"><i class="bi bi-speedometer2"></i>Subs-Check 面板</a>';
}

function serveHtml(r: http.ServerResponse) {
  r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  r.end('<!DOCTYPE html>' +
    '<html lang="zh-CN"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Subs Check Collector</title>' +
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">' +
    '<style>' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;background:#f5f6f8;color:#1a1a2e}' +
    '.container{max-width:960px;margin:0 auto;padding:24px 16px}' +
    '.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}' +
    '.header h1{font-size:20px;font-weight:600;display:flex;align-items:center;gap:8px}' +
    '.header h1 i{color:#4f46e5}' +
    '.header .links{display:flex;gap:12px}' +
    '.header .links a{color:#6b7280;text-decoration:none;font-size:13px}' +
    '.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}' +
    '.card{background:#fff;border-radius:8px;padding:16px;border:1px solid #e5e7eb}' +
    '.card .label{font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}' +
    '.card .value{font-size:18px;font-weight:600}' +
    '.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:500}' +
    '.badge.idle{background:#e0e7ff;color:#4338ca}' +
    '.badge.running{background:#fef3c7;color:#b45309}' +
    '.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-size:14px;font-weight:500;border:1px solid #d1d5db;background:#fff;cursor:pointer}' +
    '.btn.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}' +
    '.btn.primary:hover{background:#4338ca}' +
    '.btn.primary:disabled{opacity:.6;cursor:not-allowed}' +
    '.section{background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px}' +
    '.section-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600}' +
    '.section-body{padding:12px 16px}' +
    'textarea.editor{width:100%;min-height:240px;font-family:monospace;font-size:12px;padding:8px;border:1px solid #e5e7eb;border-radius:4px;resize:vertical}' +
    '.log-box{background:#1e1e2e;color:#cdd6f4;font-family:monospace;font-size:12px;padding:12px;border-radius:4px;max-height:360px;overflow-y:auto;white-space:pre-wrap}' +
    '#toast{position:fixed;bottom:24px;right:24px;background:#1e1e2e;color:#cdd6f4;padding:10px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;z-index:999}' +
    '#toast.show{opacity:1}' +
    '@media(max-width:640px){.cards{grid-template-columns:1fr}}' +
    '</style></head><body>' +
    '<div class="container">' +
    '<div class="header"><h1><i class="bi bi-collection"></i>Subs Check Collector</h1>' +
    '<div class="links">' +
    subsCheckPanelLink() +
    '</div></div>' +

    // status cards
    '<div class="cards">' +
    '<div class="card"><div class="label">状态</div><div class="value"><span id="badge" class="badge idle">空闲</span></div><div class="sub" id="detail">等待操作</div></div>' +
    '<div class="card"><div class="label">上次运行</div><div class="value" id="lastRun">--</div></div>' +
    '<div class="card"><div class="label">订阅链接</div><div class="value" id="linkCount">--</div></div>' +
    '</div>' +

    // toolbar
    '<div class="toolbar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">' +
    '<button class="btn primary" id="btnRun"><i class="bi bi-play-fill"></i> 立即采集</button>' +
    '<button class="btn" onclick="refreshAll()"><i class="bi bi-arrow-repeat"></i> 刷新</button>' +
    '</div>' +

    // config section
    '<div class="section"><div class="section-header"><i class="bi bi-gear"></i> 配置 (.env)</div>' +
    '<div class="section-body"><textarea class="editor" id="configEditor" spellcheck="false"></textarea>' +
    '<div style="margin-top:8px;display:flex;gap:8px">' +
    '<button class="btn primary" onclick="saveCfg()"><i class="bi bi-floppy"></i> 保存</button>' +
    '<button class="btn" onclick="loadCfg()"><i class="bi bi-x-circle"></i> 撤销</button>' +
    '</div></div></div>' +

    // log section
    '<div class="section"><div class="section-header"><i class="bi bi-terminal"></i> 最近日志</div>' +
    '<div class="section-body" style="padding:8px"><div class="log-box" id="logViewer">加载中...</div></div></div>' +
    '</div>' +
    '<div id="toast"></div>' +
    '<script>' +
    'async function api(u,o){const r=await fetch(u,o);if(!r.ok)throw Error(r.statusText);return r.json()}' +
    'function $(id){return document.getElementById(id)}' +
    'async function refreshAll(){' +
    'try{const d=await api("/api/status");const b=$("badge");' +
    'b.className=d.running?"badge running":"badge idle";' +
    'b.textContent=d.running?"运行中":"空闲";' +
    '$("detail").textContent=d.running?"正在采集...":"就绪";' +
    '$("lastRun").textContent=d.lastRun||"--";' +
    '$("linkCount").textContent=d.linkCount||"--";' +
    '}catch(e){show("状态失败")}}' +
    'async function loadCfg(){try{const d=await api("/api/config");$("configEditor").value=d.content||""}catch(e){show("读取失败")}}' +
    'async function saveCfg(){try{const d=await api("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:$("configEditor").value})});show("已保存")}catch(e){show("保存失败")}}' +
    'async function doRun(){const b=$("btnRun");b.disabled=true;b.innerHTML="采集中...";$("logViewer").textContent="正在采集，请稍候...";' +
    'try{const d=await api("/api/run");$("logViewer").textContent=d.output||"完成";show("采集完成");loadLogs()}catch(e){show("失败: "+e.message);$("logViewer").textContent="错误: "+e.message}' +
    'b.disabled=false;b.innerHTML="&#9654; 立即采集";refreshAll()}' +
    'async function loadLogs(){try{const r=await fetch("/api/logs");const t=await r.json();$("logViewer").textContent=t.text||"(空)";}catch(e){}}' +
    'function show(m){const t=$("toast");t.textContent=m;t.className="show";setTimeout(()=>t.className="",3000)}' +
    '$("btnRun").addEventListener("click",doRun);' +
    'refreshAll();loadCfg();loadLogs();setInterval(loadLogs,5000);setInterval(refreshAll,10000);' +
    '</script></body></html>');
}

function serveJson(r: http.ServerResponse, d: any, c?: number) {
  r.writeHead(c || 200, {'Content-Type': 'application/json; charset=utf-8'});
  r.end(JSON.stringify(d));
}

function readBody(r: http.IncomingMessage): Promise<string> {
  return new Promise(res => { let b = ""; r.on('data', (c) => b += c); r.on('end', () => res(b)); });
}


function triggerSubsCheck(): Promise<string> {
  return new Promise((resolve) => {
    const apiKey = process.env.SUBS_CHECK_API_KEY;
    if (!apiKey) {
      resolve('subs-check trigger failed: SUBS_CHECK_API_KEY is not configured');
      return;
    }
    const host = process.env.SUBS_CHECK_HOST || '127.0.0.1';
    const port = Number(process.env.SUBS_CHECK_PORT || 8199);
    const postData = JSON.stringify({});
    const options = {
      hostname: host,
      port,
      path: '/api/trigger-check',
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve("subs-check triggered: " + data));
    });
    req.on("error", (e) => resolve("subs-check trigger failed: " + e.message));
    req.write(postData);
    req.end();
  });
}

function unauthorized(res: http.ServerResponse): void {
  res.writeHead(401, {
    'Content-Type': 'application/json; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="Subs Check Collector", charset="UTF-8"'
  });
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

export function createServer(
  port: number = 8198,
  collectorRunner?: CollectorRunner,
  scheduler?: SchedulerHandle,
  notifySubsCheck?: (successCount: number) => Promise<void>
) {
  const runner = collectorRunner || runCollector;
  const authUsername = process.env.WEB_AUTH_USERNAME || '';
  const authPassword = process.env.WEB_AUTH_PASSWORD || '';

  const handleSubsCheckCallback = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const callbackToken = process.env.SUBS_CHECK_CALLBACK_TOKEN || '';
    const providedToken = String(req.headers['x-callback-token'] || '');
    const tokenMatches = callbackToken.length > 0 &&
      providedToken.length === callbackToken.length &&
      crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(callbackToken));
    if (!tokenMatches) return serveJson(res, { error: 'unauthorized' }, 401);

    const body = JSON.parse(await readBody(req)) as { successCount?: number };
    const successCount = Number(body.successCount);
    if (!Number.isInteger(successCount) || successCount < 0) {
      return serveJson(res, { error: 'successCount must be a non-negative integer' }, 400);
    }
    await (notifySubsCheck || (async (count: number) => {
      const webhook = process.env.DINGTALK_WEBHOOK;
      if (!webhook) throw new Error('DINGTALK_WEBHOOK is not configured');
      const message = buildSubsCheckMessage(count);
      await sendDingTalkMarkdown({
        ...message,
        webhook,
        secret: process.env.DINGTALK_SECRET,
      });
    }))(successCount);
    return serveJson(res, { ok: true });
  };

  const s = http.createServer(async (req, res) => {
    const u = new URL(req.url || '/', 'http://localhost');
    if (u.pathname === '/internal/notify/subs-check' && req.method === 'POST') {
      return handleSubsCheckCallback(req, res);
    }

    if (!authUsername || !authPassword) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'web authentication is not configured' }));
      return;
    }

    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Basic (.+)$/i);
    let authorized = false;
    if (match) {
      try {
        const [user, ...passwordParts] = Buffer.from(match[1], 'base64').toString('utf-8').split(':');
        const password = passwordParts.join(':');
        const userMatches = user.length === authUsername.length &&
          crypto.timingSafeEqual(Buffer.from(user), Buffer.from(authUsername));
        const passwordMatches = password.length === authPassword.length &&
          crypto.timingSafeEqual(Buffer.from(password), Buffer.from(authPassword));
        authorized = userMatches && passwordMatches;
      } catch {
        authorized = false;
      }
    }
    if (!authorized) return unauthorized(res);

    try {
      const p = u.pathname;
      if (p === '/' || p === '/index.html') return serveHtml(res);
      if (p === '/api/status') return serveJson(res, {...state, linkCount: getLinkCount()});
      if (p === '/api/logs') {
        const n = parseInt(u.searchParams.get('lines') || '100');
        const t = readLogTail(n);
        if (u.searchParams.get('raw') === '1') { res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'}); res.end(t); return; }
        return serveJson(res, {text: t});
      }
      if (p === '/api/config') {
                if (req.method === 'GET') { let c = ''; try { c = fs.readFileSync(envPath(), 'utf-8'); } catch {} return serveJson(res, {content: c}); }
                if (req.method === 'POST') { const b = JSON.parse(await readBody(req)); fs.writeFileSync(envPath(), b.content, 'utf-8'); return serveJson(res, {ok: true}); }
      }
      if (p === '/api/run') {
        if (state.running) return serveJson(res, {error: 'running'}, 409);
        state.running = true; state.lastRun = new Date().toLocaleString('zh-CN');
        liveOutput = '';
        try { const o = await runner(appendLiveOutput); state.lastResult = 'ok'; state.running = false; return serveJson(res, {output: o}); }
        catch (e: any) { state.lastResult = 'fail: ' + e.message; state.running = false; return serveJson(res, {error: e.message}, 500); }
      }
      res.writeHead(404); res.end('Not found');
    } catch (e: any) { res.writeHead(500); res.end(e.message); }
  });
  if (scheduler) {
    scheduler.setHooks({
      onRunStart: () => {
        state.running = true;
        state.lastRun = new Date().toLocaleString('zh-CN');
        liveOutput = '';
      },
      onRunEnd: (error) => {
        state.running = false;
        state.lastResult = error ? 'fail' : 'ok';
      }
    });
    scheduler.start();
  }

  if (!authUsername || !authPassword) {
    console.warn('WEB_AUTH_USERNAME and WEB_AUTH_PASSWORD must be configured; all web requests are rejected.');
  }

  s.listen(port, '0.0.0.0');
  console.log('Web panel on http://0.0.0.0:' + port);
  return s;
}
