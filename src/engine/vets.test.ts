import { describe, it, expect } from 'vitest';
import { fmtTime, isBooked, mapsHref, suggestClinic, telHref, visits, yourVets, type Vet } from './vets';
import { reminders, type CareItem } from './care';

const day = (s: string) => Date.parse(s + 'T12:00:00');
const vet = (at: string, data: Record<string, unknown>, extra: Partial<CareItem> = {}): CareItem => ({ id: 'v' + at + Math.random(), catId: 'c', kind: 'vet', at: day(at), updatedAt: day(at), data: { reason: 'Checkup', ...data }, ...extra }) as CareItem;
const NOW = Date.parse('2026-11-10T09:00:00');

describe('your vet', () => {
  it('picks the newest usual vet and emergency vet', () => {
    const v = (id: string, kind: 'primary' | 'emergency', t: number, deleted = false): Vet => ({ id, householdId: 'h', updatedAt: t, deleted, data: { kind, clinic: id } });
    const r = yourVets([v('old', 'primary', 1), v('new', 'primary', 2), v('er', 'emergency', 1), v('gone', 'emergency', 5, true)]);
    expect([r.primary?.id, r.emergency?.id]).toEqual(['new', 'er']);
  });
  it('makes call and directions links from what was typed', () => {
    expect(telHref('(555) 010-0100 ext 2')).toBe('tel:5550100100');
    expect(telHref('+1 555 010 0100')).toBe('tel:+15550100100');
    expect(telHref('ask Erin')).toBeNull();
    expect(mapsHref({ kind: 'primary', clinic: 'Maple Street Vet', address: '12 Maple St, Springfield' })).toBe('https://maps.apple.com/?q=12%20Maple%20St%2C%20Springfield');
    expect(mapsHref({ kind: 'primary', clinic: 'Maple Street Vet' })).toBe('https://maps.apple.com/?q=Maple%20Street%20Vet');
  });
  it('suggests the clinic named most on past visits', () => {
    expect(suggestClinic([vet('2026-09-01', { clinic: 'Maple Street Vet' }), vet('2026-10-01', { clinic: 'maple street vet ' }), vet('2026-10-05', { clinic: 'CityPets' })])).toBe('Maple Street Vet');
    expect(suggestClinic([])).toBeNull();
  });
});

describe('visits', () => {
  it('splits booked visits from past ones, and asks how a past booking went', () => {
    const items = [vet('2026-10-20', { reason: 'Checkup + rabies' }), vet('2026-11-24', { reason: 'Booster', status: 'booked', time: '10:30' }), vet('2026-11-05', { reason: 'Follow-up', status: 'booked' })];
    const v = visits(items, NOW);
    expect(v.next?.data.reason).toBe('Booster');
    expect(v.last?.data.reason).toBe('Checkup + rabies');
    expect(v.due?.data.reason).toBe('Follow-up');
    expect(isBooked(vet('2026-12-01', {}), NOW)).toBe(true); // an old future-dated entry counts as booked
    expect(isBooked(vet('2026-12-01', { status: 'done' }), NOW)).toBe(false);
  });
  it('lists a booked visit in Coming up and doesn’t let it push back the yearly checkup', () => {
    const r = reminders([vet('2025-12-01', { reason: 'Checkup' }), vet('2026-11-24', { reason: 'Booster', status: 'booked', clinic: 'Maple' })], NOW);
    expect(r.find((x) => x.kind === 'visit')).toMatchObject({ title: 'Vet: Booster', dueDay: '2026-11-24', daysLeft: 14 });
    expect(r.find((x) => x.id === 'vet:yearly')).toBeUndefined(); // the booking satisfies it
  });
  it('counts the yearly checkup from the last real visit, never a year past a booking', () => {
    const past = vet('2025-11-01', { reason: 'Checkup' });
    // overdue with nothing booked
    expect(reminders([past], NOW).find((x) => x.id === 'vet:yearly')).toMatchObject({ dueDay: '2026-11-01', daysLeft: -9 });
    // booked (with or without a status): the booking stands in for it, nothing dated 2027
    for (const b of [vet('2026-12-05', { status: 'booked' }), vet('2026-12-05', {})]) {
      const r = reminders([past, b], NOW);
      expect(r.find((x) => x.id === 'vet:yearly')).toBeUndefined();
      expect(r.some((x) => x.dueDay.startsWith('2027'))).toBe(false);
    }
    // a booking whose day has passed counts as the last visit, even before "How did it go?" is answered
    const r = reminders([past, vet('2026-11-05', { status: 'booked' })], Date.parse('2027-10-20T09:00:00'));
    expect(r.find((x) => x.id === 'vet:yearly')).toMatchObject({ dueDay: '2027-11-05' });
  });
});

describe('visit times', () => {
  it('shows 12-hour times', () => {
    expect([fmtTime('14:30'), fmtTime('09:05'), fmtTime('00:15'), fmtTime('12:00'), fmtTime(undefined)]).toEqual(['2:30 PM', '9:05 AM', '12:15 AM', '12:00 PM', '']);
  });
});
