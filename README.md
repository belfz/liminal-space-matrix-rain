<img src="assets/icon.svg" width="64" height="64" alt="">

# liminal_space_matrix_rain

A first-person walk through an endless liminal space — corridors, empty halls, pillar rooms,
doorways that keep leading on — where nothing exists except falling "matrix rain". Every wall,
floor and ceiling is drawn as perspective glyph rain by a single WebGL2 shader; there is no
goal, only the space. Here and there a wall carries a fragment of text (steady,
horizontal, often unfinished) with the rain running around it.

**Run:** open `index.html` in a browser (no server, no build). Click to enter.

**Controls:** `WASD` / arrow keys to move · mouse to look around, up at the ceiling and down at the floor · `Esc` to leave.
Where the browser grants pointer lock the mouse turns freely. Where it doesn't (e.g. embedded
previews), mouse movement still turns, and resting the cursor near an edge keeps turning
(left/right) or tilting (top/bottom). Without pointer lock, the left/right arrows turn too.

**Menu:** *rain density* `1×` / `2×` / `3×` (default `2×`, remembered): how many glyph columns
cover each surface. Higher means finer, smaller code.

**URL params:** `density=1|2|3` overrides the menu setting; `seed=N` picks a different world; `x`, `y`, `a` (angle, radians), `p` (pitch, radians), `t` (time)
set the start; `still=1` freezes time and input (used for screenshots); `text=0` hides wall text.

**Dev:** `npm test` runs the world-generation and collision tests (Node 24, no dependencies).
`npm run test:visual` runs headless-Chrome visual checks (rain and motes stay put when the
map window re-centres or the player crosses tiles). `tools/shot.sh "<query>" out.png [W,H]`
takes a screenshot.
