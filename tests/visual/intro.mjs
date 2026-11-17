// Opening cutscene: plays on the first entry, blocks look input, a key skips it, and it doesn't
// replay after Esc + re-enter. Usage: node intro.mjs <file-url>
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  const key = async (code, k, vk, extra = {}) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: vk, ...extra });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk });
  };
  const click = async (count = 1) => {
    await mouse('mousePressed', 400, 225, { button: 'left', clickCount: count });
    await mouse('mouseReleased', 400, 225, { button: 'left', clickCount: count });
  };
  const gold = async () => {   // gold-pixel fraction of the current frame (tests/visual/gold.py)
    const shot = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
    const f = join(profile, 'frame.png'); writeFileSync(f, Buffer.from(shot, 'base64'));
    return Number(execFileSync('python3', ['tests/visual/gold.py', f]).toString());
  };
  const level = () => ev('LR.state.pitch + 0');   // + 0: CDP can't return -0
  const waitIntro = async (secs) => { for (let i = 0; i < 300 && !(await ev(`LR.intro.t > ${secs}`)); i++) await sleep(100); };
  await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(2500);
  await mouse('mouseMoved', 400, 225);
  // A habitual double-click on "click to enter" must not skip the opening it starts...
  await click(1); await sleep(120); await click(2); await sleep(300);
  const onAfterDouble = await ev('!!(LR.intro && LR.intro.on)');
  // ...nor a lone modifier key (e.g. the start of a screenshot shortcut).
  await key('ShiftLeft', 'Shift', 16); await sleep(100);
  const onAfterShift = await ev('!!(LR.intro && LR.intro.on)');
  // Look input is ignored while the intro runs.
  const a0 = await ev('LR.state.angle');
  for (let i = 1; i <= 10; i++) { await mouse('mouseMoved', 400 + i * 20, 225); await sleep(30); }
  const a1 = await ev('LR.state.angle');
  // The camera tilts down on its own.
  let minPitch = 0;
  for (let i = 0; i < 300 && minPitch > -0.3; i++) { minPitch = Math.min(minPitch, await level()); await sleep(100); }
  // Esc mid-intro: back to the menu, view level; entering again doesn't replay it.
  await key('Escape', 'Escape', 27); await sleep(300);
  const menu = !(await ev(`document.getElementById('overlay').classList.contains('hidden')`));
  const escOff = await ev('LR.intro.on === false');
  const escPitch = await level();
  await click(); await sleep(300);
  const replay = await ev('LR.intro.on');
  // Fresh load: a held (auto-repeating) W skips cleanly; afterwards no hands are drawn even
  // when looking straight down at where they were.
  await send('Page.reload'); await sleep(2500);
  await mouse('mouseMoved', 400, 225);
  await click(); await waitIntro(0.6);
  await key('KeyW', 'w', 87, { autoRepeat: true }); await sleep(300);
  const wOff = await ev('LR.intro.on === false');
  const wPitch = await level();
  await ev('LR.state.pitch = -0.8'); await sleep(800);
  const goldAfter = await gold();
  ok = onAfterDouble && onAfterShift && a1 === a0 && minPitch <= -0.3 && menu && escOff && escPitch === 0 &&
    replay === false && wOff && wPitch === 0 && goldAfter < 0.001 && errors.length === 0;
  msg = `afterDoubleClick=${onAfterDouble} afterShift=${onAfterShift} angle ${a0}->${a1} minPitch=${minPitch.toFixed(2)} ` +
    `esc: menu=${menu} off=${escOff} pitch=${escPitch} replay=${replay} heldW: off=${wOff} pitch=${wPitch} goldAfter=${goldAfter} ` +
    `uncaught=${JSON.stringify(errors)}`;
  ws.close();
} catch (e) { msg = String(e); }
chrome.kill(); await sleep(200); rmSync(profile, { recursive: true, force: true });
console.log(`${ok ? 'ok  ' : 'FAIL'} opening cutscene flow (${msg})`);
process.exit(ok ? 0 : 1);
