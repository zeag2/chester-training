import { describe, it, expect } from 'vitest';
import { bondLevel, canBuy, dailyGiftTreats, ITEM_BY_ID, mergeCorner, withCorner, type CornerEvent } from './corner';

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
});
