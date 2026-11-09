import { describe, it, expect } from 'vitest';
import { kittenPlan } from './kittenplan';
import type { CareItem } from './care';

const at = (s: string) => Date.parse(s + 'T12:00:00');
const med = (name: string, day: string): CareItem => ({ id: name + day, catId: 'c', kind: 'med', at: at(day), updatedAt: 1, data: { name, what: 'vaccine' } } as CareItem);

describe('kitten vaccine plan', () => {
  it('ticks off what was logged, by name, and counts the series', () => {
    const p = kittenPlan({ birthday: '2026-04', sex: 'm' }, [med('FVRCP', '2026-06-10'), med('Distemper combo', '2026-07-08'), med('Rabies', '2026-08-01'), med('FeLV', '2026-06-10')], at('2026-11-09'))!;
    const by = Object.fromEntries(p.map((s) => [s.key, s]));
    expect([by.core.done, by.core.progress]).toEqual([false, '2 of about 3 logged']); // last dose at ~2.8 months: not done yet
    expect(kittenPlan({ birthday: '2026-04' }, [med('FVRCP', '2026-08-20')], at('2026-11-09'))!.find((s) => s.key === 'core')!.done).toBe(true); // a dose at 16+ weeks
    expect(by.rabies.done).toBe(true); expect([by.felv.done, by.felv.progress]).toEqual([false, '1 of 2 logged']);
    expect([by.spay.title, by.spay.done]).toEqual(['Neuter', false]); expect(by.boost.done).toBe(false);
    expect(kittenPlan({ birthday: '2026-04', sex: 'f', altered: true }, [], at('2026-11-09'))!.find((s) => s.key === 'spay')).toMatchObject({ title: 'Spay', done: true });
  });
  it('is only for pets under 18 months', () => { expect(kittenPlan({ birthday: '2024-01' }, [], at('2026-11-09'))).toBeNull(); });
});
