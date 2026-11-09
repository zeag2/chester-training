/* Add an appointment to the phone's calendar: an .ics file (iPhone and Mac open it in Calendar) or a Google
   Calendar link. Appointments are all-day unless a time is given (local time). */
export interface CalEvent { title: string; day: string; time?: string; minutes?: number; place?: string; notes?: string }

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
function span(e: CalEvent): [string, string, boolean] {
  if (!e.time) { const d = new Date(e.day + 'T12:00:00'); const n = new Date(d.getTime() + 864e5); const f = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`; return [f(d), f(n), true]; }
  const s = new Date(`${e.day}T${e.time}:00`); return [stamp(s), stamp(new Date(s.getTime() + (e.minutes ?? 60) * 6e4)), false];
}

export function icsFor(e: CalEvent, uid = Math.random().toString(36).slice(2)): string {
  const [a, b, allDay] = span(e);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PalDex//EN', 'BEGIN:VEVENT', `UID:${uid}@paldex`, `DTSTAMP:${stamp(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${a}` : `DTSTART:${a}`, allDay ? `DTEND;VALUE=DATE:${b}` : `DTEND:${b}`, `SUMMARY:${esc(e.title)}`,
    ...(e.place ? [`LOCATION:${esc(e.place)}`] : []), ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}

export function googleCalendarUrl(e: CalEvent): string {
  const [a, b] = span(e);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${a}/${b}`, ...(e.place ? { location: e.place } : {}), ...(e.notes ? { details: e.notes } : {}) });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

/** Open the .ics so the phone offers "Add to Calendar". */
export function downloadIcs(e: CalEvent) {
  const url = URL.createObjectURL(new Blob([icsFor(e)], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = 'vet-visit.ics'; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
