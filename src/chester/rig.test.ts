import { describe, it, expect } from 'vitest';
import { MOVES, sampleMove } from './rig';

describe('rig moves', () => {
  it('crouches, flies with tucked legs, and squashes on landing', () => {
    const k = MOVES.hop.keys;
    expect(sampleMove(k, 0.13).sy).toBeLessThan(0.9);   // wind-up
    expect(sampleMove(k, 0.27).sy).toBeGreaterThan(1.1); // stretch on launch
    expect(sampleMove(k, 0.45).y).toBeLessThan(-30);     // in the air
    expect(sampleMove(k, 0.45).legL).toBeGreaterThan(0.5); // legs tucked
    expect(sampleMove(k, 0.78).sy).toBeLessThan(0.9);    // squash
    expect(sampleMove(k, 1)).toMatchObject({ x: 0, y: 0, sx: 1, sy: 1, legL: 0 });
  });
  it('eases between keys and holds channels a key leaves out', () => {
    const v = sampleMove(MOVES.pounce.keys, 0.21);
    expect(Math.abs(v.lean)).toBeLessThanOrEqual(3);
    expect(v.y).toBeCloseTo(6, 0); // still crouched while the rear wiggles
  });
  it('dance loops: the end matches the start', () => {
    expect(sampleMove(MOVES.dance.keys, 0)).toEqual(sampleMove(MOVES.dance.keys, 1));
  });
});
