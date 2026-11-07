/* Yarn timer geometry. p = 0 (start) .. 1 (time's up). Session SVG space is 350 x 220, floor at y 194. */
export const FLOOR = 194;
const R0 = 38;
const LOOPS = 14;

export const radiusAt = (p: number) => R0 * (1 - 0.72 * p);
/** Ball rolls out to the right, comes back toward Chester, then nudges away again. */
export const ballX = (t: number) => 230 - 60 * Math.cos(t * Math.PI * 2.5);
// loops vary in size and spacing so it reads as loose yarn, not a chain
const amp = (t: number) => 0.55 + 0.45 * Math.sin(t * 23.7 + 1.3) * Math.sin(t * 9.1);
const ph = (t: number) => t * Math.PI * 2 * LOOPS + 2.2 * Math.sin(t * 17.3);
const loopX = (t: number) => ballX(t) + 10 * amp(t) * Math.sin(ph(t));
const loopY = (t: number) => FLOOR - 3 + 5 * amp(t) * Math.cos(ph(t));

/** Loose yarn left on the floor: starts at Chester's paws, loops along behind the ball. */
export function trailPath(p: number): string {
  const n = Math.max(2, Math.round(360 * p));
  let d = `M118 188 Q140 197 ${loopX(0).toFixed(1)} ${loopY(0).toFixed(1)}`;
  for (let i = 1; i <= n; i++) { const t = (p * i) / n; d += ` L${loopX(t).toFixed(1)} ${loopY(t).toFixed(1)}`; }
  return d;
}

/** How far the ball has rotated (deg): distance rolled / radius, so it truly rolls instead of spinning in place. */
export function rollAt(p: number): number {
  const steps = 200; let a = 0;
  for (let i = 1; i <= steps * p; i++) {
    const t0 = (i - 1) / steps, t1 = i / steps;
    a += (ballX(t1) - ballX(t0)) / radiusAt((t0 + t1) / 2);
  }
  return (a * 180) / Math.PI * 1.6;
}

/** Strands that wrap Chester (sit-pose coordinates) as time runs low. */
export const WRAPS: { at: number; d: string }[] = [
  { at: 0.55, d: 'M52 152 Q100 186 150 150' },
  { at: 0.7, d: 'M56 176 Q100 202 146 170' },
  { at: 0.82, d: 'M58 128 Q100 152 144 126' },
  { at: 0.93, d: 'M44 58 Q100 22 158 56 Q170 70 162 90' },
];

export function wrapSVG(p: number, line: string): string {
  const shown = WRAPS.filter((w) => p >= w.at);
  return shown.map((w, i) => {
    const anim = i === shown.length - 1 ? ' class="wrapin"' : '';
    return `<g${anim}><path d="${w.d}" pathLength="100" stroke="${line}" stroke-width="7" fill="none" stroke-linecap="round"/>`
      + `<path d="${w.d}" pathLength="100" stroke="#ef8f9a" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
  }).join('');
}
