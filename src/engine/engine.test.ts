import { describe, it, expect } from 'vitest';
import { SKILLS, SKILL_BY_ID } from './skills';
import { localDay } from './day';
import { isPass, isStruggling, applySet, clampSet, isUnlocked } from './rules';
import { suggestNext } from './plan';
import { rewardFor, rollGift, DAILY_REWARDED_SETS, DAILY_TREAT_CAP } from './rewards';
import type { SetRecord, SkillProgress } from './types';

let n = 0;
const mk = (o: Partial<SetRecord>): SetRecord => ({
  id: String(++n), catId: 'c', at: Date.UTC(2026, 10, 7, 18), day: '2026-11-07', skillId: 'target',
  step: 0, reps: 8, good: 7, mood: 'Happy', seconds: 90, review: false, rewarded: true, ...o,
});
const p0 = (skillId = 'target'): SkillProgress => ({ skillId, step: 0, mastered: false });

describe('catalog', () => {
  it('has 17 starter and 18 hidden skills, each with 3-6 steps and valid prerequisites', () => {
    expect(SKILLS.filter((s) => !s.hidden)).toHaveLength(17);
    expect(SKILLS.filter((s) => s.hidden)).toHaveLength(18);
    for (const s of SKILLS) {
      expect(s.steps.length).toBeGreaterThanOrEqual(3);
      expect(s.steps.length).toBeLessThanOrEqual(6);
      for (const r of s.requires) expect(SKILL_BY_ID[r]).toBeTruthy();
    }
  });
});

describe('localDay', () => {
  it('uses local time around midnight (America/Indiana/Indianapolis)', () => {
    // 2026-11-08 04:30 UTC = 2026-11-07 23:30 local (UTC-5)
    expect(localDay(Date.UTC(2026, 10, 8, 4, 30), 'America/Indiana/Indianapolis')).toBe('2026-11-07');
    expect(localDay(Date.UTC(2026, 10, 8, 5, 30), 'America/Indiana/Indianapolis')).toBe('2026-11-08');
  });
});

describe('pass and struggle rules', () => {
  it('passes at 80%+ with 5+ reps and not stressed', () => {
    expect(isPass(mk({ reps: 5, good: 4 }))).toBe(true);
    expect(isPass(mk({ reps: 5, good: 4, mood: 'Stressed' }))).toBe(false);
    expect(isPass(mk({ reps: 4, good: 4 }))).toBe(false);
    expect(isPass(mk({ reps: 10, good: 7 }))).toBe(false);
  });
  it('flags struggling after two sets under 50% at the current step', () => {
    const sets = [mk({ good: 3 }), mk({ good: 2 })];
    expect(isStruggling(sets, p0())).toBe(true);
    expect(isStruggling([mk({ good: 3 }), mk({ good: 7 })], p0())).toBe(false);
    expect(isStruggling([mk({ good: 7, mood: 'Stressed' }), mk({ good: 7, mood: 'Stressed' })], p0())).toBe(true);
  });
  it('clamps recap edits: good never above reps, never negative', () => {
    expect(clampSet({ reps: 6, good: 9 })).toEqual({ reps: 6, good: 6 });
    expect(clampSet({ reps: -1, good: -2 })).toEqual({ reps: 0, good: 0 });
  });
});

describe('applySet', () => {
  const def = SKILL_BY_ID.target;
  it('two passes in a row step up', () => {
    const a = mk({}); const r1 = applySet(p0(), [], a, def);
    expect(r1.event).toBe('pass'); expect(r1.progress.step).toBe(0);
    const b = mk({}); const r2 = applySet(r1.progress, [a], b, def);
    expect(r2.event).toBe('stepUp'); expect(r2.progress.step).toBe(1);
  });
  it('a failed set in between resets the pair', () => {
    const a = mk({}), f = mk({ good: 2 }), b = mk({});
    expect(applySet(p0(), [a, f], b, def).event).toBe('pass');
  });
  it('passing the last step twice masters the skill', () => {
    const last = def.steps.length - 1;
    const p: SkillProgress = { skillId: 'target', step: last, mastered: false };
    const a = mk({ step: last }), b = mk({ step: last, at: 123 });
    const r = applySet(p, [a], b, def);
    expect(r.event).toBe('mastered'); expect(r.progress.mastered).toBe(true); expect(r.progress.masteredAt).toBe(123);
  });
  it('a set on a mastered skill is a review and changes nothing', () => {
    const p: SkillProgress = { skillId: 'target', step: 3, mastered: true, masteredAt: 1 };
    const r = applySet(p, [], mk({ step: 4 }), def);
    expect(r.event).toBe('review'); expect(r.progress).toEqual(p);
  });
  it('only counts sets at the current step', () => {
    const old = mk({ step: 1 });
    const p: SkillProgress = { skillId: 'target', step: 2, mastered: false };
    expect(applySet(p, [old], mk({ step: 2 }), def).event).toBe('pass');
  });
});

