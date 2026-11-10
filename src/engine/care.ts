/* Chester's care: food profiles and a health log, shared like training sets.
   Items can be edited and deleted (unlike sets), so each carries updatedAt and a deleted flag; the newest edit wins. */
import { daysBetween, localDay } from './day';

export type CareKind = 'food' | 'vet' | 'symptom' | 'weight' | 'groom' | 'med' | 'doc' | 'daily';
/** One-tap everyday logs: a meal, a litter scoop, a play session, or the daily health check. */
export type DailyWhat = 'fed' | 'scoop' | 'play' | 'check';
export type Verdict = 'love' | 'ok' | 'no';
export type FoodType = 'dry' | 'wet' | 'treat' | 'other';
export type GroomWhat = 'brush' | 'nails' | 'bath' | 'teeth' | 'ears';
export type MedWhat = 'vaccine' | 'flea' | 'worm' | 'medicine';

export interface CareData {
  food: { name: string; brand?: string; type: FoodType; verdict: Verdict; current: boolean; notes?: string; code?: string; ingredients?: string; image?: string };
  /** `time` (HH:MM): for an upcoming appointment, so it can go in the calendar. */
  vet: { reason: string; clinic?: string; notes?: string; doc?: string; time?: string; vetId?: string; status?: 'booked' | 'done' };
  symptom: { what: string; worried?: boolean; notes?: string };
  /** `visitId`: the visit it was weighed at (from the visit page). */
  weight: { lb: number; doc?: string; visitId?: string };
  groom: { what: GroomWhat; notes?: string };
  med: { name: string; what: MedWhat; nextDue?: string; notes?: string; doc?: string; visitId?: string };
  /** A vet document stored in the shared bucket at `path` (<cat id>/<doc id>.<ext>). */
  /** `ok`: the daily check said all normal (false: something's off, see the symptom logged with it). */
  daily: { what: DailyWhat; ok?: boolean; minutes?: number; notes?: string };
  doc: { title: string; path: string; mime: string; bytes: number; docDate?: string; summary?: string; categories?: ('vet' | 'esa' | 'adoption' | 'other')[];
    /** The visit it came from, and what kind of paper it is (see `src/engine/docs.ts`). */
    visitId?: string; type?: 'vaccine' | 'invoice' | 'lab' | 'discharge' | 'other' };
}

/** What the vet-document reader found, for the user to confirm. */
export interface DocReading {
  title: string; docDate: string | null; clinic: string | null; visitReason: string | null; vetNotes: string | null; weightLb: number | null;
  items: { name: string; kind: MedWhat; date: string | null; nextDue: string | null; notes: string | null }[];
  summary: string;
}

export interface CareItem<K extends CareKind = CareKind> {
  id: string;
  catId: string;
  kind: K;
  /** When it happened (food: when added). */
  at: number;
  updatedAt: number;
  deleted?: boolean;
  /** Account id of whoever last saved it. */
  by?: string;
  data: CareData[K];
}

export const SYMPTOMS = ['Threw up', 'Diarrhea', 'Not eating', 'Eating less', 'Hiding', 'Sneezing', 'Eye goop', 'Scratching a lot', 'Litter box change', 'Low energy', 'Limping', 'Other'];
export const GROOM: Record<GroomWhat, { label: string; everyDays?: number }> = {
  brush: { label: 'Brushed', everyDays: 7 }, nails: { label: 'Nails trimmed', everyDays: 14 },
  bath: { label: 'Bath' }, teeth: { label: 'Teeth brushed' }, ears: { label: 'Ears cleaned' },
};
export const MED_LABEL: Record<MedWhat, string> = { vaccine: 'Vaccine', flea: 'Flea treatment', worm: 'Dewormer', medicine: 'Medicine' };
export const VERDICT_LABEL: Record<Verdict, string> = { love: 'Loves it', ok: 'It’s OK', no: 'Won’t eat it' };

