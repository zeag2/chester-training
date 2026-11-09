/* A one-screen summary to show at the vet: weights, the latest dose of each medicine or vaccine, recent symptoms and
   visits, and how the daily checks went. Pure, built from the care log. */
import { localDay, daysBetween } from './day';
import type { CareItem } from './care';

export interface VetSummary {
  weights: { day: string; lb: number }[];
  doses: { name: string; what: string; given: string; nextDue?: string }[];
  symptoms: { day: string; what: string; worried?: boolean }[];
  visits: { day: string; reason: string; clinic?: string }[];
  checks: { days: number; off: number };
  foods: string[];
}

export function vetSummary(care: CareItem[], now = Date.now()): VetSummary {
  const live = care.filter((i) => !i.deleted).sort((a, b) => b.at - a.at); const today = localDay(now);
  const within = (i: CareItem, d: number) => daysBetween(localDay(i.at), today) <= d;
  const of = <K extends CareItem['kind']>(k: K) => live.filter((i) => i.kind === k) as CareItem<K>[];
  const doses = new Map<string, VetSummary['doses'][number]>();
  for (const m of of('med')) { const k = m.data.name.trim().toLowerCase(); if (!doses.has(k)) doses.set(k, { name: m.data.name, what: m.data.what, given: localDay(m.at), nextDue: m.data.nextDue }); }
  const checks = of('daily').filter((i) => i.data.what === 'check' && within(i, 30));
  return {
    weights: of('weight').slice(0, 6).map((w) => ({ day: localDay(w.at), lb: w.data.lb })),
    doses: [...doses.values()],
    symptoms: of('symptom').filter((s) => within(s, 60)).map((s) => ({ day: localDay(s.at), what: s.data.what, worried: s.data.worried })),
    visits: of('vet').slice(0, 3).map((v) => ({ day: localDay(v.at), reason: v.data.reason, clinic: v.data.clinic })),
    checks: { days: new Set(checks.map((c) => localDay(c.at))).size, off: checks.filter((c) => c.data.ok === false).length },
    foods: of('food').filter((f) => f.data.current).map((f) => f.data.name),
  };
}
