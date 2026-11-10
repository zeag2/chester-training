/* A one-screen summary to show at the vet: weights, the latest dose of each medicine or vaccine, recent symptoms and
   visits, how the daily checks went, and the paperwork. Pure, built from the care log. `summaryText` is the same as
   plain text, for Share ("send it before the appointment"). */
import { localDay, daysBetween } from './day';
import { MED_LABEL, type CareItem, type MedWhat } from './care';
import { isBooked, type VetData } from './vets';
import { docDay, docTags, visitLinks } from './docs';

export interface VetSummary {
  weights: { day: string; lb: number }[];
  doses: { name: string; what: string; given: string; nextDue?: string }[];
  symptoms: { day: string; what: string; worried?: boolean }[];
  /** Visits that happened, newest first (booked ones are `next`). */
  visits: { id: string; day: string; reason: string; clinic?: string; notes?: string; docs: number }[];
  next?: { id: string; day: string; time?: string; reason: string; clinic?: string };
  checks: { days: number; off: number };
  foods: string[];
  /** The newest vaccine paperwork, then the other newest documents (up to 3 in all). */
  docs: { id: string; title: string; day: string; path: string; vaccine: boolean }[];
}

export function vetSummary(care: CareItem[], now = Date.now()): VetSummary {
  const live = care.filter((i) => !i.deleted).sort((a, b) => b.at - a.at); const today = localDay(now);
  const within = (i: CareItem, d: number) => daysBetween(localDay(i.at), today) <= d;
  const of = <K extends CareItem['kind']>(k: K) => live.filter((i) => i.kind === k) as CareItem<K>[];
  const doses = new Map<string, VetSummary['doses'][number]>();
  for (const m of of('med')) { const k = m.data.name.trim().toLowerCase(); if (!doses.has(k)) doses.set(k, { name: m.data.name, what: m.data.what, given: localDay(m.at), nextDue: m.data.nextDue }); }
  const checks = of('daily').filter((i) => i.data.what === 'check' && within(i, 30));
  const vets = of('vet');
  const next = vets.filter((v) => isBooked(v, now) && localDay(v.at) >= today).sort((a, b) => a.at - b.at)[0];
  const docs = of('doc').map((d) => ({ id: d.id, title: d.data.title, day: docDay(d), path: d.data.path, vaccine: docTags(care, d).has('vaccine') }))
    .sort((a, b) => b.day.localeCompare(a.day));
  const vax = docs.find((d) => d.vaccine);
  return {
    weights: of('weight').slice(0, 6).map((w) => ({ day: localDay(w.at), lb: w.data.lb })),
    doses: [...doses.values()],
    symptoms: of('symptom').filter((s) => within(s, 60)).map((s) => ({ day: localDay(s.at), what: s.data.what, worried: s.data.worried })),
    visits: vets.filter((v) => !isBooked(v, now)).slice(0, 3).map((v) => ({ id: v.id, day: localDay(v.at), reason: v.data.reason, clinic: v.data.clinic, notes: v.data.notes, docs: visitLinks(care, v).docs.length })),
    next: next && { id: next.id, day: localDay(next.at), time: next.data.time, reason: next.data.reason, clinic: next.data.clinic },
    checks: { days: new Set(checks.map((c) => localDay(c.at))).size, off: checks.filter((c) => c.data.ok === false).length },
    foods: of('food').filter((f) => f.data.current).map((f) => f.data.name),
    docs: [...(vax ? [vax] : []), ...docs.filter((d) => d !== vax)].slice(0, 3),
  };
}

const fmt = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** The summary as plain text, to share by email or message. `about`: the pet's line (age, sex, chip…). */
export function summaryText(name: string, about: string, s: VetSummary, vet?: VetData): string {
  const out: string[] = [`${name}: health summary`, about];
  if (vet) out.push(`Vet: ${[vet.clinic, vet.vetName, vet.phone].filter(Boolean).join(', ')}`);
  const sect = (title: string, lines: string[], none = 'None logged.') => { out.push('', title, ...(lines.length ? lines.map((l) => '- ' + l) : [none])); };
  const w0 = s.weights[0], wl = s.weights[s.weights.length - 1];
  sect('Weight', w0 ? [`${w0.lb} lb (${fmt(w0.day)})`, ...(s.weights.length > 1 ? [`${wl.lb} lb on ${fmt(wl.day)} → ${w0.lb} lb`] : [])] : [], 'No weigh-ins logged yet.');
  sect('Medicine and vaccines', s.doses.map((x) => `${x.name} (${MED_LABEL[x.what as MedWhat] ?? x.what}): given ${fmt(x.given)}${x.nextDue ? `, next ${fmt(x.nextDue)}` : ''}`));
  sect('Symptoms (last 60 days)', s.symptoms.map((x) => `${fmt(x.day)}: ${x.what}${x.worried ? ' (we were worried)' : ''}`));
  sect('Daily checks (last 30 days)', s.checks.days ? [`${s.checks.days} days checked, ${s.checks.off ? `${s.checks.off} with something off` : 'all normal'}`] : [], 'No daily checks yet.');
  sect('Recent vet visits', s.visits.map((v) => `${fmt(v.day)}: ${v.reason}${v.clinic ? ` at ${v.clinic}` : ''}${v.notes ? `. ${v.notes}` : ''}`));
  if (s.next) sect('Next visit', [`${fmt(s.next.day)}${s.next.time ? ` ${s.next.time}` : ''}: ${s.next.reason}${s.next.clinic ? ` at ${s.next.clinic}` : ''}`]);
  if (s.foods.length) sect('Eating now', [s.foods.join(', ')]);
  if (s.docs.length) sect('Documents (in the PalDex app)', s.docs.map((d) => `${d.title} (${fmt(d.day)})`));
  out.push('', `From ${name}’s PalDex log.`);
  return out.join('\n');
}
