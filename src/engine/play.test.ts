import { describe, it, expect } from 'vitest';
import { movesFound, newBrain, step, type Brain, type PlayEvent, type Target, type Toy } from './play';

const S = 120, W = 390;
/** A seeded random, so runs repeat exactly. */
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
/** Run the brain for `secs` at 60 fps with the toy held at `target` (or moved by a function of time). */
function run(b: Brain, target: Target | null | ((t: number) => Target | null), secs: number, toy: Toy = 'laser') {
  const events: PlayEvent[] = []; const modes = new Set<string>(); const rand = seeded();
  for (let i = 0; i < secs * 60; i++) {
    const tg = typeof target === 'function' ? target(i / 60) : target;
    const r = step(b, tg, 1 / 60, { toy, size: S, width: W, rand }); b = r.b; events.push(...r.events); modes.add(b.mode);
  }
  return { b, events, modes, moves: events.filter((e) => e.kind === 'move').map((e) => (e as { move: string }).move) };
}

describe('the laser dot', () => {
  it('walks over to a still dot, wiggles, pounces and catches it', () => {
    const r = run(newBrain(80), { x: 320, h: 0 }, 4);
    expect([...r.modes]).toEqual(expect.arrayContaining(['walk', 'stalk', 'pounce']));
    expect(r.moves).toEqual(expect.arrayContaining(['wiggle', 'pounce', 'catch']));
    expect(r.events.some((e) => e.kind === 'catch')).toBe(true);
    expect(r.b.x).toBeGreaterThan(250); // he ended up over there
  });
  it('misses a dot that darts away mid-pounce', () => {
    let pounced = -1;
    let b = newBrain(200); const ev: PlayEvent[] = [];
    for (let i = 0; i < 180; i++) {
      const t = i / 60; const r2 = step(b, pounced >= 0 && t > pounced + 0.2 ? { x: 20, h: 0 } : { x: 260, h: 0 }, 1 / 60, { toy: 'laser', size: S, width: W, rand: () => 0.5 });
      b = r2.b; ev.push(...r2.events); if (pounced < 0 && r2.events.some((e) => e.kind === 'pounce')) pounced = t;
    }
    expect(pounced).toBeGreaterThan(0);
    expect(ev.some((e) => e.kind === 'miss')).toBe(true);
    expect(ev.some((e) => e.kind === 'catch')).toBe(false);
  });
  it('stares at a dot up the wall and chatters after a while, without walking', () => {
    const r = run(newBrain(200), { x: 300, h: 260 }, 3);
    expect([...r.modes]).toEqual(['stare']);
    expect(r.moves).toEqual(['chatter']);
  });
  it('just watches a dot that keeps dashing about', () => {
    const r = run(newBrain(200), (t) => ({ x: 195 + Math.sin(t * 9) * 170, h: 0 }), 3);
    expect(r.modes.has('watch')).toBe(true);
    expect(r.events.some((e) => e.kind === 'pounce')).toBe(false);
  });
  it('sits when the dot is gone', () => {
    expect(run(newBrain(200), null, 1).b.mode).toBe('sit');
  });
});

describe('the wand', () => {
  it('swats a feather dangling by his face, and bites it when it rests there', () => {
    const r = run(newBrain(200), { x: 215, h: 70 }, 4, 'wand');
    expect(r.moves).toEqual(expect.arrayContaining(['swat', 'bite']));
    expect(r.events.some((e) => e.kind === 'catch')).toBe(true);
    expect(r.moves.every((m) => ['swat', 'bite', 'leap', 'aircatch', 'double'].includes(m))).toBe(true); // only the wand's own moves
  });
  it('leaps at a feather held just above him, and can catch it in the air', () => {
    const r = run(newBrain(200), { x: 260, h: 170 }, 4, 'wand');
    expect(r.moves).toEqual(expect.arrayContaining(['leap', 'aircatch']));
  });
});

describe('moves found', () => {
  it('reads them from the corner log', () => {
    expect(movesFound([{ id: 'move-laser-pounce' }, { id: 'move-wand-swat' }, { id: 'gift-2026-11-09' }], 'laser')).toEqual(['pounce']);
    expect(movesFound(undefined, 'wand')).toEqual([]);
  });
});
