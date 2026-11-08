/* Badges: one per skill, earned by mastering it. Shelves follow the skill tree's branches; hidden skills only show
   once unlocked. Everything is derived from progress, so badges need no storage and agree on every phone. */
import type { Branch, SkillDef, SkillProgress } from './types';

export interface Badge { skill: SkillDef; earned: boolean; at?: number; step: number; steps: number; frac: number }
export const BRANCH_ORDER: Branch[] = ['Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'];

export function badgeFor(skill: SkillDef, p: SkillProgress | undefined): Badge {
  const steps = skill.steps.length; const earned = !!p?.mastered; const step = earned ? steps : p?.step ?? 0;
  return { skill, earned, at: p?.masteredAt, step, steps, frac: steps ? step / steps : 0 };
}

/** Shelves by branch, earned badges first (newest first), then the closest to earning. */
export function badgeShelves(defs: SkillDef[], progress: Record<string, SkillProgress>, unlockedHidden: string[]): { branch: Branch; badges: Badge[] }[] {
  const shown = defs.filter((d) => !d.hidden || unlockedHidden.includes(d.id) || progress[d.id]);
  return BRANCH_ORDER.map((branch) => ({
    branch,
    badges: shown.filter((d) => d.branch === branch).map((d) => badgeFor(d, progress[d.id]))
      .sort((a, b) => Number(b.earned) - Number(a.earned) || (b.at ?? 0) - (a.at ?? 0) || b.frac - a.frac),
  })).filter((s) => s.badges.length);
}

/** The unearned badge closest to done (only skills already started), for the top of the trophy case. */
export function closestBadge(shelves: { badges: Badge[] }[]): Badge | null {
  return shelves.flatMap((s) => s.badges).filter((b) => !b.earned && b.step > 0).sort((a, b) => b.frac - a.frac)[0] ?? null;
}
