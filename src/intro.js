// Liminal Rain — opening cutscene timeline: intro time (s) -> camera pitch and hand pose.
// Classic script: defines window.Intro in the browser, module.exports under Node.
(function () {
  'use strict';

  const DURATION = 7;
  const PITCH = -0.8; // radians: looking down at the hands

  // Smooth 0 -> 1 between a and b.
  const ease = (a, b, t) => {
    const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  // 0 -> 1 between a and b, hold, 1 -> 0 between c and d.
  const swell = (a, b, c, d, t) => ease(a, b, t) * (1 - ease(c, d, t));

  function pose(t) {
    return {
      pitch: PITCH * swell(1, 2.5, 5.8, DURATION, t),
      raise: swell(2, 3, 5.5, 6.5, t),     // hands rise into view, then lower out of it
      turn: swell(3.3, 4.4, 4.8, 5.5, t),  // slow turn of the palms, as if inspecting them
      done: t >= DURATION,
    };
  }

  const Intro = { DURATION, pose };
  if (typeof module !== 'undefined') module.exports = Intro;
  else window.Intro = Intro;
})();
