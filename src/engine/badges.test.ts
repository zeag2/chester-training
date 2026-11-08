import { describe, it, expect } from 'vitest';
import { badgeShelves, closestBadge } from './badges';
import type { SkillDef } from './types';

const sk = (id: string, branch: SkillDef['branch'], steps: number, hidden = false): SkillDef =>
  ({ id, name: id, branch, priority: 1, why: '', steps: Array.from({ length: steps }, (_, i) => 's' + i), tips: '', requires: [], sources: [], ...(hidden ? { hidden: { unlockBy: 'x' } } : {}) }) as SkillDef;

describe('badges', () => {
  const defs = [sk('clicker', 'Foundation', 2), sk('name', 'Foundation', 4), sk('nails', 'Care', 5), sk('secret', 'Tricks', 3, true)];
  it('puts earned badges first on each branch shelf and hides locked hidden skills', () => {
    const shelves = badgeShelves(defs, { name: { skillId: 'name', step: 4, mastered: true, masteredAt: 5 }, nails: { skillId: 'nails', step: 3, mastered: false } }, []);
    expect(shelves.map((s) => s.branch)).toEqual(['Foundation', 'Care']);
    expect(shelves[0].badges.map((b) => [b.skill.id, b.earned])).toEqual([['name', true], ['clicker', false]]);
    expect(closestBadge(shelves)?.skill.id).toBe('nails');
    expect(badgeShelves(defs, {}, ['secret']).map((s) => s.branch)).toContain('Tricks');
  });
  it('has no closest badge before any skill is started', () => { expect(closestBadge(badgeShelves(defs, {}, []))).toBeNull(); });
});
