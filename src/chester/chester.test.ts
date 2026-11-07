import { describe, it, expect, vi } from 'vitest';
import { pickReaction, REACTIONS } from './reactions';
import * as audio from '../lib/audio';
import { chesterSVG } from './art';

describe('reactions', () => {
  it('never repeats the previous reaction', () => {
    let last = null as any;
    for (let i = 0; i < 500; i++) { const r = pickReaction(last); expect(r).not.toBe(last); last = r; }
  });
  it('golden purr is the rarest', () => {
    const min = Math.min(...REACTIONS.map((r) => r.weight));
    expect(REACTIONS.find((r) => r.id === 'r11')!.weight).toBe(min);
  });
});

describe('audio', () => {
  it('does not throw without an AudioContext', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => { audio.click(); audio.chirp(); audio.purr(); audio.sparkle(); audio.buzz(10); }).not.toThrow();
  });
});

describe('art', () => {
  it('renders every pose for every coat with unique clip ids', () => {
    for (const pose of ['sit', 'walk', 'ball', 'sleep', 'loaf'] as const) {
      const a = chesterSVG({ pose, coat: 'calico', uid: 'a' }); const b = chesterSVG({ pose, coat: 'calico', uid: 'b' });
      expect(a).toContain('<svg'); expect(a).not.toEqual(b);
    }
  });
});

describe('art safety', () => {
  it('escapes the cat name in the label', () => {
    const s = chesterSVG({ uid: 'x', label: 'Bo"><img src=x onerror=alert(1)>' });
    expect(s).not.toContain('<img');
  });
});
