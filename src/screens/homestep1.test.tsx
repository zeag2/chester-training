import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { store } from '../db/store';
import { Home } from './Home';
import { Care } from './Care';
import { QuickLog } from './QuickLog';
import { Accordion } from '../ui/Accordion';
import { TabBar } from '../ui/TabBar';
import { playIconMotion } from '../ui/iconMotion';
import { localDay } from '../engine/day';
import { LOG_NAMES } from '../engine/care';

// A fake matchMedia for a window `w` px wide (same idea as src/ui/layout.test.tsx).
function fakeMedia(w: number) {
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: w >= min, media: q, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
}
const order = (c: HTMLElement) => [...c.querySelectorAll('[data-home]')].map((e) => e.getAttribute('data-home'));

beforeAll(async () => {
  fakeMedia(390);
  await store.load();
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
});
afterEach(() => { cleanup(); location.hash = ''; });

describe('Home step 1: top down from simple to complex', () => {
  it('390 px: greeting, stage, Quick log, daily check, then Training and the corner; nothing due means no Due now', () => {
    fakeMedia(390);
    const { container } = render(<Home />);
    const o = order(container);
    expect(o.slice(0, 4)).toEqual(['greeting', 'stage', 'quicklog', 'dailycheck']);
    expect(o).not.toContain('duenow');
    expect(o.indexOf('training')).toBeGreaterThan(o.indexOf('dailycheck'));
    if (o.includes('corner')) expect(o.indexOf('corner')).toBeGreaterThan(o.indexOf('training'));
  });
  it('the old Today card’s buttons and the age footer are gone from Home', () => {
    fakeMedia(390);
    const { container } = render(<Home />);
    for (const name of ['Weight', 'Symptom', 'Food', 'Vet']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(container.textContent).not.toMatch(/Chester · (about|\d)/);
    expect([...container.querySelectorAll('b')].some((b) => b.textContent === 'Today')).toBe(false);
  });
  it('Due now shows medicine due today and the next booked visit, after the daily check and before Training', async () => {
    fakeMedia(390);
    await act(async () => {
      await store.saveCare('med', { name: 'Revolution Plus', what: 'medicine', nextDue: localDay(Date.now()) }, { at: Date.now() - 30 * 864e5 });
      await store.saveCare('vet', { reason: 'Checkup', status: 'booked' }, { at: Date.now() + 5 * 864e5 });
    });
    const { container } = render(<Home />);
    const o = order(container);
    expect(o.indexOf('duenow')).toBeGreaterThan(o.indexOf('dailycheck'));
    expect(o.indexOf('duenow')).toBeLessThan(o.indexOf('training'));
    const due = container.querySelector('[data-home="duenow"]')!;
    expect(due.textContent).toContain('Revolution Plus');
    expect(due.textContent).toContain('Next vet visit');
    expect(due.textContent).toContain('Checkup');
    expect(due.querySelector('a')!.getAttribute('href')).toMatch(/^#\/health\/visit\//);
  });
  it('desktop keeps two columns: the stage and the everyday care left; training, the corner and friends right', () => {
    fakeMedia(1440);
    const { container } = render(<Home />);
    const [left, right] = container.querySelectorAll('.homecols > .homecol') as unknown as HTMLElement[];
    expect(order(left).slice(0, 3)).toEqual(['stage', 'quicklog', 'dailycheck']);
    expect(order(right)[0]).toBe('training');
    fakeMedia(390);
  });
});

describe('the daily check: one row, Water and Appetite in an accordion, one line once done', () => {
  it('closed, it is the question and two answers; the accordion opens Water and Appetite', async () => {
    fakeMedia(390);
    for (const c of store.get().care.filter((x) => x.kind === 'daily')) await act(async () => { await store.deleteCare(c.id); });
    const { container } = render(<Home />);
    const check = container.querySelector('[data-home="dailycheck"]')!;
    expect(check.querySelectorAll(':scope > .row > button')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Water' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Water and appetite/ }));
    expect(screen.getByRole('group', { name: 'Water' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'All normal' })); await store.settled(); });
    const done = container.querySelector('[data-home="dailycheck"]')!;
    expect(done.tagName).toBe('P');
    expect(done.textContent).toMatch(/^Today’s check: all normal/);
  });
});

describe('Accordion', () => {
  it('a button with aria-expanded; closed content is inert and hidden from VoiceOver', () => {
    render(<Accordion title="Older notes"><button>Inside</button></Accordion>);
    const head = screen.getByRole('button', { name: 'Older notes' });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    const body = document.getElementById(head.getAttribute('aria-controls')!)!;
    expect(body.hasAttribute('inert')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(body.hasAttribute('inert')).toBe(false);
    expect(head.closest('.acc')!.className).toContain('open');
    expect(screen.getByRole('button', { name: 'Inside' })).toBeTruthy();
  });
  it('can be controlled', () => {
    const seen: boolean[] = [];
    render(<Accordion title="Signs" open={false} onToggle={(o) => seen.push(o)}>x</Accordion>);
    fireEvent.click(screen.getByRole('button', { name: 'Signs' }));
    expect(seen).toEqual([true]);
    expect(screen.getByRole('button', { name: 'Signs' }).getAttribute('aria-expanded')).toBe('false');
  });
  it('animates in --dur, with a reduced-motion fallback that has no height animation', async () => {
    const fs = 'node:fs';
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    expect(css).toMatch(/\.accbody\{[^}]*transition:grid-template-rows var\(--dur\) var\(--ease-out\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\s*\.accchev,\.accbody,\.acc\.open \.accbody\{transition:none\}\s*\.acc\.open \.accinner\{animation:kaccfade var\(--dur-fast\)/);
  });
});

describe('the + button is the one full log list', () => {
  it('groups Health, Food, Training and Documents, one name per kind', () => {
    render(<QuickLog onClose={() => {}} />);
    const groups = [...document.querySelectorAll('[data-loggroup]')].map((g) => g.getAttribute('data-loggroup'));
    expect(groups).toEqual(['Health', 'Food', 'Training', 'Documents']);
    const rows = (g: string) => [...document.querySelectorAll(`[data-loggroup="${g}"] .lrow`)].map((r) => r.firstElementChild!.nextElementSibling!.firstChild!.textContent);
    expect(rows('Health')).toEqual([LOG_NAMES.weight, LOG_NAMES.symptom, LOG_NAMES.med, LOG_NAMES.vet, LOG_NAMES.groom]);
    expect(rows('Food')).toEqual([LOG_NAMES.food]);
    expect(rows('Training')).toEqual([LOG_NAMES.train]);
    expect(rows('Documents')).toEqual([LOG_NAMES.doc]);
  });
  it('a row opens its form on Health', () => {
    let closed = false;
    render(<QuickLog onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: LOG_NAMES.med }));
    expect(closed).toBe(true);
    expect(location.hash).toBe('#/health/log/med');
  });
  it('Health’s Log something uses the same names', () => {
    render(<Care view="log" />);
    expect(screen.getByRole('button', { name: LOG_NAMES.med })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Medicine' })).toBeNull();
  });
});

describe('the last weight moved to Health’s top', () => {
  it('shows the last weight and the change, before the vet cards', async () => {
    await act(async () => {
      await store.saveCare('weight', { lb: 8.4 }, { at: Date.now() - 20 * 864e5 });
      await store.saveCare('weight', { lb: 8.9 }, { at: Date.now() - 2 * 864e5 });
    });
    const { container } = render(<Care view="overview" />);
    const chip = container.querySelector('[data-health="lastweight"]')!;
    expect(chip.textContent).toContain('Last weight · 8.9 lb (+0.5)');
    const h2 = container.querySelector('h2');
    if (h2) expect(chip.compareDocumentPosition(h2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('icon motion: played by the person’s action, never on load', () => {
  it('nothing moves on first render', () => {
    fakeMedia(390);
    const { container } = render(<><Home /><TabBar active="home" onPlus={() => {}} /></>);
    expect(container.querySelector('[class*="imo-turn"]:not(.imo-hover-turn), .imo-bounce, .imo-nod, .imo-pop')).toBeNull();
  });
  it('picking a tab bounces its icon (the cat’s tab nods); the current tab doesn’t move; + pops; the gear turns', () => {
    fakeMedia(390);
    const { container } = render(<TabBar active="home" onPlus={() => {}} catLabel="Chester" />);
    const tab = (name: string) => [...container.querySelectorAll('a.tab')].find((a) => a.textContent === name)!;
    fireEvent.click(tab('Home'));
    expect(tab('Home').querySelector('svg')!.classList.contains('imo-bounce')).toBe(false);
    fireEvent.click(tab('Health'));
    expect(tab('Health').querySelector('svg')!.classList.contains('imo-bounce')).toBe(true);
    fireEvent.click(tab('Chester'));
    expect(tab('Chester').querySelector('svg')!.classList.contains('imo-nod')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log something' }));
    expect(screen.getByRole('button', { name: 'Log something' }).querySelector('svg')!.classList.contains('imo-pop')).toBe(true);
    cleanup();
    render(<Home />);
    const gear = screen.getByRole('button', { name: 'Settings' });
    fireEvent.click(gear);
    expect(gear.querySelector('svg')!.classList.contains('imo-turn')).toBe(true);
  });
  it('the class comes off when the move ends, so the next tap plays it again', () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    playIconMotion(el, 'pop');
    expect(el.classList.contains('imo-pop')).toBe(true);
    el.dispatchEvent(new Event('animationend'));
    expect(el.classList.contains('imo-pop')).toBe(false);
  });
  it('every move is at most --dur, never loops, and has a reduced-motion fallback with no movement', async () => {
    const fs = 'node:fs';
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/tokens.css', 'utf8');
    for (const k of ['turn', 'bounce', 'nod', 'pop']) expect(css).toMatch(new RegExp(`\\.imo-${k}\\{animation:kimo${k} var\\(--dur\\) var\\(--ease-out\\)[;}]`));
    expect(css).not.toMatch(/kimo\w+[^;}]*infinite/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\s*\.imo-turn,\.imo-bounce,\.imo-nod,\.imo-pop\{animation:kimofade var\(--dur-fast\) linear\}/);
    expect(css).toMatch(/@keyframes kimofade\{50%\{opacity:\.6\}\}/);
  });
});
