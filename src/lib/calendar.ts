/* Add an appointment to the phone's calendar: an .ics file (iPhone and Mac open it in Calendar) or a Google
   Calendar link. Appointments are all-day unless a time is given (local time). */
/** `uid`: a stable id (e.g. per visit) so adding it again updates the event instead of making a second one. */
export interface CalEvent { title: string; day: string; time?: string; minutes?: number; place?: string; notes?: string; uid?: string;
  /** times this event was changed: a re-sent .ics with the same `uid` and a higher `seq` replaces the old one */
  seq?: number;
  /** sends STATUS:CANCELLED (no reminders), so the calendar drops or strikes out the event */
  cancelled?: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
function span(e: CalEvent): [string, string, boolean] {
  if (!e.time) { const d = new Date(e.day + 'T12:00:00'); const n = new Date(d.getTime() + 864e5); const f = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`; return [f(d), f(n), true]; }
  const s = new Date(`${e.day}T${e.time}:00`); return [stamp(s), stamp(new Date(s.getTime() + (e.minutes ?? 60) * 6e4)), false];
}

const DAY = 864e5;
const today = (now: number) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
/** The day a week before the appointment, when it's booked more than 7 days out (else null): such visits get a
    reminder a week ahead too, to arrange a carrier, time off, fasting. */
export function weekBefore(e: CalEvent, now = Date.now()): string | null {
  const day = new Date(e.day + 'T00:00:00').getTime();
  if (!Number.isFinite(day) || Math.round((day - today(now)) / DAY) <= 7) return null;
  const w = new Date(day - 7 * DAY + 12 * 36e5); return `${w.getFullYear()}-${pad(w.getMonth() + 1)}-${pad(w.getDate())}`;
}

export function icsFor(e: CalEvent, uid = e.uid ?? Math.random().toString(36).slice(2), now = Date.now()): string {
  const [a, b, allDay] = span(e);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PalDex//EN', 'BEGIN:VEVENT', `UID:${uid}@paldex`, `DTSTAMP:${stamp(new Date())}`, `SEQUENCE:${e.seq ?? 0}`, `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    allDay ? `DTSTART;VALUE=DATE:${a}` : `DTSTART:${a}`, allDay ? `DTEND;VALUE=DATE:${b}` : `DTEND:${b}`, `SUMMARY:${e.cancelled ? 'Cancelled: ' : ''}${esc(e.title)}`,
    ...(e.place ? [`LOCATION:${esc(e.place)}`] : []), ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
    // a cancelled event carries no reminders
    ...(e.cancelled ? [] : [
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM',
    // a timed appointment also reminds 2 hours before
    ...(allDay ? [] : ['BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM']),
    // booked more than a week out: a week before as well
    ...(weekBefore(e, now) ? ['BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)} (in a week)`, 'END:VALARM'] : [])]),
    'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

export function googleCalendarUrl(e: CalEvent, now = Date.now()): string {
  const [a, b] = span(e);
  // a Google link can't set reminders, so say when the week-before one would be in the details
  const wk = weekBefore(e, now);
  const details = [e.notes, wk && `Reminder: a week before, ${new Date(wk + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`].filter(Boolean).join('\n');
  // times are the phone's local time: say which zone, so Google doesn't read them in the calendar's own zone
  let ctz = ''; try { ctz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* old browser */ }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${a}/${b}`, ...(ctz ? { ctz } : {}), ...(e.place ? { location: e.place } : {}), ...(details ? { details } : {}) });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

/** Open the .ics so the phone offers "Add to Calendar". */
export function downloadIcs(e: CalEvent) {
  const url = URL.createObjectURL(new Blob([icsFor(e)], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = e.cancelled ? 'vet-visit-cancelled.ics' : 'vet-visit.ics'; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
