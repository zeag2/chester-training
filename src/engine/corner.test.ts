import { describe, it, expect } from 'vitest';
import type { CareItem } from './care';
import { bondLevel, canBuy, dailyGiftTreats, FRIEND_BONUS, ITEM_BY_ID, mergeCorner, newTreats, careReward, CARE_TREATS, owned, treatId, unrewardedFriends, withCorner, type CornerEvent } from './corner';

const ev = (id: string, treats: number, at = 1, extra: Partial<CornerEvent> = {}): CornerEvent => ({ id, kind: 'buy', day: '2026-11-08', at, treats, bond: 0, ...extra });

describe('Chester’s corner', () => {
  it('spends treats from what the sets earned and adds gifts and play bond', () => {
    const e = withCorner({ treats: 40, bond: 2, toys: [] }, { log: [ev('b1', -12, 1, { item: 'bell' }), ev('gift-2026-11-08', 4, 2, { kind: 'gift' }), ev('play-2026-11-08', 0, 3, { kind: 'play', bond: 1 })] });
    expect(e.treats).toBe(32); expect(e.bond).toBe(3);
  });
  it('can’t buy something twice or without enough treats', () => {
    const c = { log: [ev('b1', -12, 1, { item: 'bell' })] };
    expect(canBuy(ITEM_BY_ID.bell, 99, c)).toBe(false);
    expect(canBuy(ITEM_BY_ID.crown, 44, c)).toBe(false);
    expect(canBuy(ITEM_BY_ID.crown, 45, c)).toBe(true);
  });
  it('merges two phones’ logs by id and takes what he wears from the newer one', () => {
    const a = { log: [ev('x', -8, 1), ev('gift-d', 3, 2)], wearing: 'bell', styledAt: 5 };
    const b = { log: [ev('gift-d', 3, 2), ev('y', -20, 3)], wearing: 'crown', styledAt: 9 };
    const m = mergeCorner(b, a)!;
    expect(m.log.map((e) => e.id)).toEqual(['x', 'gift-d', 'y']);
    expect(m.wearing).toBe('crown');
    // a newer pet edit that didn't touch the outfit doesn't undo it
    expect(mergeCorner({ log: [] }, a)!.wearing).toBe('bell');
    expect(mergeCorner(undefined, undefined)).toBeUndefined();
  });
  it('gives the same daily gift on every phone, 2 to 6 treats', () => {
    for (const d of ['2026-11-08', '2026-11-09', '2026-12-25']) {
      const n = dailyGiftTreats('cat1', d);
      expect(n).toBe(dailyGiftTreats('cat1', d)); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(6);
    }
  });
  it('levels bond up with names and progress to the next level', () => {
    expect(bondLevel(0)).toMatchObject({ level: 1, next: 3, frac: 0 });
    expect(bondLevel(5)).toMatchObject({ level: 2, name: 'Buddies', next: 8 });
    expect(bondLevel(99)).toMatchObject({ level: 6, next: null, frac: 1 });
  });
  it('pays each friend once, caps the number of friend bonuses, and the scarf can’t be bought', () => {
    const paid = Array.from({ length: FRIEND_BONUS.max - 1 }, (_, i) => ev('friend-f' + i, 15, i, { kind: 'friend', bond: 1 }));
    expect(unrewardedFriends({ log: paid }, ['f0', 'new1', 'new2'])).toEqual(['new1']); // f0 paid; room for one more
    expect(owned({ log: paid }).has('scarf')).toBe(true);
    expect(owned({ log: [] }).has('scarf')).toBe(false);
    expect(canBuy(ITEM_BY_ID.scarf, 999, { log: [] })).toBe(false);
  });
  it('adds each friend’s treat once: new ones only, no repeats within a batch, counted in the balance', () => {
    const c = { log: [ev(treatId('erin', '2026-11-08'), 1, 1, { kind: 'treat' })] };
    const got = [{ from: 'erin', day: '2026-11-08' }, { from: 'erin', day: '2026-11-09' }, { from: 'dana', day: '2026-11-09' }, { from: 'dana', day: '2026-11-09' }];
    expect(newTreats(c, got)).toEqual([{ from: 'erin', day: '2026-11-09' }, { from: 'dana', day: '2026-11-09' }]);
    expect(newTreats(undefined, [])).toEqual([]);
    expect(withCorner({ treats: 5, bond: 0, toys: [] }, c).treats).toBe(6);
  });
  it('pays treats for new care entries, a few a day, with bonuses for weigh-ins, meds on time and vet visits', () => {
    const now = Date.parse('2026-11-08T12:00:00'); const day = 864e5;
    const care = (id: string, kind: CareItem['kind'], data: object, at = now): CareItem => ({ id, catId: 'c', kind, at, updatedAt: at, data } as CareItem);
    const paid = (id: string, treats: number, item: string, at = now) => ev('care-' + id, treats, at, { kind: 'care', item, day: new Date(at).toLocaleDateString('en-CA') });
    expect(careReward(undefined, care('a', 'symptom', { what: 'Sneezing' }), [], now)).toEqual({ treats: 2, why: 'entry' });
    // the same entry never pays twice; the daily cap stops a fourth
    expect(careReward({ log: [paid('a', 2, 'symptom')] }, care('a', 'symptom', {}), [], now)).toBeNull();
    const three = { log: [paid('x', 2, 'food'), paid('y', 2, 'food'), paid('z', 2, 'food')] };
    expect(careReward(three, care('n', 'groom', { what: 'brush' }), [], now)).toBeNull();
    expect(careReward(three, care('n', 'groom', {}), [], now + day)).toEqual({ treats: 2, why: 'entry' }); // a new day
    // weigh-in bonus once a week, and only for a weigh-in that just happened
    expect(careReward(undefined, care('w', 'weight', { lb: 4 }), [], now)).toEqual({ treats: 2 + CARE_TREATS.weighIn, why: 'weighIn' });
    expect(careReward({ log: [paid('w0', 7, 'weight', now - 3 * day)] }, care('w', 'weight', { lb: 4 }), [], now)!.why).toBe('entry');
    expect(careReward({ log: [paid('w0', 7, 'weight', now - 7 * day)] }, care('w', 'weight', { lb: 4 }), [], now)!.why).toBe('weighIn');
    expect(careReward(undefined, care('w', 'weight', { lb: 4 }, now - 30 * day), [], now)!.why).toBe('entry');
    // medicine on or before the due date the last dose set
    const dose = care('m0', 'med', { name: 'Revolution', what: 'flea', nextDue: '2026-11-10' }, now - 30 * day);
    expect(careReward(undefined, care('m1', 'med', { name: 'revolution ', what: 'flea' }), [dose], now)).toEqual({ treats: 2 + CARE_TREATS.medOnTime, why: 'medOnTime' });
    expect(careReward(undefined, care('m1', 'med', { name: 'Revolution', what: 'flea' }), [{ ...dose, data: { ...dose.data, nextDue: '2026-11-01' } } as CareItem], now)!.why).toBe('entry');
    expect(careReward(undefined, care('m1', 'med', { name: 'Revolution', what: 'flea' }), [], now)!.why).toBe('entry');
    // a vet visit in the last week
    expect(careReward(undefined, care('v', 'vet', { reason: 'Checkup' }, now - 2 * day), [], now)).toEqual({ treats: 2 + CARE_TREATS.vetVisit, why: 'vetVisit' });
    expect(careReward(undefined, care('v', 'vet', { reason: 'Checkup' }, now - 60 * day), [], now)!.why).toBe('entry');
  });
});