describe('unlocks', () => {
  it('needs prerequisites mastered, and hidden skills need unlocking', () => {
    const prog = { clicker: { skillId: 'clicker', step: 3, mastered: true } };
    expect(isUnlocked(SKILL_BY_ID.target, prog, [])).toBe(true);
    expect(isUnlocked(SKILL_BY_ID.mat, prog, [])).toBe(false);
    expect(isUnlocked(SKILL_BY_ID.pills, { ...prog, handling: { skillId: 'handling', step: 5, mastered: true } }, [])).toBe(false);
    expect(isUnlocked(SKILL_BY_ID.pills, { ...prog, handling: { skillId: 'handling', step: 5, mastered: true } }, ['pills'])).toBe(true);
  });
});

describe('suggestNext', () => {
  it('starts with the clicker on day one', () => {
    const out = suggestNext(SKILLS, {}, [], [], '2026-11-07');
    expect(out).toHaveLength(1); expect(out[0].skill.id).toBe('clicker');
  });
  it('never has more than 3 skills in progress and puts care first among new skills', () => {
    const prog = { clicker: { skillId: 'clicker', step: 3, mastered: true } };
    const out = suggestNext(SKILLS, prog, [], [], '2026-11-07');
    expect(out.length).toBeLessThanOrEqual(3);
    expect(['carrier', 'handling']).toContain(out[0].skill.id);
  });
  it('brings back a mastered skill for review after 7 days', () => {
    const prog = { clicker: { skillId: 'clicker', step: 3, mastered: true } };
    const sets = [mk({ skillId: 'clicker', day: '2026-10-30' })];
    const out = suggestNext(SKILLS, prog, sets, [], '2026-11-07');
    expect(out.some((o) => o.skill.id === 'clicker' && /review/i.test(o.reason))).toBe(true);
  });
});

describe('rewards', () => {
  it('pays 1 treat per good rep plus a gift for a real set', () => {
    const r = rewardFor(mk({ good: 6 }), [], 0, () => 0.5);
    expect(r.rewarded).toBe(true); expect(r.treats).toBe(6 + (r.gift?.treats ?? 0)); expect(r.gift).not.toBeNull();
  });
  it('caps treats at 30 a day', () => {
    const r = rewardFor(mk({ good: 8 }), [], 27, () => 0.5);
    expect(r.treats - (r.gift?.treats ?? 0)).toBe(3);
  });
  it('stops rewarding after 3 sets a day', () => {
    const today = [mk({}), mk({}), mk({})];
    expect(DAILY_REWARDED_SETS).toBe(3);
    const r = rewardFor(mk({}), today, 10, () => 0.5);
    expect(r.rewarded).toBe(false); expect(r.treats).toBe(0); expect(r.gift).toBeNull();
  });
  it('no gift for a set with fewer than 3 reps and under 60 seconds', () => {
    expect(rewardFor(mk({ reps: 2, good: 2, seconds: 30 }), [], 0, () => 0.5).gift).toBeNull();
    expect(rewardFor(mk({ reps: 2, good: 2, seconds: 61 }), [], 0, () => 0.5).gift).not.toBeNull();
  });
  it('a stressed set still earns its gift', () => {
    expect(rewardFor(mk({ reps: 5, good: 1, mood: 'Stressed' }), [], 0, () => 0.5).gift).not.toBeNull();
  });
  it('jackpot is rare', () => {
    expect(rollGift(() => 0.01).kind).toBe('jackpot');
    expect(rollGift(() => 0.6).kind).not.toBe('jackpot');
    expect(DAILY_TREAT_CAP).toBe(30);
  });
});

import { hiddenUnlocks } from './rules';
describe('hiddenUnlocks', () => {
  it('opens mastery-gated skills automatically and check-in ones by answer', () => {
    const prog = { sit: { skillId: 'sit', step: 3, mastered: true } };
    const ids = hiddenUnlocks(SKILLS, prog, ['vet']);
    expect(ids).toEqual(expect.arrayContaining(['stay', 'liedown', 'scale', 'chinrest', 'car']));
    expect(ids).not.toContain('pills');
  });
});
