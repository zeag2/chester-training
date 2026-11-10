import { describe, it, expect } from 'vitest';
import { HOP_S, inside, newHide, stepHide, type HideBrain, type HideInput, type HideOpts, type HideToy } from './hideout';
import { movesFound, PLAY_MOVES, type PlayEvent } from './play';

const S = 120, W = 390;
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const opts = (toy: HideToy, rand = seeded()): HideOpts => ({
  toy, size: S, width: W, rand,
  spot: toy === 'box' ? { center: 230, half: 70, height: 46 } : { center: 195, half: 120, height: 72 },
});
/** Run for `secs` at 60 fps; `input(t, b)` gives the taps and finger for each frame. */
function run(toy: HideToy, secs: number, input: (t: number, b: HideBrain) => HideInput = () => ({}), b0?: HideBrain, rand = seeded()) {
  const o = opts(toy, rand); let b = b0 ?? newHide(o);
  const events: PlayEvent[] = []; const modes: string[] = [];
  for (let i = 0; i < secs * 60; i++) {
    const r = stepHide(b, input(i / 60, b), 1 / 60, o); b = r.b; events.push(...r.events);
    if (modes[modes.length - 1] !== b.mode) modes.push(b.mode);
  }
  return { b, events, modes, moves: events.filter((e) => e.kind === 'move').map((e) => (e as { move: string }).move) };
}
/** Run until the brain is in `mode` (at most `secs`). */
function until(toy: HideToy, mode: string, input: (t: number, b: HideBrain) => HideInput = () => ({}), secs = 20) {
  const o = opts(toy); let b = newHide(o); const rand = seeded();
  for (let i = 0; i < secs * 60 && b.mode !== mode; i++) b = stepHide(b, input(i / 60, b), 1 / 60, { ...o, rand }).b;
  expect(b.mode).toBe(mode);
  return b;
}
/** A single tap at `at` seconds. */
const tapAt = (at: number, x: number, h: number) => (t: number): HideInput => (Math.abs(t - at) < 1 / 120 ? { tap: { x, h } } : {});

describe('the box', () => {
  it('hops in on his own, sits, ducks down, then peeks over the rim', () => {
    const r = run('box', 6);
    expect(r.modes.slice(0, 5)).toEqual(['sit', 'hop', 'pop', 'hide', 'peek']);
    expect(r.moves.slice(0, 2)).toEqual(['fits', 'peek']);
    expect(r.b.x).toBe(230); // in the box
    expect(inside(r.b, opts('box'))).toBe(true);
  });
  it('a tap on the box while he hides pops him up (Boo!)', () => {
    const b = until('box', 'hide');
    const r = run('box', 0.2, (t) => (t < 1 / 60 ? { tap: { x: 230, h: 20 } } : {}), b);
    expect(r.b.mode).toBe('pop');
    expect(r.moves).toEqual(['boo']);
    expect(r.events.some((e) => e.kind === 'catch')).toBe(true);
  });
  it('sticks a paw out at a finger beside the box while he peeks', () => {
    const b = until('box', 'peek');
    const r = run('box', 1.5, () => ({ finger: { x: 340, h: 30 } }), b);
    expect(r.moves).toContain('swat');
    expect(r.b.face).toBe(1); // toward the finger on the right
    expect(r.events.filter((e) => e.kind === 'swat').length).toBeGreaterThanOrEqual(2);
  });
  it('springs out at a finger that waits beside the box while he hides, and lands on it', () => {
    const b = until('box', 'hide');
    const r = run('box', 3, () => ({ finger: { x: 110, h: 10 } }), b);
    expect(r.moves).toContain('ambush');
    expect(r.events.some((e) => e.kind === 'catch')).toBe(true);
    expect(r.b.x).toBeLessThan(160); // out of the box, by the finger
    expect(r.modes).toContain('sit');
  });
  it('misses a finger that pulls away mid-ambush, then hops back in', () => {
    const b = until('box', 'hide');
    let leapt = -1;
    const r = run('box', 5, (t, s) => { if (leapt < 0 && s.mode === 'leap') leapt = t; return leapt >= 0 && t > leapt + 0.1 ? {} : { finger: { x: 110, h: 10 } }; }, b);
    expect(r.events.some((e) => e.kind === 'miss')).toBe(true);
    expect(r.modes.slice(-3)).toEqual(expect.arrayContaining(['hop', 'pop']));
  });
  it('a hop takes HOP_S and clears the rim', () => {
    const o = opts('box'); let b = newHide(o); let top = 0; let t = 0;
    b = stepHide(b, { tap: { x: 10, h: 10 } }, 1 / 60, o).b;
    while (b.mode === 'hop') { b = stepHide(b, {}, 1 / 60, o).b; t += 1 / 60; top = Math.max(top, b.lift); }
    expect(t).toBeCloseTo(HOP_S, 1);
    expect(top).toBeGreaterThan(o.spot.height);
  });
});