/** Merge one item from the shared copy into the local one: the newest edit wins, deletes included. */
export function newer<T extends { updatedAt: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b; if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export interface Reminder { id: string; title: string; detail: string; dueDay: string; daysLeft: number; kind: 'med' | 'groom' | 'vet' | 'visit' }

/** What's coming up: medicine and vaccine due dates, grooming that's getting overdue, the yearly checkup. */
export function reminders(items: CareItem[], now = Date.now()): Reminder[] {
  const today = localDay(now);
  const live = items.filter((i) => !i.deleted);
  const out: Reminder[] = [];
  // the latest entry per medicine name decides its next due date
  const meds = new Map<string, CareItem<'med'>>();
  for (const m of live.filter((i): i is CareItem<'med'> => i.kind === 'med').sort((a, b) => a.at - b.at)) meds.set(m.data.name.trim().toLowerCase(), m);
  for (const m of meds.values()) {
    if (!m.data.nextDue) continue;
    out.push({ id: 'med:' + m.id, kind: 'med', title: m.data.name, detail: MED_LABEL[m.data.what], dueDay: m.data.nextDue, daysLeft: daysBetween(today, m.data.nextDue) });
  }
  for (const [what, g] of Object.entries(GROOM) as [GroomWhat, (typeof GROOM)[GroomWhat]][]) {
    if (!g.everyDays) continue;
    const last = live.filter((i): i is CareItem<'groom'> => i.kind === 'groom' && (i as CareItem<'groom'>).data.what === what).sort((a, b) => b.at - a.at)[0];
    if (!last) continue; // only nudge for routines you've started
    const due = localDay(last.at + g.everyDays * 864e5);
    out.push({ id: 'groom:' + what, kind: 'groom', title: what === 'nails' ? 'Trim nails' : 'Brush', detail: `Every ${g.everyDays} days`, dueDay: due, daysLeft: daysBetween(today, due) });
  }
  // a booked visit (still to come) is listed as itself and doesn't count as the last checkup
  const booked = (i: CareItem) => { const st = (i.data as { status?: string }).status; return st === 'booked' || (st !== 'done' && localDay(i.at) > today); };
  for (const v of live.filter((i): i is CareItem<'vet'> => i.kind === 'vet' && booked(i))) {
    const day = localDay(v.at); if (day < today) continue;
    out.push({ id: 'visit:' + v.id, kind: 'visit', title: `Vet: ${v.data.reason}`, detail: [v.data.time, v.data.clinic].filter(Boolean).join(' · ') || 'Booked', dueDay: day, daysLeft: daysBetween(today, day) });
  }
  const lastVet = live.filter((i) => i.kind === 'vet' && !booked(i)).sort((a, b) => b.at - a.at)[0];
  if (lastVet) {
    const due = localDay(lastVet.at + 365 * 864e5);
    out.push({ id: 'vet:yearly', kind: 'vet', title: 'Yearly checkup', detail: 'A year since the last vet visit', dueDay: due, daysLeft: daysBetween(today, due) });
  }
  return out.filter((r) => r.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft);
}

export const dueText = (d: number) => (d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `In ${d} days`);

/** Weights in time order, for the chart. */
export const weights = (items: CareItem[]) => items.filter((i): i is CareItem<'weight'> => i.kind === 'weight' && !i.deleted).sort((a, b) => a.at - b.at);

/** Signs that mean call the vet now, not later. General guidance, not a diagnosis. */
export const RED_FLAGS = [
  'Straining in the litter box with little or no pee coming out. This is an emergency, especially in males.',
  'Trouble breathing, or breathing with his mouth open.',
  'Not eating for a day (for a young kitten, half a day).',
  'Throwing up again and again, or blood in vomit or poop.',
  'Very weak, won’t get up, collapses, or has a seizure.',
  'Pale, white or blue gums.',
  'Ate something dangerous: lilies, human medicine, string or thread, antifreeze, chocolate.',
  'Can’t use his back legs, or cries out in pain.',
  'An injury that’s bleeding, or a fall or hit by something.',
];

/** Meals a day unless the pet says otherwise. */
export const MEALS_PER_DAY = 2;
/** Today's one-tap logs for a pet, newest first (deleted ones left out). */
export function dailyToday(items: CareItem[], now = Date.now()): Record<DailyWhat, CareItem<'daily'>[]> {
  const today = localDay(now);
  const out: Record<DailyWhat, CareItem<'daily'>[]> = { fed: [], scoop: [], play: [], check: [] };
  for (const i of items) if (i.kind === 'daily' && !i.deleted && localDay(i.at) === today) out[(i as CareItem<'daily'>).data.what].push(i as CareItem<'daily'>);
  for (const k of Object.keys(out) as DailyWhat[]) out[k].sort((a, b) => b.at - a.at);
  return out;
}

/** A rough kitten weight range for the pet's age, or null for adults (adult weight varies too much by breed).
    Kittens gain about a pound a month until around 6 months, then slow down. A guide only; the vet decides. */
export function typicalKittenWeight(birthday: string, now = Date.now()): { months: number; low: number; high: number } | null {
  const [y, m, d] = birthday.split('-').map(Number); if (!y || !m) return null;
  const born = new Date(y, m - 1, d || 15).getTime(); const months = Math.floor((now - born) / (30.44 * 864e5));
  if (months < 2 || months >= 12) return null;
  return months <= 6 ? { months, low: Math.round(months * 0.8 * 2) / 2, high: Math.round(months * 1.2 * 2) / 2 } : { months, low: 5, high: 10 };
}

// ---- smart defaults for the log forms ----

/** When a new entry happened: now if it's for today, otherwise noon that day (an edit that keeps its day keeps its time). */
export function entryTime(day: string, now = Date.now(), keep?: number): number {
  if (keep !== undefined && localDay(keep) === day) return keep;
  return day === localDay(now) ? now : Date.parse(day + 'T12:00:00');
}

/** The newest live entry of a kind. */
export function lastOf<K extends CareKind>(items: CareItem[], kind: K): CareItem<K> | undefined {
  let best: CareItem<K> | undefined;
  for (const i of items) if (i.kind === kind && !i.deleted && (!best || i.at > best.at)) best = i as CareItem<K>;
  return best;
}

/** Medicines given before, newest first, one per name (up to `n`), for "same as last time" chips. */
export function recentMeds(items: CareItem[], n = 3): CareItem<'med'>[] {
  const seen = new Set<string>(); const out: CareItem<'med'>[] = [];
  for (const m of items.filter((i): i is CareItem<'med'> => i.kind === 'med' && !i.deleted).sort((a, b) => b.at - a.at)) {
    const k = m.data.name.trim().toLowerCase(); if (!k || seen.has(k)) continue;
    seen.add(k); out.push(m); if (out.length >= n) break;
  }
  return out;
}

/** Repeating a medicine: the same gap to the next dose as last time ("" when last time had no next due date). */
export function nextDueLike(prev: CareItem<'med'>, day: string): string {
  if (!prev.data.nextDue) return '';
  const gap = daysBetween(localDay(prev.at), prev.data.nextDue); if (gap <= 0) return '';
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + gap, 12).getTime());
}
