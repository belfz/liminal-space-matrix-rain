// Walked counter: hidden on the splash, shown in the pause menu (Esc) with the distance walked;
// no walking while paused. Usage: node pause.mjs <file-url>?intro=0
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const profile = mkdtempSync(join(tmpdir(), 'lr-pause-'));
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
  const key = (type, code, k, vk) => send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk });
  const shown = () => ev(`getComputedStyle(document.querySelector('#overlay .walked')).display !== 'none' &&
    !document.getElementById('overlay').classList.contains('hidden')`);
  await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(2500);
  const onSplash = await shown();
  await mouse('mouseMoved', 400, 225);
  await mouse('mousePressed', 400, 225, { button: 'left', clickCount: 1 });
  await mouse('mouseReleased', 400, 225, { button: 'left', clickCount: 1 });
  await sleep(300);
  await key('keyDown', 'KeyW', 'w', 87); await sleep(1500); await key('keyUp', 'KeyW', 'w', 87);
  const w = await ev('LR.walked');
  await key('keyDown', 'Escape', 'Escape', 27); await key('keyUp', 'Escape', 'Escape', 27); await sleep(300);
  const onPause = await shown();
  const text = await ev(`document.querySelector('#overlay .walked').textContent`);
  const m = /walked ([\d,]+) steps · (\d+) m/.exec(text || '');
  const metresOk = !!m && Math.abs(Number(m[2]) - w * 2) <= 1 && Number(m[1].replace(/,/g, '')) > 0;
  // Keys do nothing while paused.
  const p0 = await ev('JSON.stringify(LR.state.pos)');
  await key('keyDown', 'KeyW', 'w', 87); await sleep(600); await key('keyUp', 'KeyW', 'w', 87);
  const p1 = await ev('JSON.stringify(LR.state.pos)');
  ok = onSplash === false && w > 0.5 && onPause === true && metresOk && p0 === p1 && errors.length === 0;
  msg = `splash shows=${onSplash} walked=${w && w.toFixed(2)} tiles pause shows=${onPause} text="${text}" frozen=${p0 === p1} uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); await sleep(200); rmSync(profile, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} walked counter in pause menu only (${msg})`);
process.exit(ok ? 0 : 1);
