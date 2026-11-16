# Liminal Rain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser first-person walk through an endless procedural liminal space where every surface is perspective-correct glowing glyph rain, as in the "Neo sees the code" corridor.

**Architecture:** Pure world logic (hashing, tile generation, collision) lives in `src/world.js`, a classic script that defines a `World` global in the browser and `module.exports` under Node, so it is unit-tested with `node:test`. `index.html` owns everything visual: a WebGL2 full-screen fragment shader raycasts a 64×64 map-window texture that JS refills around the player, and draws procedural rain from a glyph-atlas texture onto walls, floor and ceiling. Bloom is a downsampled blur pass composited on top.

**Tech Stack:** HTML, vanilla JS, WebGL2 / GLSL ES 3.00, Node 24 `node:test` for tests. No dependencies.

**Spec:** `docs/superpowers/specs/2026-11-16-liminal-rain-design.md`

## Global Constraints

- No dependencies, no build step, no server: opening `index.html` from `file://` must work. (Deviation from the spec's "one `index.html`": world logic sits in `src/world.js`, loaded by a classic `<script src>`, which still works from `file://`, so it can be tested.)
- No solid surface colour: black wherever there are no glyphs. Colour is green (`#00ff41`-ish trails, near-white `#d8ffe0` heads).
- Controls: WASD and arrow keys move (with arrows turning when pointer lock isn't active), the mouse turns under pointer lock, click to enter.
- Not built: figures, goal, sound, touch, pitch, height changes.

## Review Focus

1. **Long walks.** After walking hundreds of chunks in one direction, rain and geometry must not jitter (float precision). Shader coordinates are relative to the map window; `World.tileAt` must be correct for chunk coordinates around ±1e6 (test in Task 1).
2. **Frame hitches** (tab switched away, then back). A huge `dt` must not tunnel through walls: `dt` is clamped to 0.05 s and `moveWithCollision` substeps (test in Task 2).
3. **Distant glyph shimmer.** Far surfaces must fade to dim, even code and not sparkle: the atlas is mipmapped and the shader blends glyph detail towards average brightness by distance (visual check in Task 3).
4. **Window resize / HiDPI.** Resizing must not stretch or blur: the canvas is resized to `innerWidth*min(devicePixelRatio,2)` and framebuffers are re-created (check in Task 4).
5. **No WebGL2.** Show a plain message instead of a blank screen (check in Task 3).

---

### Task 1: World generation

**Files:**
- Create: `src/world.js`
- Create: `tests/world.test.js`
- Create: `package.json` (only `{"type":"commonjs","scripts":{"test":"node --test tests/"}}`)

**Interfaces:**
- Produces (on `World` global / `module.exports`):
  - `CHUNK = 8`: chunk side in tiles. A chunk owns its west column (`lx==0`) and north row (`ly==0`) as boundary walls; interior is `lx,ly ∈ 1..7`.
  - `hash2(x:int, y:int, seed:int) -> number in [0,1)`: integer hash, safe for negative and large ints (use `Math.imul` mixing, no float sin).
  - `chunkKind(cx:int, cy:int, seed:int) -> 'corridor'|'hall'|'pillars'|'rooms'`
  - `tileAt(x:int, y:int, seed:int) -> 0|1`: 1 = wall. Uses floor division for negatives.
  - `findSpawn(seed:int) -> {x:number, y:number}`: centre of a floor tile in chunk (0,0).
  - `fillWindow(ox:int, oy:int, size:int, seed:int, out:Uint8Array)`: `out[j*size+i] = tileAt(ox+i, oy+j, seed) ? 255 : 0`.

Doorways: each chunk's west and north edges get 1–2 openings, each 1–2 tiles wide, at positions in `1..6` hashed from `(cx,cy,edge)`. The corner tile `(0,0)` is always wall. Interiors by kind (builder's choice of exact shapes): `hall` empty; `pillars` single-tile pillars on an even grid, never on a doorway's approach tile; `rooms` 1–2 interior partitions, each with at least one gap; `corridor` mostly wall with 1–2-wide corridors linking all four sides' doorways through the centre. Every kind must keep all floor tiles in the chunk, plus the doorway tiles of its four sides, one connected region.

- [ ] **Step 1: Write the failing tests** in `tests/world.test.js` (`node:test` + `node:assert/strict`):
  - `deterministic`: `tileAt(x,y,7)` is equal across two calls for 1000 random coords, and `tileAt` differs somewhere between seeds 7 and 8 across a 64×64 area.
  - `corner always wall`: `tileAt(cx*8, cy*8, s) === 1` for 100 random chunks.
  - `every edge has a doorway`: for 500 random chunks, some `ly∈1..6` has `tileAt(cx*8, cy*8+ly)===0`, and some `lx∈1..6` has `tileAt(cx*8+lx, cy*8)===0`.
  - `chunk connected`: for 500 random chunks (and all four kinds appear among them), BFS over floor tiles in the 9×9 box `x∈[cx*8, cx*8+8], y∈[cy*8, cy*8+8]` from any floor tile reaches every floor tile of the chunk's interior and each of its four sides' doorway tiles.
  - `far coordinates`: the `every edge has a doorway` and `chunk connected` checks pass for chunks near `(±1e6, ±1e6)`.
  - `spawn is floor`: `tileAt(Math.floor(s.x), Math.floor(s.y), seed) === 0` for seeds 1..50.
  - `fillWindow matches tileAt`: a 16×16 window at `(-5, 3)` agrees with `tileAt` cell by cell.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (cannot find `../src/world.js`).
- [ ] **Step 3: Implement `src/world.js`** to the interfaces above, ending with `if (typeof module !== 'undefined') module.exports = World; else window.World = World;`
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: procedural chunked world generation` (include the spec doc).

### Task 2: Movement and collision

**Files:**
- Modify: `src/world.js`
- Modify: `tests/world.test.js`

**Interfaces:**
- Consumes: `tileAt`.
- Produces: `moveWithCollision(pos:{x,y}, dx:number, dy:number, radius:number, isWall:(tx:int,ty:int)=>boolean) -> {x,y}`. Substeps so no step exceeds 0.1 tiles. Resolves X then Y per substep (wall sliding). The player is a circle of `radius` (0.2 in the game) tested against wall tiles.

- [ ] **Step 1: Write failing tests:**
  - `blocked by wall`: in a map where only `x>=5` is wall, moving from `(4.5,0.5)` by `dx=+3` ends with `x <= 5-0.2+1e-9`.
  - `slides along wall`: same map, move `(4.5,0.5)` by `(+1,+1)` ends with `y≈1.5` and `x<=4.8`.
  - `no tunnelling`: a 1-tile wall at `x==5` only; moving from `(4.5,0.5)` by `dx=+50` in one call ends with `x<5`.
  - `free move`: an empty map moves by exactly `(dx,dy)`.
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement `moveWithCollision`.**
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: substepped circle-vs-tile collision`.

### Task 3: Renderer — raycast + glyph rain

**Files:**
- Create: `index.html`
- Create: `tools/shot.sh`: headless screenshot helper

**Interfaces:**
- Consumes: `World.findSpawn`, `World.fillWindow`, `World.moveWithCollision`, `World.tileAt`, `World.CHUNK`.
- Produces (for Task 4): `renderScene(fbo)`, which draws the scene into the given framebuffer (null = screen); `state = {pos:{x,y}, angle, time, seed}`; `resize()`. URL params for testing: `?seed=N&x=..&y=..&a=..&t=..&still=1` set the start state and freeze time and input.

`tools/shot.sh <query> <out.png>` runs:
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=3000 --screenshot=<out> "file://$PWD/index.html?<query>"` (verified to work on this machine).

Shader (GLSL ES 3.00, one full-screen triangle) per pixel:
1. Ray from the camera (FOV ≈ 66°, eye height 0.5, wall height 1.0) in window-relative coordinates: the camera is passed as `pos - windowOrigin`, so values stay small.
2. DDA through `uMap` (`R8`, 64×64, `NEAREST`) up to 48 steps, which gives the wall distance, side and along-wall `u` (world-continuous: use `tile index + fract` so glyph columns don't reset per tile). Outside the window counts as empty.
3. If the pixel row is above or below the wall slice, intersect the ceiling (y=1) or floor (y=0) plane instead. Floor and ceiling surface coordinates are world-plane `(x, z)` relative to the window.
4. `rain(surfaceUV, flowAxis, dist)`: glyph cells of 1/10 tile on walls and 1/8 tile on floor and ceiling. Each column has 2 drops with hashed speed (0.6–1.6 tiles/s) and phase, and trails 6–18 cells long that fade exponentially. Head cell → head colour. Glyph index = hash(cell, floor(time*rate(cell))), so glyphs change at hashed rates. Sample the atlas with `textureGrad` built from the surface-UV derivatives, so mipmaps handle distance. Mix glyph coverage towards 0.35 × average brightness as `fwidth(cell)` approaches 1 (no shimmer). Walls flow down; floor and ceiling flow along world X or Z, picked by the hashed column.
5. Architecture accent: within 0.06 tile of a wall's vertical tile edge, and on wall cells next to a doorway, add +40% density and brightness.
6. Fog: `exp(-dist*0.11)` towards black, plus a faint dense-code floor so the vanishing point stays dimly lit (as in the reference).
7. A WebGL2-unavailable path shows a centred text message.

Glyph atlas: a 2D canvas, 16×16 grid of 64-px cells, katakana `ｦ-ﾝ`, digits, `:・."=*+-<>¦|`, drawn mirrored (`scale(-1,1)`) in white, uploaded as `RGBA` with `generateMipmap` and `LINEAR_MIPMAP_LINEAR`.

Loop: `dt = min(0.05, Δ)`. Movement 2.2 tiles/s, mouse 0.0025 rad/px, arrow turn 2.2 rad/s. Head bob ±0.015 eye height at 1.6 Hz while moving. Re-centre the window (`fillWindow`, `texSubImage2D`) when the player is more than 12 tiles from the window centre. "Click to enter" overlay in monospace green; it hides on pointer lock and shows again on unlock.

- [ ] **Step 1: Write `tools/shot.sh`**, then run `tools/shot.sh "seed=1&still=1" /tmp/lr-1.png` on the missing page. Expected: a blank or error screenshot (the baseline that fails).
- [ ] **Step 2: Implement `index.html`** per the above.
- [ ] **Step 3: Verify the visuals.** Take shots at `seed=1&still=1`, `seed=2&still=1&a=1.57` and one spot inside a `corridor` chunk, then look at each PNG. Expected: rain on the walls, floor and ceiling in perspective with smaller glyphs further away, black where nothing is drawn, readable corridor or doorway structure, no sparkle at distance. Compare against the reference image `/Users/marcin/.t3/userdata/attachments/16e8b970-8949-41d9-a1b9-6268674c0e63-576d7ecd-f898-4c30-87a4-91072ff46b88.png` and tune the constants by eye.
- [ ] **Step 4: Verify movement.** Load `index.html?seed=1&x=1e6*8+...&y=...` (a far chunk spawn computed via `World`), take a shot, and expect no jitter or garbage. Then run `npm test`: still all pass.
- [ ] **Step 5: Commit** `feat: WebGL glyph-rain raycast renderer`.

### Task 4: Bloom, motes, polish

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `renderScene(fbo)`, `resize()` from Task 3.

- Render the scene to a full-res FBO, then downsample to 1/4 res, run a separable 9-tap Gaussian (H then V), and composite `scene + bloom*0.9` to the screen.
- Motes: 24 soft round points in camera-relative 3D (within 6 tiles) that drift slowly with hashed velocities, projected with the same camera. Draw them in the composite shader as additive Gaussian blobs, pale green at alpha ≤ 0.25, and blur the far ones more.
- Ambient flicker: every 8–20 s (hashed), the global brightness dips to 0.75 for 80–200 ms.
- `resize()` re-creates the FBOs and caps the DPR at 2.

- [ ] **Step 1: Shot before.** Run `tools/shot.sh "seed=1&still=1" /tmp/lr-before.png`.
- [ ] **Step 2: Implement** bloom, motes, flicker and resize handling.
- [ ] **Step 3: Verify.** Run `tools/shot.sh "seed=1&still=1" /tmp/lr-after.png` and again at `--window-size=700,900`. Expected: glyphs glow (soft halo, heads bloom more), faint motes are visible, the portrait size is not stretched, and the scene still reads as the reference. Then run `npm test`: all pass.
- [ ] **Step 4: Update `README.md`** with a one-paragraph description, controls and "open index.html".
- [ ] **Step 5: Commit** `feat: bloom, drifting motes, ambient flicker`.
