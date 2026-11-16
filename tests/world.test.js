const test = require('node:test');
const assert = require('node:assert/strict');
const World = require('../src/world.js');
const { CHUNK, tileAt, chunkKind, findSpawn, fillWindow } = World;

// Small deterministic PRNG for picking test coordinates.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const randInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

function westDoorTiles(cx, cy, s) {
  const out = [];
  for (let ly = 1; ly < CHUNK; ly++) if (tileAt(cx * CHUNK, cy * CHUNK + ly, s) === 0) out.push([cx * CHUNK, cy * CHUNK + ly]);
  return out;
}
function northDoorTiles(cx, cy, s) {
  const out = [];
  for (let lx = 1; lx < CHUNK; lx++) if (tileAt(cx * CHUNK + lx, cy * CHUNK, s) === 0) out.push([cx * CHUNK + lx, cy * CHUNK]);
  return out;
}

function assertChunkConnected(cx, cy, s) {
  const X = cx * CHUNK, Y = cy * CHUNK;
  const inBox = (x, y) => x >= X && x <= X + CHUNK && y >= Y && y <= Y + CHUNK;
  const targets = [];
  for (let ly = 1; ly < CHUNK; ly++) for (let lx = 1; lx < CHUNK; lx++)
    if (tileAt(X + lx, Y + ly, s) === 0) targets.push([X + lx, Y + ly]);
  assert.ok(targets.length > 0, `chunk ${cx},${cy} has no floor`);
  targets.push(...westDoorTiles(cx, cy, s), ...northDoorTiles(cx, cy, s),
    ...westDoorTiles(cx + 1, cy, s), ...northDoorTiles(cx, cy + 1, s));
  const seen = new Set([targets[0].join()]);
  const queue = [targets[0]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const k = nx + ',' + ny;
      if (!seen.has(k) && inBox(nx, ny) && tileAt(nx, ny, s) === 0) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  for (const t of targets) assert.ok(seen.has(t.join()), `chunk ${cx},${cy} (${chunkKind(cx, cy, s)}): ${t} unreachable`);
}

function assertEdgesHaveDoors(cx, cy, s) {
  assert.ok(westDoorTiles(cx, cy, s).some(([, y]) => y - cy * CHUNK <= 6), `no west door ${cx},${cy}`);
  assert.ok(northDoorTiles(cx, cy, s).some(([x]) => x - cx * CHUNK <= 6), `no north door ${cx},${cy}`);
}

test('deterministic', () => {
  const r = rng(1);
  for (let i = 0; i < 1000; i++) {
    const x = randInt(r, -5000, 5000), y = randInt(r, -5000, 5000);
    assert.equal(tileAt(x, y, 7), tileAt(x, y, 7));
  }
  let differs = false;
  for (let y = 0; y < 64 && !differs; y++) for (let x = 0; x < 64; x++) if (tileAt(x, y, 7) !== tileAt(x, y, 8)) { differs = true; break; }
  assert.ok(differs, 'seeds 7 and 8 produce identical worlds');
});

test('corner always wall', () => {
  const r = rng(2);
  for (let i = 0; i < 100; i++) {
    const cx = randInt(r, -1000, 1000), cy = randInt(r, -1000, 1000), s = randInt(r, 0, 1e6);
    assert.equal(tileAt(cx * CHUNK, cy * CHUNK, s), 1);
  }
});

test('every edge has a doorway', () => {
  const r = rng(3);
  for (let i = 0; i < 500; i++) assertEdgesHaveDoors(randInt(r, -1000, 1000), randInt(r, -1000, 1000), randInt(r, 0, 1e6));
});

test('chunk connected', () => {
  const r = rng(4);
  const kinds = new Set();
  for (let i = 0; i < 500; i++) {
    const cx = randInt(r, -1000, 1000), cy = randInt(r, -1000, 1000), s = randInt(r, 0, 1e6);
    kinds.add(chunkKind(cx, cy, s));
    assertChunkConnected(cx, cy, s);
  }
  assert.deepEqual([...kinds].sort(), ['corridor', 'hall', 'pillars', 'rooms']);
});

test('far coordinates', () => {
  const r = rng(5);
  for (let i = 0; i < 200; i++) {
    const cx = (r() < 0.5 ? -1 : 1) * 1e6 + randInt(r, -50, 50);
    const cy = (r() < 0.5 ? -1 : 1) * 1e6 + randInt(r, -50, 50);
    const s = randInt(r, 0, 1e6);
    assertEdgesHaveDoors(cx, cy, s);
    assertChunkConnected(cx, cy, s);
  }
});

test('spawn is floor', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const p = findSpawn(seed);
    assert.equal(tileAt(Math.floor(p.x), Math.floor(p.y), seed), 0, `seed ${seed}`);
  }
});

