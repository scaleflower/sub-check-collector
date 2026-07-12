import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const LOG_DIR = path.join(process.cwd(), 'logs');
const ENV_PATH = path.join(process.cwd(), '.env');
const CONFIG_YAML = '/vol1/1000/Docker/subs-check/config/config.yaml';

interface RunState { running: boolean; lastRun: string|null; lastResult: string|null; }
let state: RunState = { running: false, lastRun: null, lastResult: null };

function readLogTail(n: number = 100): string {
  try {
    const dir = LOG_DIR;
    if (!fs.existsSync(dir)) return '';
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(f => path.join(dir, f.name));
    if (!files.length) return '';
    const c = fs.readFileSync(files[0], 'utf-8');
    return c.split('\n').filter(Boolean).slice(-n).join('\n');
  } catch { return ''; }
}

function runCollector(): Promise<string> {
  return new Promise(r => {
    const child = spawn('node', [path.join(process.cwd(), 'dist', 'index.js'), 'once'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => out += d);
    child.stderr.on('data', (d) => out += d);
    child.on('close', (c) => r(out + '\n[exit: ' + c + ']'));
    child.on('error', (e) => r('error: ' + e.message));
  });
}

function getLinkCount(): number {
  try {
    if (!fs.existsSync(CONFIG_YAML)) return 0;
    const c = fs.readFileSync(CONFIG_YAML, 'utf-8');
    return (c.match(/  - http/g) || []).length;
  } catch { return 0; }
}

function serveHtml(r: http.ServerResponse) {
  r.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  r.end('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subs Check Collector</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f6f8;color:#1a1a2e}.container{max-width:960px;margin:0 auto;padding:24px 16px}.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.header h1{font-size:20px;font-weight:600;display:flex;align-items:center;gap:8px}.header h1 i{color:#4f46e5}.header .links{display:flex;gap:12px}.header .links a{color:#6b7280;text-decoration:none;font-size:13px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}.card{background:#fff;border-radius:8px;padding:16px;border:1px solid #e5e7eb}.card .label{font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}.card .value{font-size:18px;font-weight:600}.badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px}.badge.idle{background:#e0e7ff;color:#4338ca}.badge.running{background:#fef3c7;color:#b45309}.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;font-size:14px;border:1px solid #d1d5db;background:#fff;cursor:pointer}.btn.primary{background:#4f46e5;color:#fff}.btn.primary:disabled{opacity:.6;cursor:not-allowed}.section{background:#fff;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px}.section-header{display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600}.section-body{padding:12px 16px}textarea.editor{width:100%;min-height:240px;font-family:monospace;font-size:12px;padding:8px;border:1px solid #e5e7eb;border-radius:4px;resize:vertical}.log-box{background:#1e1e2e;color:#cdd6f4;font-family:monospace;font-size:12px;padding:12px;border-radius:4px;max-height:360px;overflow-y:auto;white-space:pre-wrap}#toast{position:fixed;bottom:24px;right:24px;background:#1e1e2e;color:#cdd6f4;padding:10px 20px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .3s;z-index:999}#toast.show{opacity:1}}</style></head><body><div class="container"><div class="header"><h1><i class="bi bi-collection"></i>Subs Check Collector</h1><div class="links"><a href="http://192.168.31.123:8199/admin" target="_blank"><i class="bi bi-speedometer2"></i>Subs-Check</a></div></div><div class="cards"><div class="card"><div class="label">\u72b6\u6001</div><div class="value"><span id="badge" class="badge idle">\u7a7a\u95f2</span></div></div><div class="card"><div class="label">\u4e0a\u6b21\u8fd0\u884c</div><div class="value" id="lastRun">--</div></div><div class="card"><div class="label">\u94fe\u63a5</div><div class="value" id="linkCount">--</div></div></div><div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn primary" id="btnRun" onclick="doRun()">\u25b6 \u91c7\u96c6</button><button class="btn" onclick="refresh()">\u21bb \u5237\u65b0</button></div><div class="section"><div class="section-header">\u914d\u7f6e .env</div><div class="section-body"><textarea class="editor" id="cfg" spellcheck="false"></textarea><div style="margin-top:8px;display:flex;gap:8px"><button class="btn primary" onclick="saveCfg()">\u4fdd\u5b58</button><button class="btn" onclick="loadCfg()">\u64a4\u9500</button></div></div></div><div class="section"><div class="section-header">\u65e5\u5fd7</div><div class="section-body" style="padding:8px"><div class="log-box" id="log">\u52a0\u8f7d\u4e2d...</div></div></div></div><div id="toast"></div><script>async function api(u,o){const r=await fetch(u,o);if(!r.ok)throw Error(r.statusText);return r.json()}function $(i){return document.getElementById(i)}async function refresh(){try{const d=await api("/api/status");const b=$("badge");b.className=d.running?"badge running":"badge idle";b.textContent=d.running?"\u8fd0\u884c\u4e2d":"\u7a7a\u95f2";$("lastRun").textContent=d.lastRun||"--";$("linkCount").textContent=d.linkCount||"--"}catch(e){}}async function loadCfg(){try{const d=await api("/api/config");$("cfg").value=d.content||""}catch(e){}}async function saveCfg(){try{const d=await api("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:$("cfg").value})});show("\u5df2\u4fdd\u5b58")}catch(e){show("\u5931\u8d25")}}async function doRun(){const b=$("btnRun");b.disabled=true;b.innerHTML="\u91c7\u96c6\u4e2d...";$("log").textContent="\u6b63\u5728\u91c7\u96c6...";try{const d=await api("/api/run");$("log").textContent=d.output?"\u91c7\u96c6\u5b8c\u6210\\n\\n"+d.output.substring(0,3000):"\u5b8c\u6210";show("\u5df2\u5b8c\u6210");if(d.subsCheck)show("subs-check: "+d.subsCheck.substring(0,100));loadLog()}catch(e){show("\u5931\u8d25: "+e.message);$("log").textContent="\u9519\u8bef: "+e.message}b.disabled=false;b.innerHTML="\u25b6 \u91c7\u96c6";refresh()}async function loadLog(){try{const r=await fetch("/api/logs");const t=await r.json();$("log").textContent=t.text||"(\u7a7a)"}catch(e){}}function show(m){const t=$("toast");t.textContent=m;t.className="show";setTimeout(()=>t.className="",3000)}refresh();loadCfg();loadLog();setInterval(loadLog,5000);setInterval(refresh,10000);<\/script><\/body><\/html>');
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
    const postData = JSON.stringify({});
    const options = {
      hostname: '127.0.0.1',
      port: 8199,
      path: '/api/trigger-check',
      method: 'POST',
      headers: {
        'X-API-Key': 'Hp6230HYK',
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

export function createServer(port: number = 8198) {
  const s = http.createServer(async (req, res) => {
    const u = new URL(req.url || '/', 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
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
        if (req.method === 'GET') { let c = ''; try { c = fs.readFileSync(ENV_PATH, 'utf-8'); } catch {} return serveJson(res, {content: c}); }
        if (req.method === 'POST') { const b = JSON.parse(await readBody(req)); fs.writeFileSync(ENV_PATH, b.content, 'utf-8'); return serveJson(res, {ok: true}); }
      }
      if (p === '/api/run') {
        if (state.running) return serveJson(res, {error: 'running'}, 409);
        state.running = true; state.lastRun = new Date().toLocaleString('zh-CN');
        try { const o = await runCollector(); state.lastResult = 'ok'; state.running = false; return serveJson(res, {output: o}); }
        catch (e: any) { state.lastResult = 'fail: ' + e.message; state.running = false; return serveJson(res, {error: e.message}, 500); }
      }
      res.writeHead(404); res.end('Not found');
    } catch (e: any) { res.writeHead(500); res.end(e.message); }
  });
  s.listen(port, '0.0.0.0');
  console.log('Web panel on http://0.0.0.0:' + port);
  return s;
}
