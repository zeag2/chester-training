import { describe, it, expect } from 'vitest';
import { dailyToday, newer, reminders, type CareItem } from './care';

const day = (s: string) => Date.parse(s + 'T12:00:00');
const item = <K extends CareItem['kind']>(kind: K, at: string, data: CareItem<K>['data'], extra: Partial<CareItem> = {}): CareItem =>
  ({ id: kind + at + Math.random(), catId: 'c', kind, at: day(at), updatedAt: day(at), data, ...extra }) as CareItem;

describe('care reminders', () => {
  it('lists the next due date of each medicine, using only its latest entry', () => {
    const r = reminders([
      item('med', '2026-10-01', { name: 'Revolution', what: 'flea', nextDue: '2026-11-01' }),
      item('med', '2026-11-01', { name: 'revolution ', what: 'flea', nextDue: '2026-12-01' }),
      item('med', '2026-11-01', { name: 'FVRCP booster', what: 'vaccine', nextDue: '2026-11-10' }),
    ], day('2026-11-08'));
    expect(r.map((x) => [x.title, x.daysLeft])).toEqual([['FVRCP booster', 2], ['revolution ', 23]]);
  });
  it('nudges grooming only once started, and flags it when overdue', () => {
    expect(reminders([], day('2026-11-08'))).toEqual([]);
    const r = reminders([item('groom', '2026-10-20', { what: 'nails' })], day('2026-11-08'));
    expect(r[0]).toMatchObject({ title: 'Trim nails', daysLeft: -5 });
  });
  it('ignores deleted items and anything more than a month away', () => {
    const r = reminders([
      item('med', '2026-11-01', { name: 'Dewormer', what: 'worm', nextDue: '2026-11-09' }, { deleted: true }),
      item('vet', '2026-11-01', { reason: 'Kitten checkup' }),
    ], day('2026-11-08'));
    expect(r).toEqual([]);
  });
  it('keeps the newest edit when two phones changed the same item', () => {
    const a = item('food', '2026-11-01', { name: 'Tuna pate', type: 'wet', verdict: 'love', current: true }, { id: 'x', updatedAt: 5 });
    const b = { ...a, updatedAt: 9, data: { ...a.data, verdict: 'no' } } as CareItem;
    expect(newer(a, b)).toBe(b); expect(newer(b, a)).toBe(b);
  });
  it('counts today’s one-tap logs, newest first, leaving out other days and deleted ones', () => {
    const now = Date.parse('2026-11-08T18:00:00');
    const d = (id: string, what: string, at: number, deleted = false) => ({ id, catId: 'c', kind: 'daily', at, updatedAt: at, deleted, data: { what } }) as CareItem;
    const t = dailyToday([d('a', 'fed', Date.parse('2026-11-08T07:00:00')), d('b', 'fed', Date.parse('2026-11-08T17:00:00')), d('c', 'fed', Date.parse('2026-11-07T17:00:00')), d('e', 'scoop', now, true), d('f', 'check', now)], now);
    expect(t.fed.map((x) => x.id)).toEqual(['b', 'a']); expect(t.scoop).toEqual([]); expect(t.check.map((x) => x.id)).toEqual(['f']);
  });
});