test('fillWindow matches tileAt', () => {
  const size = 16, out = new Uint8Array(size * size);
  fillWindow(-5, 3, size, 11, out);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++)
    assert.equal(out[j * size + i], tileAt(-5 + i, 3 + j, 11) ? 255 : 0);
});

const { moveWithCollision } = World;
const R = 0.2;

test('blocked by wall', () => {
  const p = moveWithCollision({ x: 4.5, y: 0.5 }, 3, 0, R, (tx) => tx >= 5);
  assert.ok(p.x <= 5 - R + 1e-9, `x=${p.x}`);
});

test('slides along wall', () => {
  const p = moveWithCollision({ x: 4.5, y: 0.5 }, 1, 1, R, (tx) => tx >= 5);
  assert.ok(Math.abs(p.y - 1.5) < 1e-9, `y=${p.y}`);
  assert.ok(p.x <= 4.8 + 1e-9, `x=${p.x}`);
});

test('no tunnelling', () => {
  const p = moveWithCollision({ x: 4.5, y: 0.5 }, 50, 0, R, (tx) => tx === 5);
  assert.ok(p.x < 5, `x=${p.x}`);
});

test('free move', () => {
  const p = moveWithCollision({ x: 4.5, y: 0.5 }, 2.25, -1.5, R, () => false);
  assert.ok(Math.abs(p.x - 6.75) < 1e-9 && Math.abs(p.y + 1) < 1e-9, `${p.x},${p.y}`);
});

const { PHRASES, wallText, wrapText, fillTextWindow } = World;
// Faces: 0 = +x (east), 1 = -x (west), 2 = +y (south), 3 = -y (north) — the side the text is on.
const FACE_DIR = [[1, 0], [-1, 0], [0, 1], [0, -1]];

test('phrases are printable ASCII fragments', () => {
  assert.ok(PHRASES.length >= 30);
  for (const p of PHRASES) {
    assert.match(p, /^[\x20-\x7e]+$/, p);
    assert.ok(p.length >= 2 && p.length <= 40, p);
  }
});

test('wallText only on exposed wall faces, deterministic, ~10% of them', () => {
  let exposed = 0, withText = 0;
  for (let y = -200; y < 200; y++) for (let x = -200; x < 200; x++) for (let f = 0; f < 4; f++) {
    const t = wallText(x, y, f, 5);
    assert.equal(t, wallText(x, y, f, 5));
    const [dx, dy] = FACE_DIR[f];
    const isExposed = tileAt(x, y, 5) === 1 && tileAt(x + dx, y + dy, 5) === 0;
    if (!isExposed) { assert.equal(t, -1, `${x},${y},${f}`); continue; }
    exposed++;
    if (t >= 0) { withText++; assert.ok(Number.isInteger(t) && t < PHRASES.length); }
  }
  const frac = withText / exposed;
  assert.ok(frac > 0.06 && frac < 0.14, `fraction ${frac}`);
});

test('wrapText wraps at word boundaries to the width, max 4 lines', () => {
  assert.deepEqual(wrapText('the exit was just', 9), ['the exit', 'was just']);
  assert.deepEqual(wrapText('wake up', 13), ['wake up']);
  for (const p of PHRASES) for (const w of [13, 28, 43]) {
    const lines = wrapText(p, w);
    assert.ok(lines.length >= 1 && lines.length <= 4, `${p} @${w}`);
    for (const l of lines) assert.ok(l.length <= w, `${l} @${w}`);
    assert.equal(lines.join(' '), p, `words lost: ${p} @${w}`);
  }
  // A word longer than the width is cut, not dropped.
  assert.deepEqual(wrapText('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
});

test('fillTextWindow matches wallText', () => {
  const size = 16, out = new Uint8Array(size * size * 4);
  fillTextWindow(-7, 9, size, 5, out);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) for (let f = 0; f < 4; f++)
    assert.equal(out[(j * size + i) * 4 + f], wallText(-7 + i, 9 + j, f, 5) + 1);
});
