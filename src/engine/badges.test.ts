import { describe, it, expect } from 'vitest';
import { badgeArtKey, badgeShelves, closestBadge, tapDelay } from './badges';
import type { SkillDef } from './types';

const sk = (id: string, branch: SkillDef['branch'], steps: number, hidden = false): SkillDef =>
  ({ id, name: id, branch, priority: 1, why: '', steps: Array.from({ length: steps }, (_, i) => 's' + i), tips: '', requires: [], sources: [], ...(hidden ? { hidden: { unlockBy: 'x' } } : {}) }) as SkillDef;

describe('badges', () => {
  const defs = [sk('clicker', 'Foundation', 2), sk('name', 'Foundation', 4), sk('nails', 'Care', 5), sk('secret', 'Tricks', 3, true)];
  it('puts earned badges first on each branch shelf and shows locked hidden skills as mystery badges', () => {
    const shelves = badgeShelves(defs, { name: { skillId: 'name', step: 4, mastered: true, masteredAt: 5 }, nails: { skillId: 'nails', step: 3, mastered: false } }, []);
    expect(shelves.map((s) => s.branch)).toEqual(['Foundation', 'Care', 'Tricks']);
    expect(shelves[0].badges.map((b) => [b.skill.id, b.state])).toEqual([['name', 'earned'], ['clicker', 'locked']]);
    expect(shelves[2].badges.map((b) => b.state)).toEqual(['hidden']);
    expect(closestBadge(shelves)?.skill.id).toBe('nails');
    expect(badgeShelves(defs, {}, ['secret'])[2].badges[0].state).toBe('locked');
  });
  it('a started hidden skill is no longer a mystery', () => {
    expect(badgeShelves(defs, { secret: { skillId: 'secret', step: 1, mastered: false } }, [])[2].badges[0].state).toBe('locked');
  });
  it('has no closest badge before any skill is started', () => { expect(closestBadge(badgeShelves(defs, {}, []))).toBeNull(); });
  it('picks the art by state: earned and locked by skill id, hidden by branch only', () => {
    const [f, , c, t] = defs;
    expect(badgeArtKey({ state: 'earned', skill: f })).toBe('earned/clicker');
    expect(badgeArtKey({ state: 'locked', skill: c })).toBe('locked/nails');
    expect(badgeArtKey({ state: 'hidden', skill: t })).toBe('hidden/tricks');
  });
  it('only earned badges hold for the shine; locked open at once; hidden never open', () => {
    expect(tapDelay('earned', 520, 240, false)).toBe(520);
    expect(tapDelay('earned', 520, 240, true)).toBe(240);
    expect(tapDelay('locked', 520, 240, false)).toBe(0);
    expect(tapDelay('hidden', 520, 240, false)).toBeNull();
  });
});
