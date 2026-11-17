# Golden-hands opening: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the first entry after a page load, play a ~7 s cutscene. The view tilts down to two
hands made of golden glyph rain, they tremble and turn, then the view returns level and
control comes back.

**Architecture:**
- A pure timeline module, `src/intro.js`, maps intro time to a pose: pitch, raise and turn.
- `index.html` runs the intro clock. It drives `state.pitch` from the pose, blocks input, and
  handles skipping.
- Each frame, `index.html` computes per-hand transforms in JS, including the tremor.
- The scene shader raymarches an SDF of two hands in yaw-only "body space" (eye at the origin,
  metres). It shades their surface with the existing `rain()` tinted gold and depth-tests them
  against the world.

**Tech Stack:** raw WebGL2, plain JS, `node:test`, headless Chrome + SwiftShader visual checks.

**Spec:** `docs/superpowers/specs/2026-11-17-intro-hands-design.md`

## Global Constraints
- No dependencies. Scripts are loaded with a cache-busting `?v=` (preview servers cache for 1 h).
- The intro plays on the first click-to-enter per page load only. Re-entering after Esc doesn't replay it.
- `?intro=0` skips it. In still mode it's off unless `intro=<seconds>` freezes it at that moment.
- Any key or click during the intro skips to the end. Esc leaves as usual, which also ends the intro.
- Movement and look input are ignored while the intro runs.
- Gold is about `vec3(1.0, 0.72, 0.25)` for trails, with near-white gold heads. Between glyphs
  it's black, and the hands occlude the world.
- When the intro isn't running, the shader skips the hands completely: walking cost is unchanged.

## Review Focus
- Holding W while clicking to enter: key repeat must skip the intro, not leave it half-applied.
  Covered by the intro.mjs key-skip check.
- Esc during the intro: the overlay returns, and re-entering must not replay the intro or leave the
  pitch stuck. Covered in intro.mjs.
- The existing mouse-look test clicks and expects immediate control, so it must pass `intro=0`.
- Density 1 and 3: the hand glyphs scale with `uDens`. Checked by eye in screenshots.
- A wall closer than the hands (facing a wall at the collision radius): the depth test must keep
  the hands in front. Checked by eye.

---

### Task 1: Intro timeline module

**Files:**
- Create: `src/intro.js` (classic script: `window.Intro` / `module.exports`, like world.js)
- Modify: `index.html` loader (load world.js then intro.js, both with `?v=`)
- Test: `tests/intro.test.js`

**Interfaces:**
- Produces: `Intro.DURATION = 7`. `Intro.pose(t) -> { pitch, raise, turn, done }`:
  - `pitch` is in radians (target about −0.8).
  - `raise` and `turn` are in 0..1.
  - `done` is `t >= DURATION`.
- Timeline:
  - Pitch is 0 until 1 s, eases to −0.8 by 2.5 s, holds, then eases back to 0 between 5.8 and 7 s.
  - Raise eases 0→1 between 2 and 3 s, and 1→0 between 5.5 and 6.5 s.
  - Turn eases 0→1 between 3.3 and 4.4 s, holds, and goes 1→0 between 4.8 and 5.5 s.

- [ ] Write tests:
  - `pose(0)`: pitch 0, raise 0.
  - `pose(4)`: pitch −0.8 ±0.01, raise 1.
  - `pose(7)`: pitch 0, raise 0, `done`.
  - `pose(-1)` and `pose(100)` are clamped (no NaN).
  - Continuity: over `t` in 0..7 in 0.01 steps, every field changes by < 0.05 per step.
- [ ] Run `node --test`; expect a failure because the module is missing.
- [ ] Implement it with smoothstep easing. Change the loader to load the scripts in order, then call `startGame`.
- [ ] Run `node --test` and `node tests/visual/stale-cache.mjs 73dc27a`; both pass.
- [ ] Commit.

### Task 2: Intro flow (clock, camera, input, skip)

**Files:**
- Modify: `index.html` (state, `enter`/`leave`, input handlers, `update`, `frame`, the `window.LR` export)
- Modify: `tests/visual/mouse-look.mjs` (URL gets `?intro=0`)
- Create: `tests/visual/intro.mjs`, then add it to `run.sh`

