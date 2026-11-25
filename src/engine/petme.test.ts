import { describe, expect, it } from 'vitest';
import { duePetMe, petMeTimes, PET_ME } from './petme';
import { pickReaction, RARE } from '../chester/reactions';

describe('Pet me? moments', () => {
  it('has up to 3 a day, one in each third of 9 AM to 9 PM, the same all day', () => {
    for (const day of ['2026-11-23', '2026-11-24', '2026-12-25']) {
      const t = petMeTimes('chester', day);
      expect(t).toHaveLength(PET_ME.perDay);
      t.forEach((m, i) => { expect(m).toBeGreaterThanOrEqual(9 * 60 + 240 * i + 10); expect(m).toBeLessThanOrEqual(9 * 60 + 240 * (i + 1) - 10); });
      expect(petMeTimes('chester', day)).toEqual(t);
    }
    expect(petMeTimes('luna', '2026-11-23')).not.toEqual(petMeTimes('chester', '2026-11-23'));
  });
  it('is due once its time comes, never outside 9 to 9, and only the latest one', () => {
    const [a, b] = petMeTimes('chester', '2026-11-23');
    expect(duePetMe('chester', '2026-11-23', a - 1, [])).toBeNull();
    expect(duePetMe('chester', '2026-11-23', a, [])).toBe(0);
    expect(duePetMe('chester', '2026-11-23', a + 5, [0])).toBeNull();
    expect(duePetMe('chester', '2026-11-23', b + 1, [])).toBe(1); // opening late: the missed one doesn't stack up
    expect(duePetMe('chester', '2026-11-23', 21 * 60, [])).toBeNull();
    expect(duePetMe('chester', '2026-11-23', 8 * 60, [])).toBeNull();
  });
  it('makes rare moves likelier after a pet', () => {
    let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const count = (lucky: boolean) => { let n = 0; for (let i = 0; i < 4000; i++) if (RARE.includes(pickReaction(null, rand, true, lucky))) n++; return n; };
    expect(count(true)).toBeGreaterThan(count(false) * 2);
  });
});
