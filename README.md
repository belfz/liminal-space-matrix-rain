<img src="assets/icon.svg" width="64" height="64" alt="">

# liminal_space_matrix_rain

A first-person walk through an endless liminal space — corridors, empty halls, pillar rooms,
doorways that keep leading on — where nothing exists except falling "matrix rain". Every wall,
floor and ceiling is drawn as perspective glyph rain by a single WebGL2 shader; there is no
goal, only the space.

**Run:** open `index.html` in a browser (no server, no build). Click to enter.

**Controls:** `WASD` / arrow keys to move · mouse to look · `Esc` to release the mouse.
Without pointer lock, left/right arrows turn.

**URL params:** `seed=N` picks a different world; `x`, `y`, `a` (angle, radians), `t` (time)
set the start; `still=1` freezes time and input (used for screenshots).

**Dev:** `npm test` runs the world-generation and collision tests (Node 24, no dependencies).
`tools/shot.sh "<query>" out.png [W,H]` takes a headless Chrome screenshot.
