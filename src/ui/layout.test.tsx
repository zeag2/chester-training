import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react';
import { currentLayout } from './layout';
import { TabBar } from './TabBar';

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
  it('renders the same bottom bar markup as before the desktop layout', () => {
    fakeMedia(390);
    const { container } = render(<TabBar active="home" onPlus={() => {}} dot="me" />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<nav class="tabs" aria-label="Main"><div class="tabs-in"><a href="#/home" class="tab on" aria-current="page"><span style="position: relative; display: inline-flex;"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style="stroke: currentcolor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;"><path d="M4 11 L12 4 L20 11 V20 H4 Z"></path></svg></span>Home</a><a href="#/health" class="tab "><span style="position: relative; display: inline-flex;"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style="stroke: currentcolor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 20 C6 15.5 3 12.5 3 9 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 21 9 C21 12.5 18 15.5 12 20 Z"></path></svg></span>Health</a><button class="tab" aria-label="Log something"><span class="plus"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" style="stroke: currentcolor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 5 V19 M5 12 H19"></path></svg></span></button><a href="#/train" class="tab "><span style="position: relative; display: inline-flex;"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style="stroke: currentcolor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 12 m-7.5 0 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0 M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0"></path></svg></span>Train</a><a href="#/me" class="tab "><span style="position: relative; display: inline-flex;"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style="stroke: currentcolor; fill: none; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 12 m-4 -4 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4.5 20 C5.5 16 8.5 14.5 12 14.5 C15.5 14.5 18.5 16 19.5 20"></path></svg><i class="tabdot" aria-label="new"></i></span>Me</a></div></nav>"`);
    expect(document.documentElement.dataset.nav).toBeUndefined();
  });
  it('keeps the phone CSS for the bar and the page column, and keys every new rule off the tablet/desktop nav', async () => {
    const fs = 'node:fs'; // read the file itself: vitest drops CSS imports
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    expect(css).toContain('.screen{max-width:480px;margin:0 auto;padding:calc(20px + var(--safe-t)) 20px calc(110px + var(--safe-b));position:relative;min-height:100dvh}');
    expect(css).toContain('.tabs{position:fixed;left:0;right:0;bottom:0;background:var(--tabs);border-top:1px solid var(--line);display:flex;justify-content:center;padding:8px 0 max(10px,var(--safe-b));z-index:20}');
    expect(css).toContain('.tabs-in{display:flex;justify-content:space-around;width:100%;max-width:480px}');
    const added = css.slice(css.indexOf('/* ── Tablet and desktop navigation'));
    for (const rule of added.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r: string) => r.trim()).filter(Boolean)) {
      expect(rule, rule).toMatch(/^(html\[data-nav|\.tabs\.rail|\.sidenav|\.navtabs|\.petswitch\.innav)/);
    }
  });
});

describe('Side rail and side nav', () => {
  it('tablet: an 88 px rail with the + first, and the page moved over', () => {
    fakeMedia(900);
    const plus: string[] = [];
    const { container } = render(<TabBar active="health" onPlus={() => plus.push('+')} />);
    const nav = container.querySelector('nav')!;
    expect(nav.className).toBe('tabs rail');
    expect([...nav.querySelectorAll('.tab')].map((e) => e.textContent || e.getAttribute('aria-label'))).toEqual(['Log something', 'Home', 'Health', 'Train', 'Me']);
    expect(nav.querySelector('[aria-current="page"]')!.textContent).toBe('Health');
    expect(document.documentElement.dataset.nav).toBe('rail');
    fireEvent.click(screen.getByRole('button', { name: 'Log something' })); expect(plus).toEqual(['+']);
  });
  it('desktop: a side nav with Log at the top; resizing switches layouts and back to the phone bar', () => {
    fakeMedia(1280);
    const plus: string[] = [];
    const { container, unmount } = render(<TabBar active="me" onPlus={() => plus.push('+')} dot="me" />);
    expect(container.querySelector('nav')!.className).toBe('sidenav');
    expect(document.documentElement.dataset.nav).toBe('side');
    fireEvent.click(screen.getByRole('button', { name: 'Log' })); expect(plus).toEqual(['+']);
    expect(container.querySelector('.tab.on')!.textContent).toBe('Me');
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
