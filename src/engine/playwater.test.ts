import { describe, it, expect } from 'vitest';
import { dailyDetail, lastPlay, playText, type CareItem } from './care';
import { appetiteText, summaryText, vetSummary, waterText } from './vetsummary';

const now = new Date('2026-11-23T18:00:00').getTime();
const day = 864e5;
let n = 0;
const daily = (data: CareItem<'daily'>['data'], at: number, extra: Partial<CareItem> = {}): CareItem =>
  ({ id: `d${n++}`, catId: 'c', kind: 'daily', at, updatedAt: at, data, ...extra });

describe('real playtime', () => {
  it('describes a playtime and preselects the last one', () => {
    expect(playText({ minutes: 10, toy: 'laser' })).toBe('10 min with the laser dot');
    expect(playText({ toy: 'box' })).toBe('with the cardboard box');
    expect(playText({})).toBe('');
    expect(dailyDetail({ what: 'play', minutes: 15, toy: 'wand' })).toBe('15 min · Feather wand');
    const items = [daily({ what: 'play', minutes: 5, toy: 'box' }, now - 2 * day), daily({ what: 'play', minutes: 15, toy: 'wand' }, now - day),
      daily({ what: 'play' }, now - 1000), daily({ what: 'play', minutes: 10 }, now - 500, { deleted: true })];
    expect(lastPlay(items)).toEqual({ minutes: 15, toy: 'wand' }); // a bare tap and a deleted one don't count
    expect(lastPlay([])).toEqual({});
  });
});

describe('water and appetite on the daily check', () => {
  it('shows in the Health log detail', () => {
    expect(dailyDetail({ what: 'check', ok: true, water: 'more', appetite: 'picky' })).toBe('All normal · Water: more · Appetite: picky');
    expect(dailyDetail({ what: 'check', ok: false })).toBe('Something off');
  });
  it('sums up per day for the vet (the latest check that day wins)', () => {
    const items = [
      daily({ what: 'check', ok: true, water: 'more', appetite: 'normal' }, now - 1000),
      daily({ what: 'check', ok: true, water: 'normal' }, now - 5000), // same day, older: ignored
      daily({ what: 'check', ok: true, water: 'more', appetite: 'none' }, now - day),
      daily({ what: 'check', ok: true, water: 'less', appetite: 'picky' }, now - 2 * day),
      daily({ what: 'check', ok: true }, now - 3 * day),
      daily({ what: 'check', ok: true, water: 'less' }, now - 40 * day), // older than 30 days
    ];
    const s = vetSummary(items, now);
    expect(s.water).toEqual({ days: 3, more: 2, less: 1 });
    expect(s.appetite).toEqual({ days: 3, picky: 1, none: 1 });
    expect(waterText(s.water)).toBe('more than usual on 2 days, less than usual on 1 day (of 3 days noted)');
    expect(appetiteText(s.appetite)).toBe('picky on 1 day, didn’t eat on 1 day (of 3 days noted)');
    const text = summaryText('Chester', '7 months', s);
    expect(text).toContain('- Water: more than usual on 2 days');
    expect(text).toContain('- Appetite: picky on 1 day');
  });
  it('says nothing when never noted, and "normal" when always normal', () => {
    expect(waterText(vetSummary([daily({ what: 'check', ok: true }, now)], now).water)).toBe('');
    expect(appetiteText(vetSummary([daily({ what: 'check', ok: true, appetite: 'normal' }, now)], now).appetite)).toBe('normal (1 day noted)');
  });
});
