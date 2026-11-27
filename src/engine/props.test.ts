import { describe, expect, it } from 'vitest';
import { COATS } from '../chester/art';
import { fillScene, restScene, SCENES, sceneById } from '../chester/propScenes';
import { ICONS } from '../chester/props';
import { ITEM_BY_ID } from './corner';
import { PLAY_MOVES } from './play';
import { AFTER_MIN_MS, AFTER_MS, classify, GESTURE, pickPropMove, PROP_MOVES, PROP_TOYS, track, type Gesture, type LastMove } from './props';

describe('the four props', () => {
  it('are in the shop (the donut as a cushion) with 5 moves each, and a 48 px icon', () => {
    expect(ITEM_BY_ID.donut.kind).toBe('cushion');
    for (const p of ['post', 'perch', 'kicker']) expect(ITEM_BY_ID[p].kind).toBe('toy');
    for (const p of PROP_TOYS) {
      expect(PROP_MOVES[p]).toHaveLength(5);
      expect(new Set(PROP_MOVES[p].map((m) => m.id)).size).toBe(5);
      expect(PLAY_MOVES[p].map((m) => m.id)).toEqual(PROP_MOVES[p].map((m) => m.id));
      expect(ICONS[p]).toContain('<');
    }
  });

  it('every move has its scene, and every scene is a move (20 in all)', () => {
    expect(SCENES).toHaveLength(20);
    for (const p of PROP_TOYS) for (const m of PROP_MOVES[p]) expect(sceneById(`${p}-${m.id}`)?.prop).toBe(p);
    for (const s of SCENES) expect(PROP_MOVES[s.prop].some((m) => `${s.prop}-${m.id}` === s.id)).toBe(true);
  });

  it('every move can be found from the stage', () => {
    for (const p of PROP_TOYS) for (const m of PROP_MOVES[p]) {
      const now = 100_000;
      // right after the move it follows (an idle one: once that one has ended)
      const last: LastMove | null = m.after ? (m.gesture === 'idle' ? { move: m.after, start: 0, end: 1000 } : { move: m.after, start: now - AFTER_MIN_MS - 10, end: now + 500 }) : null;
      expect(pickPropMove(p, m.gesture, last, now)?.id, `${p} ${m.id}`).toBe(m.id);
    }
  });

  it('"after" moves only follow their move, inside the window', () => {
    const now = 100_000;
    // a tap long after the scratch is a plain tap again
    expect(pickPropMove('post', 'tap', { move: 'scratch', start: 0, end: now - AFTER_MS - 1 }, now)?.id).toBe('stretch');
    // a tap right after the scratch started (a quick burst) doesn't skip past it
    expect(pickPropMove('post', 'tap', { move: 'scratch', start: now - 100, end: now + 3000 }, now)).toBeNull();
    expect(pickPropMove('post', 'tap', { move: 'scratch', start: now - 1000, end: now + 2000 }, now)?.id).toBe('strut');
    // idle after round-and-round is the nap; otherwise round-and-round again
    expect(pickPropMove('donut', 'idle', { move: 'circles', start: 0, end: 1 }, now)?.id).toBe('nap');
    expect(pickPropMove('donut', 'idle', { move: 'nap', start: 0, end: 1 }, now)?.id).toBe('circles');
    // the bliss comes only after the zoomies
    expect(pickPropMove('kicker', 'idle', null, now)).toBeNull();
    expect(pickPropMove('kicker', 'idle', { move: 'zoomies', start: 0, end: 1 }, now)?.id).toBe('bliss');
  });

  it('a move playing is not restarted, and three quick taps turn a stretch into a scratch', () => {
    const now = 100_000;
    expect(pickPropMove('donut', 'tap', { move: 'knead', start: now - 2000, end: now + 2000 }, now)).toBeNull();
    expect(pickPropMove('donut', 'hold', { move: 'knead', start: now - 100, end: now + 4000 }, now)).toBeNull();
    expect(pickPropMove('donut', 'hold', { move: 'knead', start: now - 1000, end: now + 3000 }, now)?.id).toBe('blink');
    expect(pickPropMove('post', 'taps', { move: 'stretch', start: now - 300, end: now + 4000 }, now)?.id).toBe('scratch');
    // a gesture with no move on this prop plays nothing
    expect(pickPropMove('donut', 'flick', null, now)).toBeNull();
  });

  it('sorts a press into a gesture', () => {
    const g = (p: Partial<{ ms: number; dist: number; turns: number; quick: number }>) => classify({ ms: 100, dist: 0, turns: 0, quick: 1, ...p });
    expect(g({})).toBe('tap');
    expect(g({ quick: 3 })).toBe('taps');
    expect(g({ ms: GESTURE.holdMs })).toBe('hold');
    expect(g({ dist: 60, ms: 200 })).toBe('flick');
    expect(g({ dist: 120, ms: 900 })).toBe('flick');
    expect(g({ dist: 40, ms: 900 })).toBeNull();
    expect(g({ dist: 60, ms: 900, turns: 2 })).toBe('wiggle');
  });

  it('counts the turns of a drag back and forth', () => {
    const t = track();
    t.down(0, 0, 0);
    for (const x of [10, 20, 30, 20, 10, 0, 10, 20, 30]) t.move(x, 0);
    const p = t.up(500);
    expect(p.turns).toBe(2);
    expect(p.dist).toBe(30);
    const g: Gesture | null = classify({ ...p, quick: 0 });
    expect(g).toBe('wiggle');
  });
});

describe('the prop scenes', () => {
  it('fill every slot with his drawing, in every coat, with no repeated ids', () => {
    for (const coat of Object.keys(COATS)) for (const s of [...SCENES, ...PROP_TOYS.map(restScene)]) {
      const svg = fillScene(s, { coat, eyes: 'gold', wear: 'crown', name: 'Chester' });
      expect(svg, s.id).not.toContain('{{CAT');
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
      expect(svg).toContain(`class="scene sc-${s.id}"`);
      expect(svg).toContain('wear-crown');
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size, s.id).toBe(ids.length);
    }
  });

  it('use the new poses where the art asks for them', () => {
    const f = (id: string) => fillScene(sceneById(id)!, { coat: 'orange' });
    expect(f('post-scratch')).toContain('pose-scratch');
    expect(f('post-stretch')).toContain('pose-scratch');
    expect(f('donut-knead')).toContain('class="upL"');
    expect(f('post-pom')).toContain('class="upR"');
    expect(f('kicker-kicks')).toContain('class="pickleH"');
    expect(f('kicker-kicks')).not.toContain('class="yarn"');
  });

  it('every animation props.css plays is defined (there or in chester.css), and --fall is a token', async () => {
    const fs = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fs)) as { readFileSync: (p: string, e: string) => string };
    const css = readFileSync('src/chester/props.css', 'utf8');
    const all = css + readFileSync('src/chester/chester.css', 'utf8');
    const used = new Set([...css.matchAll(/animation:\s*([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((n) => n !== 'none'));
    for (const n of used) expect(all, n).toMatch(new RegExp(`@keyframes ${n}\\b`));
    expect(readFileSync('src/styles/tokens.css', 'utf8')).toMatch(/--fall:/);
  });
});
