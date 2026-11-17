const test = require('node:test');
const assert = require('node:assert');
const Intro = require('../src/intro.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('intro starts looking ahead with hands down', () => {
  const p = Intro.pose(0);
  near(p.pitch, 0); near(p.raise, 0); near(p.turn, 0);
  assert.strictEqual(p.done, false);
});

test('mid-intro: looking down at raised hands', () => {
  const p = Intro.pose(4);
  near(p.pitch, -0.8); near(p.raise, 1);
});

test('intro ends level with hands gone', () => {
  const p = Intro.pose(Intro.DURATION);
  assert.strictEqual(Intro.DURATION, 7);
  near(p.pitch, 0); near(p.raise, 0); near(p.turn, 0);
  assert.strictEqual(p.done, true);
});

test('out-of-range times are clamped', () => {
  for (const t of [-1, 100]) {
    const p = Intro.pose(t);
    for (const k of ['pitch', 'raise', 'turn']) assert.ok(Number.isFinite(p[k]));
    near(p.pitch, 0); near(p.raise, 0);
  }
});

test('pose is continuous (no jumps)', () => {
  let prev = Intro.pose(0);
  for (let t = 0.01; t <= 7.001; t += 0.01) {
    const p = Intro.pose(t);
    for (const k of ['pitch', 'raise', 'turn']) assert.ok(Math.abs(p[k] - prev[k]) < 0.05, `${k} jumps at ${t}`);
    prev = p;
  }
});