**Interfaces:**
- Consumes: `Intro.pose`, `Intro.DURATION`.
- Produces: `intro = { on: bool, t: seconds, played: bool }`, exposed as `LR.intro`. While
  `intro.on`, the pose drives `state.pitch`, and `pose.raise` and `pose.turn` feed the hand
  uniforms (Task 3).

- [ ] Write `intro.mjs` (CDP, same harness as mouse-look.mjs):
  1. Click to enter. Expect `LR.intro.on === true`.
  2. Move the mouse. Expect `state.angle` unchanged.
  3. Wait until the pitch is below −0.3, which shows the camera tilts down.
  4. Press a key. Expect `LR.intro.on === false` and the pitch reset to 0.
  5. Press Esc, then click again. Expect the intro not to replay (`LR.intro.on === false`).
  6. Expect no uncaught errors.
- [ ] Run it. It fails because `LR.intro` is undefined.
- [ ] Implement:
  - The intro starts in `enter()` when it hasn't played and `intro` isn't `0`.
  - `frame` advances `intro.t += dt` while it's on.
  - `endIntro()` sets the pitch to 0 and clears `on`.
  - A `keydown` or `mousedown` while on calls `endIntro()`, and so does `leave()`.
  - `update`, `mousemove` and `edgeTurn` return early while on.
  - Still mode with `intro=<s>` sets `on` with a fixed `t`.
- [ ] Run `intro.mjs` and `mouse-look.mjs` (with `intro=0`); both pass.
- [ ] Commit.

### Task 3: Golden hands in the shader

**Files:**
- Modify: `index.html`:
  - `SCENE_FS`: hand SDF, raymarch, gold shading, occlusion.
  - `rain()` gains tint parameters.
  - `renderScene` sets the hand uniforms.
- Create: `tests/visual/gold.py` (counts gold pixels: `r > 1.1*g` and `r > 60`). Add a check to `run.sh`.

**Interfaces:**
- Consumes: `pose.raise`, `pose.turn` from Task 2.
- Uniforms:
  - `uHands` (float; 0 = off, otherwise the overall alpha).
  - `uHandM[2]` (mat3: body space → hand local).
  - `uHandP[2]` (vec3: palm centre in body space, metres; hand 1 in x-mirrored space).
- Rain tint: `rain(g, ci, key, accent, trailCol, headCol)`. The existing callers pass `GREEN, HEAD`.
- Hand-local frame, in metres:
  - x runs across the palm, with the thumb side +x.
  - y is the palm normal, pointing up.
  - z points along the fingers.
- Body space: x right, y up, z forward (yaw only). The body-space ray is
  `(uv.x*K, sp + uv.y*K*cp, cp - uv.y*K*sp)`. 1 tile = 2 m.

- [ ] Add a check to `run.sh`, comparing gold-pixel counts at 480×270 between:
  - `seed=2&still=1&intro=4`: the hands are up. Expect more than 2% gold.
  - `seed=2&still=1&p=-0.8`: same pose, no intro. Expect less than 0.1% gold.
  - `seed=2&still=1&intro=7.5`: after the end. Expect less than 0.1% gold.
- [ ] Run it. It fails because there's no gold.
- [ ] Implement:
  - The SDF is a rounded-box palm, four two-segment curled fingers, a two-segment thumb and a
    forearm capsule, joined by smooth union.
  - Evaluate one hand at `(abs(x), y, z)` and pick the hand by the sign of x.
  - Bound the raymarch with a sphere and use up to 80 steps.
  - Rain cell coordinates: the flow is `-z_local`. The column is `x_local` or `y_local`, picked
    by the dominant normal axis. The scale is `90 * uDens` cells/m.
  - The rim gets brighter with a fresnel term, and the forearm fades out beyond the wrist (alpha too).
  - In JS: hand placement, raise offset, roll by `turn * 1.9` rad, and per-hand tremor from summed sines.
- [ ] Run the check (it passes). Look at screenshots at densities 1, 2 and 3 and at the hold moment.
- [ ] Run all of `npm test` and `npm run test:visual`.
- [ ] Commit.

### Task 4: README
- [ ] Document the opening, skipping and `intro=0` / `intro=<s>`. Commit.
