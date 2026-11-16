// Main menu: the rain-density setting can be chosen without entering, is remembered, and is
// applied. Usage: node menu.mjs <file-url>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const profile = mkdtempSync(join(tmpdir(), 'lr-menu-'));
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
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(2000);
  const def = await ev('LR.settings && LR.settings.density');
  const btn = await ev(`(() => { const b = document.querySelector('[data-density="3"]'); if (!b) return null;
    const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  if (!btn) throw new Error('no density=3 button');
  await click(btn[0], btn[1]); await sleep(300);
  const after = await ev('LR.settings.density');
  const stillMenu = !(await ev(`document.getElementById('overlay').classList.contains('hidden')`));
  const selected = await ev(`document.querySelector('[data-density="3"]').classList.contains('on')`);
  await send('Page.reload'); await sleep(2000);
  const remembered = await ev('LR.settings.density');
  ok = def === 2 && after === 3 && stillMenu && selected && remembered === 3 && errors.length === 0;
  msg = `default=${def} after=${after} menuStillOpen=${stillMenu} selected=${selected} afterReload=${remembered} uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); await sleep(200); rmSync(profile, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} density menu setting (${msg})`);
process.exit(ok ? 0 : 1);
