import { describe, expect, it } from 'vitest';
import { atRest, leanFor, stepSpring, strokeTransform } from './spring';
describe('stroke spring', () => {
  it('leans toward the finger and saturates softly', () => { expect(leanFor(0)).toBe(0); expect(leanFor(500)).toBeLessThan(1); expect(leanFor(-70)).toBeCloseTo(-0.76, 1); });
  it('overshoots once on release then settles (wobble, not snap)', () => {
    let s = { x: 1, v: 0 }; let min = 1; let t = 0;
    while (!atRest(s, 0) && t < 3000) { s = stepSpring(s, 0, 16); min = Math.min(min, s.x); t += 16; }
    expect(min).toBeLessThan(-0.1); expect(min).toBeGreaterThan(-0.5); expect(t).toBeLessThan(1500);
  });
  it('is frame-rate independent', () => {
    let a = { x: 1, v: 0 }, b = { x: 1, v: 0 };
    for (let i = 0; i < 30; i++) a = stepSpring(a, 0, 16.67);
    for (let i = 0; i < 60; i++) b = stepSpring(b, 0, 8.33);
    expect(Math.abs(a.x - b.x)).toBeLessThan(0.02);
  });
  it('makes a transform string', () => { expect(strokeTransform(0)).toContain('rotate(0.00deg)'); });
});
