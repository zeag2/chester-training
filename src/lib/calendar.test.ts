import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, icsFor } from './calendar';

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
});
