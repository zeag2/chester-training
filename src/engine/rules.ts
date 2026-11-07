import type { ProgressEvent, SetRecord, SkillDef, SkillProgress } from './types';

export const PASS_RATE = 0.8;
export const MIN_REPS = 5;
export const STRUGGLE_RATE = 0.5;

export function isPass(s: Pick<SetRecord, 'reps' | 'good' | 'mood'>): boolean {
  return s.reps >= MIN_REPS && s.good / s.reps >= PASS_RATE && s.mood !== 'Stressed';
}

export function clampSet(v: { reps: number; good: number }): { reps: number; good: number } {
  const reps = Math.max(0, Math.round(v.reps));
  return { reps, good: Math.min(reps, Math.max(0, Math.round(v.good))) };
}

const atStep = (sets: SetRecord[], p: SkillProgress) => sets.filter((s) => s.skillId === p.skillId && s.step === p.step && !s.review);

export function isStruggling(sets: SetRecord[], p: SkillProgress): boolean {
  if (p.mastered) return false;
  const last = atStep(sets, p).slice(-2);
  return last.length === 2 && last.every((s) => s.mood === 'Stressed' || s.reps === 0 || s.good / s.reps < STRUGGLE_RATE);
}

/** Apply a newly logged set. `setsForSkill` = earlier sets, oldest first, not including `s`. */
export function applySet(p: SkillProgress, setsForSkill: SetRecord[], s: SetRecord, def: SkillDef): { progress: SkillProgress; event: ProgressEvent } {
  if (p.mastered) return { progress: p, event: 'review' };
  if (!isPass(s)) return { progress: p, event: 'none' };
  const prev = atStep(setsForSkill, p).slice(-1)[0];
  if (!prev || !isPass(prev)) return { progress: p, event: 'pass' };
  const next = p.step + 1;
  if (next >= def.steps.length) return { progress: { ...p, step: def.steps.length - 1, mastered: true, masteredAt: s.at }, event: 'mastered' };
  return { progress: { ...p, step: next }, event: 'stepUp' };
}

export function isUnlocked(def: SkillDef, progress: Record<string, SkillProgress>, unlockedHidden: string[]): boolean {
  if (def.hidden && !unlockedHidden.includes(def.id)) return false;
  return def.requires.every((r) => progress[r]?.mastered);
}

/** Hidden skills whose unlock is "mastered:<id>" open automatically; check-in answers add the rest. */
export function hiddenUnlocks(defs: SkillDef[], progress: Record<string, SkillProgress>, checkinKeys: string[]): string[] {
  return defs.filter((d) => {
    if (!d.hidden) return false;
    const u = d.hidden.unlockBy;
    return u.startsWith('mastered:') ? !!progress[u.slice(9)]?.mastered : checkinKeys.includes(u);
  }).map((d) => d.id);
}
