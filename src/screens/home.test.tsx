import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import { Home, homeScene } from './Home';

// A fake matchMedia for a window `w` px wide (same idea as src/ui/layout.test.tsx).
function fakeMedia(w: number) {
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: w >= min, media: q, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
}

beforeAll(async () => {
  await store.load();
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
});
afterEach(() => cleanup());

const catWidth = (c: HTMLElement) => c.querySelector('.gagwrap svg.kc')?.getAttribute('width');

describe('Home on phones and tablets (under 1100 px) stays as before', () => {
  it('keeps the 104 px cat, the 84 px cats beside him and today’s spacing', () => {
    expect(homeScene('phone')).toEqual({ big: false, cat: 104, other: 84, bed: 150, gap: 70, bubbleLift: 26 });
    expect(homeScene('tablet')).toEqual(homeScene('phone'));
  });
  for (const w of [390, 900]) it(`${w} px: one column, no desktop classes, cat at 104 px`, () => {
    fakeMedia(w);
    const { container } = render(<Home />);
    const screen = container.querySelector('.screen')!;
    expect(screen.className).toBe('screen');
    expect(container.querySelector('.homecols, .homescene, .big')).toBeNull();
    expect(catWidth(container)).toBe('104');
    // the cat row is still the first thing after the greeting, then the cards, all straight under .stag
    const stag = container.querySelector('.stag')!;
    expect(stag.children[1].className).toBe('row');
    expect(stag.querySelector(':scope > a[href="#/train"]')).toBeTruthy();
  });
});

describe('Home on desktop (1100 px and up)', () => {
  it('uses the wide screen and two columns: the cat, Quick log and Today left; friends, training and the corner right', () => {
    fakeMedia(1440);
    const { container } = render(<Home />);
    expect(container.querySelector('.screen')!.className).toBe('screen wide');
    const cols = container.querySelectorAll('.homecols > .homecol');
    expect(cols).toHaveLength(2);
    expect(cols[0].firstElementChild!.className).toBe('row homescene big');
    expect(cols[0].querySelector('a[href="#/train"]')).toBeNull();
    expect(cols[1].querySelector('a[href="#/train"]')).toBeTruthy();
    expect(catWidth(container)).toBe('160');
  });
  it('scales everything measured against the cat by the same ratio (160 / 104)', () => {
    const s = homeScene('desktop'), k = 160 / 104;
    expect(s.cat).toBe(160);
    for (const [big, small] of [[s.other, 84], [s.bed, 150], [s.gap, 70]]) expect(Math.abs(big / small - k)).toBeLessThan(0.03);
  });
  it('keeps its CSS in its own block, keyed only on desktop-only classes', async () => {
    const fs = 'node:fs';
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    const start = css.indexOf('/* ── Desktop Home'), end = css.indexOf('/* ── end of desktop Home');
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
    for (const rule of block.split('}').map((r) => r.trim()).filter(Boolean)) expect(rule, rule).toMatch(/^(\.homecols|\.homecol|\.homescene\.big|html\[data-nav="side"\])/);
  });
});
