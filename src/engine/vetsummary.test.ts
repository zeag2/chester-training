import { describe, it, expect } from 'vitest';
import { vetSummary } from './vetsummary';
import type { CareItem } from './care';

const now = Date.parse('2026-11-09T12:00:00'); const d = 864e5;
const c = (kind: CareItem['kind'], data: object, ago: number, deleted = false): CareItem => ({ id: Math.random() + '', catId: 'c', kind, at: now - ago * d, updatedAt: 1, deleted, data } as CareItem);

describe('vet summary', () => {
  it('keeps the latest dose per medicine, recent symptoms only, and counts daily checks', () => {
    const s = vetSummary([c('med', { name: 'Revolution', what: 'flea', nextDue: '2026-12-01' }, 2), c('med', { name: 'revolution', what: 'flea' }, 40),
      c('symptom', { what: 'Sneezing' }, 5), c('symptom', { what: 'Hiding' }, 90), c('weight', { lb: 4.4 }, 1), c('weight', { lb: 9 }, 3, true),
      c('daily', { what: 'check', ok: true }, 0), c('daily', { what: 'check', ok: false }, 1), c('food', { name: 'Tuna', current: true }, 9)], now);
    expect(s.doses).toEqual([{ name: 'Revolution', what: 'flea', given: '2026-11-07', nextDue: '2026-12-01' }]);
    expect(s.symptoms.map((x) => x.what)).toEqual(['Sneezing']);
    expect(s.weights).toEqual([{ day: '2026-11-08', lb: 4.4 }]);
    expect(s.checks).toEqual({ days: 2, off: 1 });
    expect(s.foods).toEqual(['Tuna']);
  });
});
