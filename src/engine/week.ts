/* "{cat}'s week": the last 7 days from what's already logged (care, one-tap logs, sets, the corner). Pure, so it's
   the same on every phone in the household. */
import { isCancelled, type CareItem } from './care';
import type { Corner } from './corner';
import type { SetRecord } from './types';
import { daysBetween, localDay } from './day';

export interface WeekSummary {
  from: string; to: string;
  meals: number; scoops: number; plays: number; checks: number; checksOff: number;
  weight: { now: number; before: number | null } | null;
  symptoms: string[]; vetVisits: number; meds: string[];
  sets: number; goodRate: number | null; daysTrained: number;
  /** Everything logged this week (care, one-tap logs, sets) per person id (missing = before accounts). */
  byPerson: Record<string, number>;
  friendTreats: number; careTreats: number;
}

export function weekSummary(care: CareItem[], sets: SetRecord[], corner: Corner | undefined, now = Date.now()): WeekSummary {
  const to = localDay(now); const inWeek = (at: number) => { const d = daysBetween(localDay(at), to); return d >= 0 && d < 7; };
  const c = care.filter((i) => !i.deleted && inWeek(i.at));
  const daily = (w: string) => c.filter((i) => i.kind === 'daily' && (i.data as { what: string }).what === w);
  const checks = daily('check');
  const weights = care.filter((i) => i.kind === 'weight' && !i.deleted).sort((a, b) => a.at - b.at);
  const latest = weights.filter((w) => inWeek(w.at)).pop();
  const before = latest ? weights.filter((w) => w.at < latest.at && !inWeek(w.at)).pop() ?? weights.filter((w) => w.at < latest.at).pop() : undefined;
  const s = sets.filter((x) => inWeek(x.at));
  const reps = s.reduce((a, x) => a + x.reps, 0), good = s.reduce((a, x) => a + x.good, 0);
  const byPerson: Record<string, number> = {};
  for (const x of [...c, ...s]) { const k = x.by ?? ''; byPerson[k] = (byPerson[k] ?? 0) + 1; }
  const log = (corner?.log ?? []).filter((e) => inWeek(e.at));
  return {
    from: localDay(now - 6 * 864e5), to,
    meals: daily('fed').length, scoops: daily('scoop').length, plays: daily('play').length,
    checks: checks.length, checksOff: checks.filter((i) => (i.data as { ok?: boolean }).ok === false).length,
    weight: latest ? { now: (latest.data as { lb: number }).lb, before: before ? (before.data as { lb: number }).lb : null } : null,
    symptoms: c.filter((i) => i.kind === 'symptom').map((i) => (i.data as { what: string }).what),
    vetVisits: c.filter((i) => i.kind === 'vet' && !isCancelled(i)).length,
    meds: c.filter((i) => i.kind === 'med').map((i) => (i.data as { name: string }).name),
    sets: s.length, goodRate: reps ? Math.round((100 * good) / reps) : null, daysTrained: new Set(s.map((x) => x.day)).size,
    byPerson,
    friendTreats: log.filter((e) => e.kind === 'treat').length,
    careTreats: log.filter((e) => e.kind === 'care').reduce((a, e) => a + e.treats, 0),
  };
}
