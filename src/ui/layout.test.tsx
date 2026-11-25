import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react';
import { currentLayout } from './layout';
import { TabBar } from './TabBar';
import { appCssResolved } from '../styles/cssText';

// A fake matchMedia for a window `width` px wide; setWidth() moves it and fires 'change' like a browser does.
let width = 390;
const listeners = new Set<() => void>();
function fakeMedia(w: number) {
  width = w;
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: width >= min, media: q, addEventListener: (_: string, f: () => void) => listeners.add(f), removeEventListener: (_: string, f: () => void) => listeners.delete(f) };
  }) as unknown as typeof window.matchMedia;
}
const setWidth = (w: number) => act(() => { width = w; listeners.forEach((f) => f()); });

afterEach(() => { cleanup(); listeners.clear(); delete document.documentElement.dataset.nav; });

describe('useLayout breakpoints', () => {
  it('phone under 760 px, tablet 760–1099 px, desktop from 1100 px', () => {
    for (const [w, l] of [[320, 'phone'], [390, 'phone'], [759, 'phone'], [760, 'tablet'], [900, 'tablet'], [1099, 'tablet'], [1100, 'desktop'], [1440, 'desktop']] as const) {
      fakeMedia(w); expect(currentLayout(), `${w} px`).toBe(l);
    }
  });
  it('is the phone layout without matchMedia', () => {
    const real = window.matchMedia; (window as { matchMedia?: unknown }).matchMedia = undefined;
    try { expect(currentLayout()).toBe('phone'); } finally { window.matchMedia = real; }
  });
});

describe('Tab bar on phones (under 760 px) stays exactly as before', () => {
  it('renders the phone bottom bar: Home, Health, +, the cat, Friends (Chester-style icons since 2026-11-25)', () => {
    fakeMedia(390);
    const { container } = render(<TabBar active="home" onPlus={() => {}} dot="friends" />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<nav class="tabs" aria-label="Main"><div class="tabs-in"><a href="#/home" class="tab on" aria-current="page"><span style="position: relative; display: inline-flex;"><svg class="cicon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 11 L12 4 L20 11 V19 A1 1 0 0 1 19 20 H5 A1 1 0 0 1 4 19 Z" style="fill: var(--branch-manners); stroke: none;"></path><path d="M4 11 L12 4 L20 11 V19 A1 1 0 0 1 19 20 H15 V14.5 H9 V20 H5 A1 1 0 0 1 4 19 Z" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path></svg></span>Home</a><a href="#/health" class="tab "><span style="position: relative; display: inline-flex;"><svg class="cicon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 20 C6 15.5 3 12.5 3 9 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 21 9 C21 12.5 18 15.5 12 20 Z" style="fill: var(--branch-care); stroke: none;"></path><path d="M12 20 C6 15.5 3 12.5 3 9 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 21 9 C21 12.5 18 15.5 12 20 Z" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path></svg></span>Health</a><button class="tab" aria-label="Log something"><span class="plus cplus"><svg class="cicon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 12 A9 9 0 1 0 21 12 A9 9 0 1 0 3 12 Z" style="fill: var(--branch-foundation); stroke: none;"></path><path d="M3 12 A9 9 0 1 0 21 12 A9 9 0 1 0 3 12 Z" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path><path d="M12 7.5 V16.5 M7.5 12 H16.5" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path></svg></span></button><a href="#/chester" class="tab "><span style="position: relative; display: inline-flex;"><svg class="cicon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 13.5 C9 13.5 7 16 7 18 A2 2 0 0 0 9.5 20 C10.5 20 11 19.5 12 19.5 C13 19.5 13.5 20 14.5 20 A2 2 0 0 0 17 18 C17 16 15 13.5 12 13.5 Z M5.5 10.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M18.5 10.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M9.3 6.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M14.7 6.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0" style="fill: var(--branch-tricks); stroke: none;"></path><path d="M12 13.5 C9 13.5 7 16 7 18 A2 2 0 0 0 9.5 20 C10.5 20 11 19.5 12 19.5 C13 19.5 13.5 20 14.5 20 A2 2 0 0 0 17 18 C17 16 15 13.5 12 13.5 Z M5.5 10.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M18.5 10.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M9.3 6.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M14.7 6.5 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path></svg></span>Cats</a><a href="#/friends" class="tab "><span style="position: relative; display: inline-flex;"><svg class="cicon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12.2 7.5 A3.2 3.2 0 1 1 5.8 7.5 A3.2 3.2 0 1 1 12.2 7.5 Z M3 19.5 C3.7 16 6 14.2 9 14.2 C12 14.2 14.3 16 15 19.5 Z" style="fill: var(--icon-sky); stroke: none;"></path><path d="M12.2 7.5 A3.2 3.2 0 1 1 5.8 7.5 A3.2 3.2 0 1 1 12.2 7.5 Z M3 19.5 C3.7 16 6 14.2 9 14.2 C12 14.2 14.3 16 15 19.5 Z M15.5 4.6 A3 3 0 0 1 15.5 10.4 M17.5 14.4 C19.5 15 20.6 16.8 21 19.5" style="fill: none; stroke: var(--art-outline); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;"></path></svg><i class="tabdot" aria-label="new"></i></span>Friends</a></div></nav>"`);
    expect(document.documentElement.dataset.nav).toBeUndefined();
  });
  it('keeps the phone CSS for the bar and the page column, and keys every new rule off the tablet/desktop nav', async () => {
    const css = await appCssResolved(); // tokens written out: the phone rules must be exactly as before
    expect(css).toContain('.screen{max-width:480px;margin:0 auto;padding:calc(20px + var(--safe-t)) 20px calc(110px + var(--safe-b));position:relative;min-height:100dvh}');
    expect(css).toContain('.tabs{position:fixed;left:0;right:0;bottom:0;background:var(--tabs);border-top:1px solid var(--line);display:flex;justify-content:center;padding:8px 0 max(10px,var(--safe-b));z-index:20}');
    expect(css).toContain('.tabs-in{display:flex;justify-content:space-around;width:100%;max-width:480px}');
    const added = css.slice(css.indexOf('/* ── Tablet and desktop navigation')).split('/* ── Desktop polish')[0];
    for (const rule of added.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r: string) => r.trim()).filter(Boolean)) {
      expect(rule, rule).toMatch(/^(html\[data-nav|\.tabs\.rail|\.sidenav|\.navtabs|\.petswitch\.innav)/);
    }
  });
});

