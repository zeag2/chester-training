/* A tiny damped spring (react-spring style: tension / friction), stepped with real frame time so it feels the same at 60 or 120 Hz.
   Underdamped on purpose: when you let go of a stroke he wobbles back instead of snapping. */
export interface Spring { x: number; v: number }
export const STROKE = { tension: 260, friction: 14 };

export function stepSpring(s: Spring, target: number, dtMs: number, cfg = STROKE): Spring {
  let { x, v } = s;
  // sub-step for stability on slow frames
  const steps = Math.max(1, Math.ceil(dtMs / 8)); const h = dtMs / 1000 / steps;
  for (let i = 0; i < steps; i++) { const a = cfg.tension * (target - x) - cfg.friction * v; v += a * h; x += v * h; }
  return { x, v };
}

export const atRest = (s: Spring, target: number) => Math.abs(s.x - target) < 0.002 && Math.abs(s.v) < 0.01;

/** Finger offset (px) -> lean in -1..1, with soft resistance near the ends so it never snaps hard. */
export const leanFor = (dx: number) => Math.tanh(dx / 70);

export function strokeTransform(x: number): string {
  const a = Math.abs(x);
  return `translateX(${(x * 8).toFixed(2)}px) rotate(${(x * 9).toFixed(2)}deg) scale(${(1 + a * 0.035).toFixed(4)},${(1 - a * 0.035).toFixed(4)})`;
}
