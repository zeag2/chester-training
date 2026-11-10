import { localDay } from './day';
import type { CareItem, DailyWhat } from './care';

/** The one-tap logs (Fed, Scooped, Played, daily check) of the last `days` days, grouped by day: newest day first,
    newest entry first, deleted ones left out. `what`: only that kind. For the sheet that lists them to fix mistakes. */
export function dailyLogDays(items: CareItem[], days: number, now = Date.now(), what?: DailyWhat): { day: string; items: CareItem<'daily'>[] }[] {
  const keep = new Set<string>();
  for (let i = 0; i < days; i++) { const d = new Date(now); d.setDate(d.getDate() - i); keep.add(localDay(d.getTime())); }
  const by = new Map<string, CareItem<'daily'>[]>();
  for (const it of items) {
    if (it.kind !== 'daily' || it.deleted) continue;
    const d = it as CareItem<'daily'>; if (what && d.data.what !== what) continue;
    const day = localDay(d.at); if (!keep.has(day)) continue;
    by.set(day, [...(by.get(day) ?? []), d]);
  }
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, list]) => ({ day, items: list.sort((a, b) => b.at - a.at) }));
}

/** "07:40" for an `<input type="time">`, in the phone's time zone. */
export function hhmm(at: number): string {
  const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** The same day as `at`, at the time "HH:MM" (phone's time zone). Null for an empty or bad time. */
export function atTimeOfDay(at: number, time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time); if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]); if (h > 23 || min > 59) return null;
  const d = new Date(at); d.setHours(h, min, 0, 0); return d.getTime();
}
