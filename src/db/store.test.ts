import { describe, it, expect } from 'vitest';
import { Store } from './store';

const catInput = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };

describe('Store', () => {
  it('logs passing sets, steps up, pays treats, and persists across a fresh instance', async () => {
    const a = new Store('t1'); a.rand = () => 0.5; await a.load();
    await a.saveCat(catInput);
    const r1 = await a.logSet({ skillId: 'clicker', reps: 10, good: 9, mood: 'Happy', seconds: 90 });
    const r2 = await a.logSet({ skillId: 'clicker', reps: 10, good: 10, mood: 'Happy', seconds: 90 });
    expect(r1?.event).toBe('pass'); expect(r2?.event).toBe('stepUp');
    expect(a.get().progress.clicker.step).toBe(1);
    expect(a.get().wallet!.treats).toBeGreaterThanOrEqual(19);
    const b = new Store('t1'); await b.load();
    expect(b.get().cat?.name).toBe('Chester');
    expect(b.get().progress.clicker.step).toBe(1);
    expect(b.get().sets).toHaveLength(2);
  });
  it('keeps a session draft until the set is logged, and ignores empty sets', async () => {
    const a = new Store('t2'); await a.load(); await a.saveCat(catInput);
    await a.saveDraft({ skillId: 'clicker', startedAt: 1, reps: 3, good: 2, seconds: 40 });
    const b = new Store('t2'); await b.load();
    expect(b.get().draft?.reps).toBe(3);
    expect(await b.logSet({ skillId: 'clicker', reps: 0, good: 0, mood: 'Happy', seconds: 5 })).toBeNull();
    await b.logSet({ skillId: 'clicker', reps: 6, good: 9, mood: 'Happy', seconds: 60 });
    expect(b.get().draft).toBeNull();
    expect(b.get().sets[0].good).toBe(6);
  });
});