describe('Desktop polish (steps 3 and 8): hover, focus rings and the centred setup screens', () => {
  it('keeps every rule inside a media query that phones (under 760 px, no hover) never match', async () => {
    const fs = 'node:fs';
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    const start = css.indexOf('/* ── Desktop polish');
    expect(start).toBeGreaterThan(0);
    let block = css.slice(start).replace(/\/\*[\s\S]*?\*\//g, '');
    const next = block.indexOf('/* ──'); if (next > 0) block = block.slice(0, next);
    // walk the top level: only @media blocks with an allowed query, no bare rules
    const allowed = ['(hover:hover)', '(hover:hover) and (prefers-color-scheme:dark)', '(hover:hover),(min-width:760px)', '(min-width:760px)'];
    let i = 0; let blocks = 0;
    while (i < block.length) {
      if (/\s/.test(block[i])) { i++; continue; }
      const open = block.indexOf('{', i);
      const head = block.slice(i, open).trim();
      expect(head.startsWith('@media '), head).toBe(true);
      expect(allowed, head).toContain(head.slice(7).trim());
      let depth = 0; let j = open;
      for (; j < block.length; j++) { if (block[j] === '{') depth++; else if (block[j] === '}' && --depth === 0) break; }
      i = j + 1; blocks++;
    }
    expect(blocks).toBeGreaterThanOrEqual(2); // the hover colour tokens moved to tokens.css
  });
  it('the setup screens opt into the 640 px column with .screen.centred', async () => {
    const fs = 'node:fs';
    const read = async (f: string): Promise<string> => (await import(/* @vite-ignore */ fs)).readFileSync(f, 'utf8');
    for (const f of ['src/screens/Onboarding.tsx', 'src/screens/Install.tsx']) expect(await read(f)).toContain('className="screen centred"');
    expect(await read('src/styles/app.css')).toContain('.screen.centred{max-width:640px');
  });
});

describe('Side rail and side nav', () => {
  it('tablet: an 88 px rail with the + first, and the page moved over', () => {
    fakeMedia(900);
    const plus: string[] = [];
    const { container } = render(<TabBar active="health" onPlus={() => plus.push('+')} catLabel="Chester" />);
    const nav = container.querySelector('nav')!;
    expect(nav.className).toBe('tabs rail');
    expect([...nav.querySelectorAll('.tab')].map((e) => e.textContent || e.getAttribute('aria-label'))).toEqual(['Log something', 'Home', 'Health', 'Chester', 'Friends']);
    expect(nav.querySelector('[aria-current="page"]')!.textContent).toBe('Health');
    expect(document.documentElement.dataset.nav).toBe('rail');
    fireEvent.click(screen.getByRole('button', { name: 'Log something' })); expect(plus).toEqual(['+']);
  });
  it('desktop: a side nav with Log at the top; resizing switches layouts and back to the phone bar', () => {
    fakeMedia(1280);
    const plus: string[] = [];
    const { container, unmount } = render(<TabBar active="friends" onPlus={() => plus.push('+')} dot="friends" />);
    expect(container.querySelector('nav')!.className).toBe('sidenav');
    expect(document.documentElement.dataset.nav).toBe('side');
    fireEvent.click(screen.getByRole('button', { name: 'Log' })); expect(plus).toEqual(['+']);
    expect(container.querySelector('.tab.on')!.textContent).toBe('Friends');
    expect(container.querySelector('a.navsettings')!.getAttribute('href')).toBe('#/settings'); // Settings at the bottom of the side nav
    expect(container.querySelector('.tabdot')).toBeTruthy();
    setWidth(900);
    expect(container.querySelector('nav')!.className).toBe('tabs rail');
    expect(document.documentElement.dataset.nav).toBe('rail');
    setWidth(390);
    expect(container.querySelector('nav')!.className).toBe('tabs');
    expect(document.documentElement.dataset.nav).toBeUndefined();
    setWidth(1440); unmount();
    expect(document.documentElement.dataset.nav).toBeUndefined(); // pages without the tab bar (a session, play) aren't moved over
  });
});
