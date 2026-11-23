// Screenshot tool: serves game/ on a local port, drives headless Chrome over the DevTools
// protocol (SwiftShader WebGL), loads each `?shot=...&seed=1` query from shots.json, waits
// for window.__shotReady and saves a 1280x720 JPEG under 256 KiB.
//
//   node tools/shoot.mjs                       -> every entry of shots.json into screenshots/
//   node tools/shoot.mjs --only chase          -> entries whose name contains "chase"
//   node tools/shoot.mjs --query "?shot=street&seed=1" --file out.jpg
//   --copy <dir>  also copy each JPEG to <dir> (with an optional --prefix)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = join(root, 'game');
const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };

const CHROME = opt('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const PORT = 8731, DEBUG = 9339;
const MAX_BYTES = 256 * 1024 - 2048;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = join(gameDir, p === '/' ? 'index.html' : p);
  if (!f.startsWith(gameDir) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const profile = join(tmpdir(), `heatwave-shoot-${process.pid}`); // fresh profile: no saves from earlier runs
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

async function waitForDebugger() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${DEBUG}/json/version`); if (r.ok) return; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('chrome did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { ok, fail } = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
    else listeners.forEach((l) => l(msg));
  };
  const ready = new Promise((r) => { ws.onopen = r; });
  return {
    ready,
    send: (method, params = {}) => new Promise((ok, fail) => { const k = ++id; pending.set(k, { ok, fail }); ws.send(JSON.stringify({ id: k, method, params })); }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

async function shoot(query, files) {
  const t = await (await fetch(`http://127.0.0.1:${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json();
  const cdp = connect(t.webSocketDebuggerUrl);
  await cdp.ready;
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') console.log('  [page error]', m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning' || m.params.type === 'log')) console.log(`  [console.${m.params.type}]`, m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  const started = Date.now();
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${query}` });
  let ready = false;
  while (Date.now() - started < 240000) {
    await new Promise((r) => setTimeout(r, 400));
    const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true' });
    if (r.result.value) { ready = true; break; }
  }
  if (!ready) console.log('  !! timed out waiting for __shotReady');
  let quality = 86, data;
  for (;;) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
    data = Buffer.from(r.data, 'base64');
    if (data.length <= MAX_BYTES || quality <= 40) break;
    quality -= 6;
  }
  for (const f of files) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); }
  console.log(`${query} -> ${files.join(', ')} (${(data.length / 1024).toFixed(1)} KiB, q${quality}, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
  cdp.close();
  await fetch(`http://127.0.0.1:${DEBUG}/json/close/${t.id}`).catch(() => {});
}

try {
  await waitForDebugger();
  const copy = opt('copy'), prefix = opt('prefix', '');
  if (opt('query')) {
    const files = [resolve(opt('file', join(root, 'out-shot.jpg')))];
    await shoot(opt('query'), files);
  } else {
    const list = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
    const only = opt('only');
    for (const s of list) {
      if (only && !s.name.includes(only)) continue;
      const files = [join(root, 'screenshots', s.name)];
      if (copy) files.push(join(copy, prefix + s.name));
      await shoot(s.query, files);
    }
  }
} finally {
  chrome.kill();
  server.close();
}
