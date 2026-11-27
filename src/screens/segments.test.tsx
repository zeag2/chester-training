import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act, within } from '@testing-library/react';
import { store } from '../db/store';
import App from '../App';
import { Care } from './Care';
import { Skills } from './Skills';
import { Train } from './Train';

// Health "Overview · Log · Documents" and Skills "Tree · List" (cozy Home plan step 2; UX review items 4 and 5)
function fakeMedia(w: number) {
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: /reduce/.test(q) ? false : w >= min, media: q, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
}
const day = 864e5;

beforeAll(async () => {
  await store.load();
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '', training: true });
  await store.saveCare('weight', { lb: 6.1 }, { at: Date.now() - 2 * day });
  await store.saveCare('symptom', { what: 'Sneezing', worried: false }, { at: Date.now() - 3 * day });
  await store.saveCare('groom', { what: 'nails' }, { at: Date.now() - 12 * day });
  await store.saveCare('med', { name: 'Revolution Plus', what: 'flea' }, { at: Date.now() - 20 * day });
  await store.saveCare('food', { name: 'Chicken pâté', type: 'wet', verdict: 'love', current: true }, {});
  await store.settled();
});
beforeEach(() => { sessionStorage.clear(); fakeMedia(390); });
afterEach(() => { cleanup(); location.hash = ''; });

const tab = (name: string) => screen.getByRole('tab', { name });
const panel = () => screen.getByRole('tabpanel');

