import { describe, it, expect } from 'vitest';
import { weekSummary } from './week';
import type { CareItem } from './care';
import type { SetRecord } from './types';

const now = Date.parse('2026-11-08T18:00:00'); const day = 864e5;
const care = (kind: CareItem['kind'], data: object, ago: number, by = 'josh'): CareItem => ({ id: Math.random() + '', catId: 'c', kind, at: now - ago * day, updatedAt: 1, by, data } as CareItem);

describe('weekly recap', () => {
  it('sums the last 7 days: one-tap logs, weight change, symptoms, sets and who did what', () => {
    const items = [care('daily', { what: 'fed' }, 0), care('daily', { what: 'fed' }, 1, 'meg'), care('daily', { what: 'scoop' }, 2),
      care('daily', { what: 'check', ok: true }, 0), care('daily', { what: 'check', ok: false }, 3), care('daily', { what: 'fed' }, 9),
      care('weight', { lb: 4.0 }, 12), care('weight', { lb: 4.4 }, 1), care('symptom', { what: 'Sneezing' }, 2, 'meg')];
    const sets = [{ at: now - day, day: '2026-11-07', reps: 10, good: 8, by: 'meg' }, { at: now - 20 * day, day: '2026-10-19', reps: 5, good: 5 }] as SetRecord[];
    const w = weekSummary(items, sets, { log: [{ id: 'treat-erin-2026-11-07', kind: 'treat', day: '2026-11-07', at: now - day, treats: 1, bond: 0 }] }, now);
    expect([w.meals, w.scoops, w.checks, w.checksOff]).toEqual([2, 1, 2, 1]);
    expect(w.weight).toEqual({ now: 4.4, before: 4.0 });
    expect(w.symptoms).toEqual(['Sneezing']);
    expect([w.sets, w.goodRate, w.daysTrained]).toEqual([1, 80, 1]);
    expect(w.byPerson).toEqual({ josh: 5, meg: 3 }); // fed, scoop, two checks and the weigh-in
    expect(w.friendTreats).toBe(1);
    expect([w.from, w.to]).toEqual(['2026-11-02', '2026-11-08']);
  });
});
