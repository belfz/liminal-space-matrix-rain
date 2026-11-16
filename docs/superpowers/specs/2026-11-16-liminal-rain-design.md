# Liminal Rain — design

## Intent
A first-person walk through an endless liminal space (empty corridors, halls, doorways,
rooms that repeat) where the space exists only as "matrix rain". No goal yet: this is the
base to build on later.

**Visual reference:** the "Neo sees the code" corridor in *The Matrix*. Every surface (walls,
floor, ceiling, door frames) is covered in green glyph rain drawn **in perspective**: glyphs
shrink and pack tighter with distance, streams run down the walls and along the floor
towards the viewer, everything glows on black, the far end dissolves into dense dim code,
and a few soft motes of light hang in the air.

## Goals
- The rain *is* the world: no solid surfaces, only glowing glyphs on black, laid onto
  the geometry in perspective.
- Endless, quiet wandering through a space that feels empty and slightly wrong.
- Smooth first-person movement in the browser.

## Non-goals (for now)
Goals, exits, story, figures or characters, sound, mobile/touch controls,
stairs or height changes. (Looking up/down was a non-goal; added on request — pitch capped at ~83°.)

## Anti-goals
- A flat screen-space rain overlay with geometry hinted underneath (the reference has
  the glyphs living *on* the surfaces).
- Looking like a textured game: no visible solid wall colour behind the glyphs.
- Choppy frame rate.

## Approaches
- **A. Screen-as-rain grid** (first pick, dropped after the reference): a fixed glyph grid
  can't make glyphs shrink with distance or flow along the floor, which the reference
  depends on.
- **B. Canvas 2D raycaster with rain-textured walls:** walls are doable, but perspective
  floors and ceilings mean per-pixel work that Canvas 2D can't do smoothly.
- **C. WebGL fragment shader (chosen):** a full-screen shader raycasts the tile map for
  every pixel, works out which surface it hits and where, and draws procedural glyph rain
  in that surface's own coordinates. That gives perspective glyphs on walls, floor and
  ceiling for free, plus glow and fog, at full frame rate. It's still one file with no
  libraries. three.js was considered and dropped: a library and a mesh scene add
  nothing a single shader can't do here.

## How it works (builder's calls, stated)
- **Delivery:** one `index.html`, raw WebGL, no dependencies. Open it in a browser and it runs.
- **World:** infinite and procedural. JS generates tiles from a seeded hash of chunk
  coordinates. Each chunk (about 8×8 tiles) is a room whose edges are walls with doorways
  at positions hashed from the shared edge, so neighbours agree and everything connects.
  Each chunk's inside is picked by hash: long corridor, empty hall, pillar grid or
  partitioned rooms. JS writes a window of tiles around the player (for example 64×64)
  into a texture and re-centres it as the player moves, so the shader and collision both
  read one source of truth.
- **Shader:** a DDA raycast through the map texture gives the wall hit, its distance and
  its UV. Floor and ceiling come from plane intersection. Each surface is split into glyph
  cells. A glyph atlas (katakana, digits, a few symbols, rendered once to a texture,
  mirrored like the film) supplies the shapes. Per-column hashed drops with fading trails
  stream down the walls and along the floor and ceiling towards the doorways.
  Bright heads are near-white green, trails phosphor green. Glyphs flicker and change.
  Distance fog fades to black. Tile edges and door frames get slightly denser,
  brighter code so the architecture reads.
- **Air:** a few faint, soft, drifting motes in front of the scene, as in the reference.
- **Glow:** a cheap bloom (a downsampled blur pass added back), if the frame rate allows.
  Otherwise an in-shader soft halo around the glyphs.
- **Controls:** WASD/arrows to move, mouse to turn (pointer lock on click), arrow keys turn
  as a fallback. Wall collision, subtle head bob. "Click to enter" overlay.

## Left to the builder
Glyph size per surface, rain speeds and density, fog curve, bloom strength, chunk size
and layout variety, tuned by eye against the reference for mood and frame rate.
