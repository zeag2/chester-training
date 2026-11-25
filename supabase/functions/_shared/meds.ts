/* Medicine due today: shared by the app (Home's Medicine card, via `src/engine/care.ts`) and the `send-push` Edge
   Function (the daily medicine notification), so both always agree. Plain TypeScript with no imports, so it runs in
   the browser, in Vitest and in Deno. */

/** The parts of a care entry of kind `med` that this needs (the app's `CareItem<'med'>` fits). */
export interface MedEntry {
  kind: string;
  at: number;
  deleted?: boolean;
  data: { name: string; what: string; nextDue?: string; course?: { times: number; until: string } };
}

export interface MedDue<M extends MedEntry = MedEntry> {
  key: string; name: string; what: M['data']['what']; kind: 'course' | 'due';
  given: number; times: number; until?: string; daysLeft: number; last: M;
}

/** Calendar day (YYYY-MM-DD) for a timestamp, in `timeZone` (default: this device's). */
export function dayIn(ts: number, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const between = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/** Medicine to give today: a daily course still running with doses left today, or a dose whose next-due day has come
    (or passed). The latest entry per medicine name decides. `timeZone`: whose "today" (the server passes the
    person's; the app leaves it out). */
export function medsDue<M extends MedEntry>(items: readonly M[], now = Date.now(), timeZone?: string): MedDue<M>[] {
  const today = dayIn(now, timeZone);
  const meds = items.filter((i) => i.kind === 'med' && !i.deleted).sort((a, b) => a.at - b.at);
  const latest = new Map<string, M>();
  for (const m of meds) latest.set(m.data.name.trim().toLowerCase(), m);
  const out: MedDue<M>[] = [];
  for (const [k, m] of latest) {
    const c = m.data.course;
    if (c && c.times > 0 && dayIn(m.at, timeZone) <= today && today <= c.until) {
      const given = meds.filter((x) => x.data.name.trim().toLowerCase() === k && dayIn(x.at, timeZone) === today).length;
      if (given < c.times) out.push({ key: k, name: m.data.name, what: m.data.what, kind: 'course', given, times: c.times, until: c.until, daysLeft: 0, last: m });
    } else if (!c && m.data.nextDue && m.data.nextDue <= today) {
      out.push({ key: k, name: m.data.name, what: m.data.what, kind: 'due', given: 0, times: 1, daysLeft: between(today, m.data.nextDue), last: m });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 25" for 2026-11-25 (no time zone involved: it's already a calendar day). */
export const shortDay = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;

/** The line under a medicine, the same words as Home's Medicine card. */
export function dueLine(d: MedDue): string {
  if (d.kind === 'course') return `${d.given} of ${d.times} today · until ${shortDay(d.until!)}`;
  return d.daysLeft < 0 ? `Overdue by ${-d.daysLeft} day${d.daysLeft === -1 ? '' : 's'}` : 'Due today';
}
