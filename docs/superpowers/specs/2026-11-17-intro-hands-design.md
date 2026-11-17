# Liminal Rain — opening: golden hands

## Intent
An atmospheric opening, played once right after entering from the menu. The player looks
down at their own hands, slightly shaken, and sees they are made of the same rain as the
world, but golden. It's a one-off cutscene: no story, no body afterwards.

## Goals
- The hands read as *made of code*: glyph rain living on their surfaces in perspective,
  like the walls (the core rule of the base design).
- Gold, clearly distinct from the green world, glowing through the existing bloom.
- A short, smooth camera move that sells "looking down at my hands in shock".
- No cost after the intro: walking frame rate is unchanged.

## Non-goals
A persistent body, hands while walking, sound, story text, choosing hand poses.

## Anti-goals
- Flat hand shapes pasted over the scene (a "sticker" look).
- Solid-coloured or shaded skin: like everything else, only glowing glyphs on black.
- An intro that traps the player: it must be skippable.

## Approaches
- **A. 3D hands in the main shader (chosen).** Hands built from rounded 3D shapes (a palm plus
  finger segments) in camera space, drawn by the scene shader. Rain flows along their
  surfaces with perspective. Most new shader code, but the extra work runs only during the
  intro, behind a uniform switch.
- **B. Flat screen-space hand silhouettes filled with gold rain.** Simple, but glyphs ignore
  the shape, so it reads as a sticker, which the base design rules out.
- **C. A pre-drawn hand mask image filled with gold rain.** A nicer outline than B, but
  equally flat, and the pose and tremor are hard to change.

## Decided with the user
- A one-off atmospheric cutscene, on first entry only.
- Approach A.

## Builder's calls (proposed)
- **When:** the first click-to-enter after each page load. Re-entering after Esc doesn't
  replay it. `?intro=0` skips it. Still mode (`still=1`) skips it unless `intro=<seconds>` is
  given, which freezes the intro at that moment for screenshots and tests.
- **Timeline (~7 s):**
  - 0–1 s: looking ahead.
  - 1–2.5 s: the view tilts down to about 50°.
  - 2–3 s: the hands rise into view, palms up.
  - 3–5.5 s: hold, with a small tremor and a slow half-turn of the palms, as if inspecting them.
  - 5.5–7 s: the hands lower out of view and the view returns level.

  All of it is eased, and control returns at the end.
- **Skipping:** any key or click during the intro skips to the end. Esc behaves as usual.
  Movement and mouse-look are ignored until the intro ends or is skipped.
- **Hands:** two mirrored hands about 0.45 tiles in front of the eye and below it. Fingers
  are slightly spread and curled. The forearms run off the bottom of the screen and fade out.
  The tremor is a few small summed sines; there is also a slow breathing sway.
- **Look:** the same glyph atlas, with rain running from the fingertips towards the wrists.
  - Trails are amber gold (about `1.0, 0.72, 0.25`) and heads are near-white gold.
  - The silhouette edge is slightly brighter so the shape reads.
  - Between the glyphs it's black, and the hands hide the world behind them.
  - The density setting scales the hand glyphs too.
- **Checks:** a visual test.
  - At the hold moment, gold pixels appear in the lower middle of the frame.
  - With the intro off, at the same pose, they don't.
  - Once the intro has ended, no gold remains.

## Left to the builder
The exact hand proportions and finger curl, the glyph scale on the hands, timing details,
the tremor amplitude, and the gold tones, all tuned by eye.
