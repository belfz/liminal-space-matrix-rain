// Liminal Rain — world logic: hashing, procedural chunked tiles, collision.
// Classic script: defines window.World in the browser, module.exports under Node.
(function () {
  'use strict';

  const CHUNK = 8; // chunk side in tiles; a chunk owns its west column and north row

  // Integer hash of up to four ints -> [0, 1). Safe for negatives and large ints.
  function h4(a, b, c, d) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 13), 0x9e3779b1) ^ Math.imul(d | 0, 0x2545f491);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const hash2 = (x, y, seed) => h4(x, y, seed, 0x51ed);

  const KIND_EDGE_W = 1, KIND_EDGE_N = 2;

  function chunkKind(cx, cy, seed) {
    const r = h4(cx, cy, seed, 0x4b1d);
    if (r < 0.35) return 'corridor';
    if (r < 0.55) return 'hall';
    if (r < 0.75) return 'pillars';
    return 'rooms';
  }

  // Doorway offsets (1..7) along the chunk's own west or north edge.
  function edgeDoors(cx, cy, edge, seed) {
    const count = h4(cx, cy, seed, edge * 16 + 1) < 0.4 ? 2 : 1;
    const doors = new Set();
    for (let i = 0; i < count; i++) {
      const p = 1 + Math.floor(h4(cx, cy, seed, edge * 16 + 2 + i) * 6); // 1..6
      const w = h4(cx, cy, seed, edge * 16 + 8 + i) < 0.5 ? 2 : 1;
      for (let k = 0; k < w; k++) doors.add(p + k);
    }
    return doors;
  }

  // Interior tile (lx, ly in 1..7) for a chunk; 1 = wall.
  function interiorTile(cx, cy, lx, ly, seed) {
    switch (chunkKind(cx, cy, seed)) {
      case 'hall':
        return 0;
      case 'pillars':
        return lx % 2 === 0 && ly % 2 === 0 ? 1 : 0;
      case 'rooms': {
        const vx = 3 + Math.floor(h4(cx, cy, seed, 0x700) * 3); // 3..5
        const hy = 3 + Math.floor(h4(cx, cy, seed, 0x701) * 3);
        const both = h4(cx, cy, seed, 0x702) < 0.5;
        const onV = lx === vx;
        const onH = both && ly === hy;
        if (!onV && !onH) return 0;
        if (onV && onH) return 1;
        // Never seal a doorway: partition tiles facing a door stay open.
        if (ly === 1 && edgeDoors(cx, cy, KIND_EDGE_N, seed).has(lx)) return 0;
        if (ly === 7 && edgeDoors(cx, cy + 1, KIND_EDGE_N, seed).has(lx)) return 0;
        if (lx === 1 && edgeDoors(cx, cy, KIND_EDGE_W, seed).has(ly)) return 0;
        if (lx === 7 && edgeDoors(cx + 1, cy, KIND_EDGE_W, seed).has(ly)) return 0;
        // Each wall segment gets one gap so every quadrant connects.
        if (onV) {
          const top = !both || ly < hy;
          const lo = top ? 1 : hy + 1, hi = top ? (both ? hy - 1 : 7) : 7;
          const gap = lo + Math.floor(h4(cx, cy, seed, top ? 0x710 : 0x711) * (hi - lo + 1));
          return ly === gap ? 0 : 1;
        }
        const left = lx < vx;
        const lo = left ? 1 : vx + 1, hi = left ? vx - 1 : 7;
        const gap = lo + Math.floor(h4(cx, cy, seed, left ? 0x712 : 0x713) * (hi - lo + 1));
        return lx === gap ? 0 : 1;
      }
      case 'corridor': {
        // Carve straight corridors from every doorway to the centre lines.
        const C = 4;
        if (lx === C && ly === C) return 0;
        const west = edgeDoors(cx, cy, KIND_EDGE_W, seed);
        const east = edgeDoors(cx + 1, cy, KIND_EDGE_W, seed);
        const north = edgeDoors(cx, cy, KIND_EDGE_N, seed);
        const south = edgeDoors(cx, cy + 1, KIND_EDGE_N, seed);
        // Horizontal runs from west/east doors to column C, then vertical to row C.
        for (const d of west) if ((ly === d && lx <= C) || (lx === C && between(ly, d, C))) return 0;
        for (const d of east) if ((ly === d && lx >= C) || (lx === C && between(ly, d, C))) return 0;
        for (const d of north) if ((lx === d && ly <= C) || (ly === C && between(lx, d, C))) return 0;
        for (const d of south) if ((lx === d && ly >= C) || (ly === C && between(lx, d, C))) return 0;
        return 1;
      }
    }
    return 0;
  }
  const between = (v, a, b) => v >= Math.min(a, b) && v <= Math.max(a, b);

  function tileAt(x, y, seed) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const lx = x - cx * CHUNK, ly = y - cy * CHUNK;
    if (lx === 0 && ly === 0) return 1;
    if (lx === 0) return edgeDoors(cx, cy, KIND_EDGE_W, seed).has(ly) ? 0 : 1;
    if (ly === 0) return edgeDoors(cx, cy, KIND_EDGE_N, seed).has(lx) ? 0 : 1;
    return interiorTile(cx, cy, lx, ly, seed);
  }

  function findSpawn(seed) {
    let best = null, bestD = Infinity;
    for (let ly = 1; ly < CHUNK; ly++) for (let lx = 1; lx < CHUNK; lx++) {
      if (tileAt(lx, ly, seed) !== 0) continue;
      const d = (lx - 4) ** 2 + (ly - 4) ** 2;
      if (d < bestD) { bestD = d; best = { x: lx + 0.5, y: ly + 0.5 }; }
    }
    return best;
  }

  function fillWindow(ox, oy, size, seed, out) {
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++)
      out[j * size + i] = tileAt(ox + i, oy + j, seed) ? 255 : 0;
    return out;
  }

  // Does a square of half-size r centred at (x, y) overlap any wall tile?
  function hits(x, y, r, isWall) {
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++)
        if (isWall(tx, ty)) return true;
    return false;
  }

  // Move pos by (dx, dy), sliding along walls. Substeps keep each step <= 0.1 tiles
  // so large deltas (frame hitches) can't tunnel through thin walls.
  function moveWithCollision(pos, dx, dy, radius, isWall) {
    const EPS = 1e-6;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.1));
    const sx = dx / steps, sy = dy / steps;
    let x = pos.x, y = pos.y;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        const nx = x + sx;
        if (!hits(nx, y, radius, isWall)) x = nx;
        else x = sx > 0 ? Math.floor(nx + radius) - radius - EPS : Math.floor(nx - radius) + 1 + radius + EPS;
      }
      if (sy !== 0) {
        const ny = y + sy;
        if (!hits(x, ny, radius, isWall)) y = ny;
        else y = sy > 0 ? Math.floor(ny + radius) - radius - EPS : Math.floor(ny - radius) + 1 + radius + EPS;
      }
    }
    return { x, y };
  }

  const World = { CHUNK, hash2, chunkKind, tileAt, findSpawn, fillWindow, moveWithCollision };
  if (typeof module !== 'undefined') module.exports = World;
  else window.World = World;
})();
