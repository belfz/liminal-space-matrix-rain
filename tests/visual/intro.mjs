// Opening cutscene: plays on the first entry, blocks look input, a key skips it, and it doesn't
// replay after Esc + re-enter. Usage: node intro.mjs <file-url>
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
const profile = mkdtempSync(join(tmpdir(), 'lr-intro-'));
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
  const key = async (code, k) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 32 });
  };
  const click = async () => {
    await mouse('mousePressed', 400, 225, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', 400, 225, { button: 'left', clickCount: 1 });
  };
  await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(2500);
  await mouse('mouseMoved', 400, 225);
  await click(); await sleep(300);
  const on = await ev('!!(LR.intro && LR.intro.on)');
  // Look input is ignored while the intro runs.
  const a0 = await ev('LR.state.angle');
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', 400 + i * 20, 225); await sleep(30); }
  const a1 = await ev('LR.state.angle');
  // The camera tilts down on its own.
  let minPitch = 0;
  for (let i = 0; i < 300 && minPitch > -0.3; i++) { minPitch = Math.min(minPitch, await ev('LR.state.pitch + 0')); await sleep(100); }  // + 0: CDP can't return -0
  // A key skips to the end: control back, view level.
  await key('Space', ' '); await sleep(300);
  const offAfterKey = await ev('LR.intro.on === false');
  const pitchAfter = await ev('LR.state.pitch + 0');
  // Esc to the menu and back in: no replay.
  await key('Escape', 'Escape'); await sleep(300);
  const menu = !(await ev(`document.getElementById('overlay').classList.contains('hidden')`));
  await click(); await sleep(300);
  const replay = await ev('LR.intro.on');
  ok = on && a1 === a0 && minPitch <= -0.3 && offAfterKey && pitchAfter === 0 && menu && replay === false && errors.length === 0;
  msg = `started=${on} angle ${a0}->${a1} minPitch=${minPitch.toFixed(2)} skipped=${offAfterKey} pitchAfter=${pitchAfter} menu=${menu} replay=${replay} uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); await sleep(200); rmSync(profile, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} opening cutscene flow (${msg})`);
process.exit(ok ? 0 : 1);