describe('the tunnel', () => {
  it('zooms in one end and out the other on a tap', () => {
    const r = run('tunnel', 1.6, tapAt(0.1, 195, 30), undefined, () => 0.9); // 0.9: no stop inside
    expect(r.modes.slice(0, 3)).toEqual(['sit', 'zoom', 'sit']);
    expect(r.moves).toEqual(['zoom']);
    expect(r.b.x).toBeGreaterThan(315); // out the right end
    expect(r.b.face).toBe(-1); // turned round to face it again
  });
  it('is hidden while inside, not while outside', () => {
    const o = opts('tunnel'); const b = newHide(o);
    expect(inside(b, o)).toBe(false);
    expect(inside({ ...b, mode: 'zoom', x: 195 }, o)).toBe(true);
    expect(inside({ ...b, mode: 'hide', x: 195 }, o)).toBe(true);
  });
  it('sometimes stops to hide, then peeks out of an end and comes out', () => {
    const r = run('tunnel', 8, tapAt(0.1, 195, 30), undefined, () => 0.1); // 0.1: always stops
    expect(r.modes.slice(0, 5)).toEqual(['sit', 'zoom', 'hide', 'peek', 'zoom']);
    expect(r.moves).toEqual(expect.arrayContaining(['hide', 'peek']));
    expect(r.moves).not.toContain('zoom'); // came back out the same end: not a lap
  });
  it('bursts out when you tap the bump where he hides', () => {
    let hid = -1;
    const r = run('tunnel', 3, (t, b) => { if (t < 1 / 60) return { tap: { x: 195, h: 30 } }; if (hid < 0 && b.mode === 'hide') hid = t; return hid >= 0 && t > hid + 0.3 && t < hid + 0.32 ? { tap: { x: b.x, h: 40 } } : {}; }, undefined, () => 0.1);
    expect(r.moves).toContain('ambush');
    expect(r.modes).toContain('leap');
    expect(r.events.some((e) => e.kind === 'catch')).toBe(true);
  });
  it('pokes a paw out at a finger by an end while he hides', () => {
    let hid = false;
    const r = run('tunnel', 3, (t, b) => { if (t < 1 / 60) return { tap: { x: 195, h: 30 } }; if (b.mode === 'hide') hid = true; return hid ? { finger: { x: 50, h: 20 } } : {}; }, undefined, () => 0.1);
    expect(r.moves).toContain('paw');
    expect(r.b.face).toBe(-1); // out of the left end, toward the finger
  });
  it('three laps in a row', () => {
    const taps = [0.1, 1.5, 2.9];
    const r = run('tunnel', 4.5, (t) => (taps.some((a) => Math.abs(t - a) < 1 / 120) ? { tap: { x: 195, h: 30 } } : {}), undefined, () => 0.9);
    expect(r.moves.filter((m) => m === 'zoom').length).toBe(3);
    expect(r.moves).toContain('laps');
  });
});

describe('moves', () => {
  it('every hiding-toy move the brain emits is listed, and found moves read from the log', () => {
    const emitted = new Set([...run('box', 20, () => ({ finger: { x: 340, h: 30 } })).moves, ...run('tunnel', 30).moves]);
    for (const m of emitted) expect([...PLAY_MOVES.box, ...PLAY_MOVES.tunnel].map((x) => x.id)).toContain(m);
    expect(movesFound([{ id: 'move-box-boo' }, { id: 'move-tunnel-zoom' }], 'box')).toEqual(['boo']);
  });
});
