import { describe, expect, it } from 'vitest';
import { radiusAt, rollAt, trailPath, wrapSVG, ballX } from './yarn';
describe('yarn timer', () => {
  it('shrinks as time runs out', () => { expect(radiusAt(1)).toBeLessThan(radiusAt(0) / 3); });
  it('trail grows with time and starts at his paws', () => {
    expect(trailPath(0.9).length).toBeGreaterThan(trailPath(0.1).length);
    expect(trailPath(0)).toMatch(/^M118 188/);
  });
  it('rolls, and stays on screen', () => {
    expect(Math.abs(rollAt(0.4))).toBeGreaterThan(90);
    for (let t = 0; t <= 1; t += 0.05) { expect(ballX(t)).toBeGreaterThan(160); expect(ballX(t) + radiusAt(t)).toBeLessThan(350); }
  });
  it('wraps him gradually, only the newest strand animates', () => {
    expect(wrapSVG(0.2, '#000')).toBe('');
    const s = wrapSVG(1, '#000');
    expect(s.match(/<g/g)!.length).toBe(4);
    expect(s.match(/wrapin/g)!.length).toBe(1);
  });
});
