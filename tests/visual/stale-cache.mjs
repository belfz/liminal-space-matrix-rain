// The game must start after an update even when the browser serves src/world.js from cache
// (servers like T3 Code's preview send Cache-Control: max-age=3600, and a normal reload only
// revalidates the page itself). Loads OLD_REV, swaps in the working tree, reloads, checks it runs.
// Usage: node stale-cache.mjs <old-git-rev>
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';

const oldRev = process.argv[2];
const root = mkdtempSync(join(tmpdir(), 'lr-cache-'));
mkdirSync(join(root, 'src'));
const put = (rel, content) => writeFileSync(join(root, rel), content);
for (const f of ['index.html', 'src/world.js']) put(f, execFileSync('git', ['show', `${oldRev}:${f}`]));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = readFileSync(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'private, max-age=3600' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const profile = mkdtempSync(join(tmpdir(), 'lr-cache-prof-'));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--window-size=800,450', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = false, msg = '';
try {
  let tabs;
  for (let i = 0; i < 50 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); let errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description?.split('\n')[0]); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
  await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url }); await sleep(2500);
  // Update to the working tree, then a normal (non-forced) reload.
  // Every current file: the page plus all of src/ (new scripts appear over time).
  for (const f of ['index.html', ...readdirSync('src').map((n) => 'src/' + n)]) put(f, readFileSync(f));
  errors = [];
  await send('Page.reload', { ignoreCache: false }); await sleep(3000);
  const started = await ev(`typeof LR === 'object' && !!document.querySelector('[data-density].on')`);
  ok = started === true && errors.length === 0;
  msg = `started=${started} uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); server.close(); await sleep(200);
rmSync(profile, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} starts after update despite cached world.js (${msg})`);
process.exit(ok ? 0 : 1);
