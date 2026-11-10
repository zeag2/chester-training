/* Your vet: the household's vet contacts (the usual vet and an emergency vet), and the helpers the Health page uses
   to call them, get directions and book visits. Shared by the household like pets, newest edit wins. */
import { localDay } from './day';
import type { CareItem } from './care';

export type VetKind = 'primary' | 'emergency';
export interface VetData { kind: VetKind; clinic: string; vetName?: string; phone?: string; address?: string; website?: string; notes?: string }
export interface Vet {
  id: string;
  /** The household it belongs to; '' until this phone's pets are shared (then it's filled in on sync). */
  householdId: string;
  updatedAt: number;
  deleted?: boolean;
  by?: string;
  data: VetData;
}

/** The household's usual vet and emergency vet (the newest of each kind, deleted ones left out). */
export function yourVets(vets: Vet[]): { primary?: Vet; emergency?: Vet } {
  const live = vets.filter((v) => !v.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
  return { primary: live.find((v) => v.data.kind === 'primary'), emergency: live.find((v) => v.data.kind === 'emergency') };
}

/** A tel: link from a number as typed ("(555) 010-0100 ext 2" → tel:5550100100), or null when there are no digits. */
export function telHref(phone?: string): string | null {
  if (!phone) return null;
  const main = phone.split(/ext|x|#/i)[0];
  const digits = main.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 3 ? 'tel:' + digits : null;
}

/** Directions: Apple Maps on iPhone (other phones open Google Maps in the browser from the same link). */
export function mapsHref(v: VetData): string | null {
  const q = (v.address || '').trim() || (v.clinic || '').trim();
  return q ? 'https://maps.apple.com/?q=' + encodeURIComponent(q) : null;
}

/** "Is Maple Street Vet your vet?": the clinic named most often on past visits, for a one-tap start. */
export function suggestClinic(care: CareItem[]): string | null {
  const n = new Map<string, { name: string; count: number }>();
  for (const i of care) {
    if (i.kind !== 'vet' || i.deleted) continue;
    const c = ((i.data as { clinic?: string }).clinic ?? '').trim(); if (!c) continue;
    const k = c.toLowerCase(); const e = n.get(k) ?? { name: c, count: 0 }; e.count++; n.set(k, e);
  }
  return [...n.values()].sort((a, b) => b.count - a.count)[0]?.name ?? null;
}

/** A visit's time ("14:30", from a time input) the way the app shows it everywhere: "2:30 PM". '' when there's none. */
export function fmtTime(t?: string): string {
  const m = t ? /^(\d{1,2}):(\d{2})/.exec(t) : null;
  if (!m) return t ?? '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A visit is booked (still to come) when marked so, or when its date is after today (older entries had no status). */
export function isBooked(i: CareItem, now = Date.now()): boolean {
  if (i.kind !== 'vet') return false;
  const s = (i.data as { status?: string }).status;
  return s === 'booked' || (s !== 'done' && localDay(i.at) > localDay(now));
}

/** The next booked visit (soonest first, including one booked for today) and the last one that happened. */
export function visits(care: CareItem[], now = Date.now()): { next?: CareItem<'vet'>; last?: CareItem<'vet'>; due?: CareItem<'vet'> } {
  const vs = care.filter((i): i is CareItem<'vet'> => i.kind === 'vet' && !i.deleted);
  const today = localDay(now);
  const booked = vs.filter((v) => isBooked(v, now) || ((v.data as { status?: string }).status === 'booked')).sort((a, b) => a.at - b.at);
  const upcoming = booked.filter((v) => localDay(v.at) >= today);
  // a booked visit whose day has passed: ask how it went (the after-visit prompt)
  const due = booked.filter((v) => localDay(v.at) < today).pop();
  const last = vs.filter((v) => !booked.includes(v)).sort((a, b) => b.at - a.at)[0];
  return { next: upcoming[0], last, due };
}

export const VISIT_REASONS = ['Checkup', 'Vaccines', 'Sick', 'Follow-up'] as const;

/** A date to book for something due on `due`: that day, or tomorrow when it's today or past, moved off a Sunday
    (most clinics are closed). The person can change it; it just starts near the right day. */
export function bookingDay(due: string, now = Date.now()): string {
  const tomorrow = localDay(now + 864e5);
  const d = new Date((due > tomorrow ? due : tomorrow) + 'T12:00:00');
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return localDay(d.getTime());
}

/** After a visit: the vaccines it gave whose next dose is still to come, soonest first, for "Book the next one?".
    Nothing when a visit is already booked from today on (that one is the next one). */
export function nextVaccines(doses: CareItem[], care: CareItem[], now = Date.now()): { due: string; names: string[] } | null {
  const today = localDay(now);
  if (care.some((i) => i.kind === 'vet' && !i.deleted && isBooked(i, now) && localDay(i.at) >= today)) return null;
  const vs = doses.filter((d): d is CareItem<'med'> => d.kind === 'med' && !d.deleted).filter((d) => d.data.what === 'vaccine' && !!d.data.nextDue && d.data.nextDue > today)
    .sort((a, b) => a.data.nextDue!.localeCompare(b.data.nextDue!));
  if (!vs.length) return null;
  const due = vs[0].data.nextDue!;
  return { due, names: vs.filter((v) => v.data.nextDue === due).map((v) => v.data.name) };
}
