import { daysBetween } from './day';
import { isUnlocked } from './rules';
import type { SetRecord, SkillDef, SkillProgress } from './types';

export const MAX_IN_PROGRESS = 3;
export const REVIEW_AFTER_DAYS = 7;

export interface Suggestion { skill: SkillDef; reason: string; kind: 'start' | 'continue' | 'review' }

export function suggestNext(defs: SkillDef[], progress: Record<string, SkillProgress>, sets: SetRecord[], unlockedHidden: string[], today: string): Suggestion[] {
  const last = (id: string) => sets.filter((s) => s.skillId === id).reduce<string | null>((m, s) => (!m || s.day > m ? s.day : m), null);
  if (!progress.clicker?.mastered) {
    const d = defs.find((x) => x.id === 'clicker')!;
    return [{ skill: d, kind: last('clicker') ? 'continue' : 'start', reason: 'Start here. Everything else builds on this.' }];
  }
  const open = defs.filter((d) => isUnlocked(d, progress, unlockedHidden) && !progress[d.id]?.mastered);
  const active = open.filter((d) => last(d.id));
  const fresh = open.filter((d) => !last(d.id)).sort((a, b) => b.priority - a.priority);
  const score = (d: SkillDef) => { const l = last(d.id); const gap = l ? daysBetween(l, today) : 7; return d.priority * 2 + Math.min(gap, 7) - (l === today ? 15 : 0); };
  const pool = [...active, ...fresh.slice(0, Math.max(0, MAX_IN_PROGRESS - active.length))].sort((a, b) => score(b) - score(a));
  const out: Suggestion[] = pool.slice(0, 2).map((d) => {
    const l = last(d.id); const gap = l ? daysBetween(l, today) : 0;
    return { skill: d, kind: l ? 'continue' : 'start', reason: !l ? 'New skill, a great one to start' : l === today ? 'Already practiced today; an extra set is optional' : gap >= 2 ? `Not practiced in ${gap} days` : 'Keep the momentum going' };
  });
  const review = defs.filter((d) => progress[d.id]?.mastered)
    .map((d) => ({ d, gap: last(d.id) ? daysBetween(last(d.id)!, today) : 99 }))
    .filter((x) => x.gap >= REVIEW_AFTER_DAYS).sort((a, b) => b.gap - a.gap)[0];
  if (review) out.push({ skill: review.d, kind: 'review', reason: review.gap >= 99 ? 'Quick review so he keeps it' : `Review: last practiced ${review.gap} days ago` });
  return out;
}
