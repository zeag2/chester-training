import { describe, it, expect } from 'vitest';
import { summaryText, vetSummary } from './vetsummary';
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

describe('vet summary: visits, documents and the text to share', () => {
  const at = (day: string) => Date.parse(day + 'T12:00:00');
  const item = (id: string, kind: CareItem['kind'], day: string, data: object): CareItem => ({ id, catId: 'c', kind, at: at(day), updatedAt: 1, data } as CareItem);
  const care = [
    item('v1', 'vet', '2026-10-20', { reason: 'Checkup', clinic: 'Maple Street Vet', notes: 'Healthy', status: 'done' }),
    item('v2', 'vet', '2026-11-24', { reason: 'Booster', time: '10:30', status: 'booked' }),
    item('d1', 'doc', '2026-10-20', { title: 'Invoice', path: 'c/d1.pdf', mime: 'application/pdf', bytes: 1, visitId: 'v1' }),
    item('d2', 'doc', '2026-06-01', { title: 'Rabies certificate', path: 'c/d2.pdf', mime: 'application/pdf', bytes: 1 }),
    item('d3', 'doc', '2026-11-01', { title: 'Lab results', path: 'c/d3.pdf', mime: 'application/pdf', bytes: 1 }),
    item('d4', 'doc', '2026-11-02', { title: 'ESA letter', path: 'c/d4.pdf', mime: 'application/pdf', bytes: 1 }),
  ];
  const s = vetSummary(care, now);
  it('lists visits that happened (with notes and documents) and the next booked one apart', () => {
    expect(s.visits).toEqual([{ id: 'v1', day: '2026-10-20', reason: 'Checkup', clinic: 'Maple Street Vet', notes: 'Healthy', docs: 1 }]);
    expect(s.next).toEqual({ id: 'v2', day: '2026-11-24', time: '10:30', reason: 'Booster', clinic: undefined });
  });
  it('puts the newest vaccine paperwork first, then the newest others, 3 in all', () => {
    expect(s.docs.map((d) => d.id)).toEqual(['d2', 'd4', 'd3']);
    expect(s.docs[0].vaccine).toBe(true);
  });
  it('shares as plain text with the vet at the top', () => {
    const t = summaryText('Chester', '6 months · male', s, { kind: 'primary', clinic: 'Maple Street Vet', vetName: 'Dr. Patel', phone: '555-0100' });
    expect(t.split('\n').slice(0, 3)).toEqual(['Chester: health summary', '6 months · male', 'Vet: Maple Street Vet, Dr. Patel, 555-0100']);
    expect(t).toContain('- Oct 20, 2026: Checkup at Maple Street Vet. Healthy');
    expect(t).toContain('Next visit\n- Nov 24, 2026 10:30 AM: Booster');
    expect(t).toContain('- Rabies certificate (Jun 1, 2026)');
    expect(t).toContain('Medicine and vaccines\nNone logged.');
  });
});

describe('vet summary: a booked visit whose day passed', () => {
  const at = (day: string) => Date.parse(day + 'T12:00:00');
  const item = (id: string, day: string, data: object): CareItem => ({ id, catId: 'c', kind: 'vet', at: at(day), updatedAt: 1, data } as CareItem);
  const s = vetSummary([item('v1', '2026-10-20', { reason: 'Checkup', status: 'done' }), item('v2', '2026-11-05', { reason: 'Booster', time: '14:30', status: 'booked' }),
    item('v3', '2026-11-09', { reason: 'Recheck', time: '14:30', status: 'booked' })], now);
  it('shows in recent visits, marked as not confirmed (today’s booked visit is still next)', () => {
    expect(s.visits.map((v) => [v.id, !!v.unconfirmed])).toEqual([['v2', true], ['v1', false]]);
    expect(s.next?.id).toBe('v3');
  });
  it('says so in the shared text, and the next visit’s time is 12-hour', () => {
    const t = summaryText('Chester', '', s);
    expect(t).toContain('- Nov 5, 2026: Booster (booked, not marked done)');
    expect(t).toContain('- Nov 9, 2026 2:30 PM: Recheck');
  });
});