describe('Health: a segmented control, Overview · Log · Documents', () => {
  it('starts on Overview; the tabs switch the view, put it in the address and are remembered for the session', () => {
    location.hash = '#/health';
    render(<Care />);
    expect(screen.getByRole('tablist', { name: 'Health' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Overview', 'Log', 'Documents']);
    expect(tab('Overview').getAttribute('aria-selected')).toBe('true');
    expect(panel().getAttribute('aria-labelledby')).toBe(tab('Overview').id);
    fireEvent.click(tab('Log'));
    expect(tab('Log').getAttribute('aria-selected')).toBe('true');
    expect(panel().getAttribute('data-view')).toBe('log');
    expect(location.hash).toBe('#/health/log');
    cleanup();
    render(<Care />); // back on Health later in the session
    expect(tab('Log').getAttribute('aria-selected')).toBe('true');
  });
  it('arrow keys move between segments', () => {
    render(<Care view="overview" />);
    fireEvent.keyDown(tab('Overview'), { key: 'ArrowRight' });
    expect(tab('Log').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Log'));
    fireEvent.keyDown(tab('Log'), { key: 'ArrowLeft' });
    fireEvent.keyDown(tab('Overview'), { key: 'ArrowLeft' });
    expect(tab('Documents').getAttribute('aria-selected')).toBe('true');
  });
  it('the thumb is told which segment to sit under (CSS slides it over --dur; jumps with reduced motion)', () => {
    const { container } = render(<Care view="documents" />);
    const seg = container.querySelector('.seg.slide') as HTMLElement;
    expect(seg.style.getPropertyValue('--seg-n')).toBe('3');
    expect(seg.style.getPropertyValue('--seg-i')).toBe('2');
    expect(seg.querySelector('.segthumb')).toBeTruthy();
  });
  it('one primary button per view at most', () => {
    for (const v of ['overview', 'log', 'documents'] as const) {
      const { container } = render(<Care view={v} />);
      expect(panel().querySelectorAll('.btn').length, v).toBeLessThanOrEqual(1);
      expect(container.querySelectorAll('[role="tabpanel"] .btn').length).toBeLessThanOrEqual(1);
      cleanup();
    }
  });
  it('Overview has the vet, visits, Summary for the vet, the last weight, and Food and treats as one row that opens the list', () => {
    render(<Care view="overview" />);
    const p = panel();
    expect(p.querySelector('[data-health="lastweight"]')!.textContent).toContain('6.1 lb');
    expect(p.textContent).toContain('Visits');
    expect(p.textContent).toContain('Summary for the vet');
    expect(screen.getByRole('button', { name: /Book a visit/ }).className).toBe('btn2');
    const row = p.querySelector('[data-health="food"]') as HTMLElement;
    expect(row.textContent).toContain('Using now: Chicken pâté');
    expect(p.textContent).not.toContain('Loves it');
    fireEvent.click(row);
    const sheet = screen.getByRole('dialog');
    expect(sheet.textContent).toContain('Loves it');
    fireEvent.click(within(sheet).getByRole('button', { name: /Chicken pâté/ }));
    expect(screen.getByRole('dialog').textContent).toContain('Edit food or treat'); // its form, in place of the list
  });
  it('Log: the last 7 days in view; older days folded into the Accordion', () => {
    render(<Care view="log" />);
    const p = panel();
    const acc = screen.getByRole('button', { name: 'Older than a week (2)' });
    expect(acc.getAttribute('aria-expanded')).toBe('false');
    const region = p.querySelector('.accbody')!;
    expect(region.textContent).toContain('Grooming');
    expect(region.textContent).toContain('Revolution Plus');
    expect(region.getAttribute('aria-hidden')).toBe('true');
    // the recent ones are outside it
    const outside = [...p.querySelectorAll('button.item')].filter((b) => !b.closest('.card')).filter((b) => !region.contains(b)).map((b) => b.querySelector('b')!.textContent);
    expect(outside).toEqual(['Quick logs', 'Weight', 'Symptom']);
    fireEvent.click(acc);
    expect(acc.getAttribute('aria-expanded')).toBe('true');
  });
  it('desktop: Log keeps the table (no accordion)', () => {
    fakeMedia(1440);
    const { container } = render(<Care view="log" />);
    expect(container.querySelector('.healthlog table')).toBeTruthy();
    expect(container.querySelector('.acc')).toBeNull();
  });
  it('a log form from the + list lands on Log (documents and food on their own views)', () => {
    render(<Care open="symptom" />);
    expect(tab('Log').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('dialog')).toBeTruthy();
    cleanup();
    render(<Care open="doc" />);
    expect(tab('Documents').getAttribute('aria-selected')).toBe('true');
    cleanup();
    render(<Care open="food" />);
    expect(tab('Overview').getAttribute('aria-selected')).toBe('true');
  });
  it('deep links land in the right place (through the app’s routes)', async () => {
    for (const [hash, view] of [['#/health/documents', 'Documents'], ['#/health/log', 'Log'], ['#/health/overview', 'Overview'], ['#/care/log', 'Log']] as const) {
      location.hash = hash;
      render(<App />);
      await act(async () => { await store.settled(); });
      expect(tab(view).getAttribute('aria-selected'), hash).toBe('true');
      cleanup();
    }
    location.hash = '#/health/visit/nope'; // the visit page is still its own page
    render(<App />);
    expect(screen.queryByRole('tablist', { name: 'Health' })).toBeNull();
  });
});

describe('Skills: one screen, Tree · List', () => {
  it('Tree shows the branches; List has the search and branch chips; remembered for the session', () => {
    render(<Skills />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Tree', 'List']);
    expect(tab('Tree').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Foundation' })).toBeTruthy();
    expect(screen.queryByLabelText('Search skills')).toBeNull();
    fireEvent.click(tab('List'));
    expect(location.hash).toBe('#/skills/list');
    expect(screen.getByLabelText('Search skills')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Filter by branch' })).toBeTruthy();
    cleanup();
    render(<Skills />);
    expect(tab('List').getAttribute('aria-selected')).toBe('true');
  });
  it('the old #/tree and #/library redirect to #/skills/tree and #/skills/list', async () => {
    for (const [from, to, view] of [['#/tree', '#/skills/tree', 'Tree'], ['#/library', '#/skills/list', 'List']] as const) {
      location.hash = from;
      render(<App />);
      await act(async () => {});
      expect(location.hash).toBe(to);
      expect(tab(view).getAttribute('aria-selected')).toBe('true');
      cleanup();
    }
  });
  it('Chester → More: one Skills row (no Skill tree or Library), Trophy case stays', () => {
    render(<Train />);
    fireEvent.click(screen.getByRole('button', { name: /^Skills/ }));
    expect(location.hash).toBe('#/skills');
    expect(screen.queryByRole('button', { name: /^Skill tree/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Library/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Trophy case/ })).toBeTruthy();
  });
});
