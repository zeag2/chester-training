import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, icsFor, weekBefore } from './calendar';

describe('add to calendar', () => {
  it('makes an all-day event with a reminder the day before, escaping text', () => {
    const ics = icsFor({ title: 'Chester: vet, shots; checkup', day: '2026-12-03', place: 'Main St Vet' }, 'x');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261203'); expect(ics).toContain('DTEND;VALUE=DATE:20261204');
    expect(ics).toContain('SUMMARY:Chester: vet\\, shots\\; checkup'); expect(ics).toContain('TRIGGER:-P1D'); expect(ics).toContain('LOCATION:Main St Vet');
  });
  it('uses a timed slot when a time is given, and builds a Google link', () => {
    expect(icsFor({ title: 'Vet', day: '2026-12-03', time: '09:30' }, 'x')).toContain('DTSTART:20261203T093000');
    const u = new URL(googleCalendarUrl({ title: 'Vet', day: '2026-12-03', time: '09:30', minutes: 30 }));
    expect(u.searchParams.get('dates')).toBe('20261203T093000/20261203T100000');
    // local times, so the link names the phone's time zone
    expect(u.searchParams.get('ctz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('adds a reminder a week before for visits booked more than 7 days out', () => {
    const now = Date.parse('2026-11-10T09:00:00');
    expect(weekBefore({ title: 'Vet', day: '2026-11-17' }, now)).toBeNull();
    expect(weekBefore({ title: 'Vet', day: '2026-11-24' }, now)).toBe('2026-11-17');
    expect(icsFor({ title: 'Vet', day: '2026-11-17' }, 'x', now)).not.toContain('TRIGGER:-P7D');
    const ics = icsFor({ title: 'Vet', day: '2026-11-24', time: '10:30' }, 'x', now);
    expect(ics).toContain('TRIGGER:-P7D'); expect(ics).toContain('TRIGGER:-PT2H'); expect(ics).toContain('TRIGGER:-P1D');
    // Google links can't set reminders: the details say when
    const u = new URL(googleCalendarUrl({ title: 'Vet', day: '2026-11-24', notes: 'Phone: 555' }, now));
    expect(u.searchParams.get('details')).toMatch(/^Phone: 555\nReminder: a week before, .*17/);
    expect(new URL(googleCalendarUrl({ title: 'Vet', day: '2026-11-12' }, now)).searchParams.get('details')).toBeNull();
  });
});
