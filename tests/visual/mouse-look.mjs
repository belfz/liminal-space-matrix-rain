// Mouse look must work after "click to enter" even when the browser refuses pointer lock
// (headless Chrome always refuses, so this exercises the fallback). Usage: node mouse-look.mjs <file-url>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const profile = mkdtempSync(join(tmpdir(), 'lr-ml-'));
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
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, ...extra });
  await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(2500);
  await mouse('mouseMoved', 400, 225);
  await mouse('mousePressed', 400, 225, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', 400, 225, { button: 'left', clickCount: 1 });
  await sleep(600);
  const a0 = await ev('LR.state.angle');
  const hidden = await ev(`document.getElementById('overlay').classList.contains('hidden')`);
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', 400 + i * 20, 225); await sleep(30); }
  await sleep(200);
  const a1 = await ev('LR.state.angle');
  // Full 360 without pointer lock: resting the cursor at the right edge keeps turning.
  await mouse('mouseMoved', 795, 225); await sleep(100);
  const e0 = await ev('LR.state.angle'); await sleep(1000);
  const e1 = await ev('LR.state.angle');
  // ...and resting in the middle does not.
  await mouse('mouseMoved', 400, 225); await sleep(100);
  const m0 = await ev('LR.state.angle'); await sleep(500);
  const m1 = await ev('LR.state.angle');
  // Vertical look: moving the mouse up tilts the view up; resting at the top edge keeps tilting
  // up to a cap below straight up; resting at the bottom edge tilts down.
  const p0 = await ev('LR.state.pitch');
  for (let i = 1; i <= 5; i++) { await mouse('mouseMoved', 400, 225 - i * 20); await sleep(30); }
  await sleep(100);
  const p1 = await ev('LR.state.pitch');
  await mouse('mouseMoved', 400, 2); await sleep(1500);
  const pTop = await ev('LR.state.pitch');
  const vh = await ev('innerHeight');
  await mouse('mouseMoved', 400, vh - 2); await sleep(2500);
  const pBottom = await ev('LR.state.pitch');
  const vOk = typeof p0 === 'number' && p1 > p0 + 0.1 && pTop > 1.3 && pTop < Math.PI / 2 && pBottom < -1.3 && pBottom > -Math.PI / 2;
  ok = hidden && a1 > a0 + 0.1 && e1 > e0 + 0.5 && Math.abs(m1 - m0) < 1e-9 && vOk && errors.length === 0;
  msg = `overlay hidden=${hidden} drag ${a0}->${a1} edge ${e0}->${e1} centre ${m0}->${m1} pitch ${p0}->${p1} top ${pTop} bottom ${pBottom} (viewport h=${vh}) uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); await sleep(200); rmSync(profile, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} mouse look without pointer lock (${msg})`);
process.exit(ok ? 0 : 1);
