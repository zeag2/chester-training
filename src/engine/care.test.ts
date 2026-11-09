import { describe, it, expect } from 'vitest';
import { dailyToday, entryTime, lastOf, newer, nextDueLike, recentMeds, reminders, type CareItem } from './care';

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

import { typicalKittenWeight } from './care';
describe('kitten weight guide', () => {
  it('is about a pound a month to 6 months, wider after, and nothing for adults or newborns', () => {
    const at = (s: string) => Date.parse(s + 'T12:00:00');
    expect(typicalKittenWeight('2026-08', at('2026-11-20'))).toEqual({ months: 3, low: 2.5, high: 3.5 });
    expect(typicalKittenWeight('2026-04', at('2026-11-20'))).toEqual({ months: 7, low: 5, high: 10 });
    expect(typicalKittenWeight('2025-01', at('2026-11-20'))).toBeNull();
    expect(typicalKittenWeight('2026-11', at('2026-11-20'))).toBeNull();
  });
});

describe('smart defaults', () => {
  it('stamps today’s entries with the time now, other days with noon, and keeps an edit’s time if its day stays', () => {
    const now = Date.parse('2026-11-09T08:15:00');
    expect(entryTime('2026-11-09', now)).toBe(now);
    expect(entryTime('2026-11-07', now)).toBe(day('2026-11-07'));
    const was = Date.parse('2026-11-07T19:40:00');
    expect(entryTime('2026-11-07', now, was)).toBe(was);
    expect(entryTime('2026-11-06', now, was)).toBe(day('2026-11-06'));
  });
  it('finds the newest entry of a kind, skipping deleted ones', () => {
    const items = [item('weight', '2026-11-01', { lb: 6 }), item('weight', '2026-11-08', { lb: 6.4 }, { deleted: true }), item('weight', '2026-10-20', { lb: 5.8 })];
    expect((lastOf(items, 'weight') as CareItem<'weight'>).data.lb).toBe(6);
    expect(lastOf(items, 'vet')).toBeUndefined();
  });
  it('offers recent medicines once each, newest first, and repeats last time’s gap to the next dose', () => {
    const items = [
      item('med', '2026-09-01', { name: 'Revolution', what: 'flea', nextDue: '2026-10-01' }),
      item('med', '2026-10-01', { name: 'revolution ', what: 'flea', nextDue: '2026-10-31', notes: '0.25 ml' }),
      item('med', '2026-10-15', { name: 'FVRCP booster', what: 'vaccine' }),
      item('med', '2026-11-01', { name: 'Dewormer', what: 'worm' }, { deleted: true }),
    ];
    const r = recentMeds(items) as CareItem<'med'>[];
    expect(r.map((m) => m.data.name)).toEqual(['FVRCP booster', 'revolution ']);
    expect(nextDueLike(r[1], '2026-11-09')).toBe('2026-12-09');
    expect(nextDueLike(r[0], '2026-11-09')).toBe('');
  });
});
