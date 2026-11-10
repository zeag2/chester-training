import { describe, it, expect } from 'vitest';
import type { CareItem, DailyWhat } from './care';
import { atTimeOfDay, dailyLogDays, hhmm } from './dailylog';
import { localDay } from './day';

const now = new Date(2026, 10, 10, 18, 0).getTime();
const daily = (id: string, what: DailyWhat, at: number, extra: Partial<CareItem> = {}): CareItem =>
  ({ id, catId: 'c', kind: 'daily', at, updatedAt: at, data: { what }, ...extra }) as CareItem;
const h = (dayOffset: number, hour: number) => new Date(2026, 10, 10 + dayOffset, hour, 0).getTime();

describe('dailyLogDays', () => {
  const items = [
    daily('a', 'fed', h(0, 8)), daily('b', 'fed', h(0, 17)), daily('c', 'scoop', h(0, 9)),
    daily('d', 'play', h(-1, 20)), daily('e', 'fed', h(-1, 8), { deleted: true }), daily('f', 'fed', h(-9, 8)),
    { id: 'w', catId: 'c', kind: 'weight', at: h(0, 7), updatedAt: 0, data: { lb: 4 } } as CareItem,
  ];
  it('groups by day, newest first, leaving out deleted, old and non-daily entries', () => {
    const out = dailyLogDays(items, 7, now);
    expect(out.map((g) => g.day)).toEqual([localDay(h(0, 12)), localDay(h(-1, 12))]);
    expect(out[0].items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(out[1].items.map((i) => i.id)).toEqual(['d']);
  });
  it('can show just today and just one kind', () => {
    expect(dailyLogDays(items, 1, now, 'fed')).toEqual([{ day: localDay(now), items: [items[1], items[0]] }]);
    expect(dailyLogDays(items, 1, now, 'play')).toEqual([]);
  });
});

describe('changing an entry’s time', () => {
  it('keeps the day and sets the new time', () => {
    const at = atTimeOfDay(h(-1, 20), '07:05')!;
    expect(localDay(at)).toBe(localDay(h(-1, 20)));
    expect(hhmm(at)).toBe('07:05');
  });
  it('refuses an empty or bad time', () => {
    expect(atTimeOfDay(now, '')).toBeNull();
    expect(atTimeOfDay(now, '25:00')).toBeNull();
  });
});
