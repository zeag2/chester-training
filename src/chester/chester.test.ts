import { describe, it, expect, vi } from 'vitest';
import { LYING_OK, pickReaction, REACTIONS } from './reactions';
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
  it('only picks gentle reactions when he is lying down or kneading', () => {
    let last: any = null;
    for (let i = 0; i < 300; i++) { const r = pickReaction(last, Math.random, false); expect(LYING_OK).toContain(r); last = r; }
  });
});

describe('art', () => {
  const poses = ['sit', 'doze', 'walk', 'ball', 'sleep', 'drape', 'loaf', 'knead', 'fly', 'run', 'curl', 'full', 'sploot', 'crouch', 'leap', 'reach', 'scratch'] as const;
  it('every pose draws in every coat with the parts the rig and CSS use', async () => {
    const { COATS } = await import('./art');
    for (const pose of poses) for (const coat of Object.keys(COATS)) {
      const svg = chesterSVG({ pose, coat, uid: 'x', wear: 'crown' });
      expect(svg).toContain(`pose-${pose}`);
      expect(svg).toContain('class="head"');
      expect(svg).toContain('wear-crown');
      expect(svg).not.toContain('NaN');
      if (pose !== 'fly') expect(svg).toContain('class="r-head"');
      if (pose === 'sit' || pose === 'doze' || pose === 'drape' || pose === 'sleep' || pose === 'full' || pose === 'sploot') expect(svg).toContain('class="r-all"');
      if (pose === 'run') for (const l of ['legFL', 'legFR', 'legBL', 'legBR']) expect(svg).toContain(`class="${l}"`);
      if (pose === 'full') { expect(svg).toContain('class="pawPat"'); expect(svg).toContain('class="puff"'); }
      if (pose === 'scratch') for (const k of ['rakeA', 'rakeB', 'foreA', 'foreB', 'claws', 'tailS', 'bodyg', 'all']) expect(svg).toContain(`class="${k}"`);
    }
  });
  it('the sit pose can split its front legs at the elbow, and draw the swatting paw over the head', () => {
    const tube = chesterSVG({ pose: 'sit', uid: 'x' });
    expect(tube).not.toContain('class="upL"');
    for (const legs of ['flex', 'swat'] as const) {
      const svg = chesterSVG({ pose: 'sit', uid: 'x', legs });
      for (const k of ['upL', 'loL', 'upR', 'loR', 'pawL', 'pawR', 'r-legL', 'r-legR']) expect(svg).toContain(`class="${k}"`);
    }
    const swat = chesterSVG({ pose: 'sit', uid: 'x', legs: 'swat' });
    expect(swat.indexOf('class="pawR"')).toBeGreaterThan(swat.indexOf('class="head"'));
    expect(tube.indexOf('class="pawR"')).toBeLessThan(tube.indexOf('class="head"'));
    // only the sit pose takes it
    expect(chesterSVG({ pose: 'doze', uid: 'x', legs: 'flex' })).not.toContain('class="upL"');
  });
  it('the sitting tail wraps round the front paws', () => {
    const svg = chesterSVG({ pose: 'sit', uid: 'x' });
    expect(svg).toMatch(/class="rtail" data-tail=/);
  });
});
