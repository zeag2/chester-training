/* Badges: one per skill, earned by mastering it. Shelves follow the skill tree's branches; a hidden skill shows as a
   mystery badge (the branch shape, dashed, with a "?") until it's unlocked. Everything is derived from progress, so
   badges need no storage and agree on every phone. Art: src/assets/badges (docs/design-system.md, "Badges"). */
import type { Branch, SkillDef, SkillProgress } from './types';

/** earned = mastered; locked = known but not mastered yet; hidden = a hidden skill not unlocked yet (name not shown). */
export type BadgeState = 'earned' | 'locked' | 'hidden';
export interface Badge { skill: SkillDef; state: BadgeState; earned: boolean; at?: number; step: number; steps: number; frac: number }
export const BRANCH_ORDER: Branch[] = ['Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'];

export function badgeFor(skill: SkillDef, p: SkillProgress | undefined, hidden = false): Badge {
  const steps = skill.steps.length; const earned = !!p?.mastered; const step = earned ? steps : p?.step ?? 0;
  const state: BadgeState = earned ? 'earned' : hidden ? 'hidden' : 'locked';
  return { skill, state, earned, at: p?.masteredAt, step, steps, frac: steps ? step / steps : 0 };
}

const isHidden = (d: SkillDef, progress: Record<string, SkillProgress>, unlockedHidden: string[]) =>
  !!d.hidden && !unlockedHidden.includes(d.id) && !progress[d.id];

/** Shelves by branch: earned badges first (newest first), then the closest to earning, then mystery (hidden) badges. */
export function badgeShelves(defs: SkillDef[], progress: Record<string, SkillProgress>, unlockedHidden: string[]): { branch: Branch; badges: Badge[] }[] {
  const rank = (b: Badge) => (b.state === 'earned' ? 0 : b.state === 'locked' ? 1 : 2);
  return BRANCH_ORDER.map((branch) => ({
    branch,
    badges: defs.filter((d) => d.branch === branch).map((d) => badgeFor(d, progress[d.id], isHidden(d, progress, unlockedHidden)))
      .sort((a, b) => rank(a) - rank(b) || (b.at ?? 0) - (a.at ?? 0) || b.frac - a.frac),
  })).filter((s) => s.badges.length);
}

/** The unearned badge closest to done (only skills already started), for the top of the trophy case. */
export function closestBadge(shelves: { badges: Badge[] }[]): Badge | null {
  return shelves.flatMap((s) => s.badges).filter((b) => b.state === 'locked' && b.step > 0).sort((a, b) => b.frac - a.frac)[0] ?? null;
}

/** Which art file a badge shows: `earned/<skill id>`, `locked/<skill id>`, or `hidden/<branch>` (no skill id, so it
 *  doesn't give the skill away). Paths are relative to src/assets/badges, without ".svg". */
export function badgeArtKey(b: Pick<Badge, 'state' | 'skill'>): string {
  return b.state === 'hidden' ? `hidden/${b.skill.branch.toLowerCase()}` : `${b.state}/${b.skill.id}`;
}

/** How long a tap waits before opening the skill page: earned badges hold for the shine (shorter with reduced motion,
 *  where it's only a brighten); locked badges open at once; hidden badges don't open. */
export function tapDelay(state: BadgeState, shineMs: number, flashMs: number, reduced: boolean): number | null {
  if (state === 'hidden') return null;
  if (state === 'locked') return 0;
  return reduced ? flashMs : shineMs;
}
