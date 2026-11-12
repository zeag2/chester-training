import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { store } from '../db/store';
import { Care } from './Care';
import { Documents } from './Documents';

// A fake matchMedia for a window `w` px wide (same idea as src/ui/layout.test.tsx).
function fakeMedia(w: number) {
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: w >= min, media: q, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
}
const noon = (d: string) => Date.parse(d + 'T12:00:00');

beforeAll(async () => {
  await store.load();
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
  await store.saveCare('weight', { lb: 6.1 }, { at: noon('2026-11-01') });
  await store.saveCare('symptom', { what: 'Sneezing', worried: false }, { at: noon('2026-11-05') });
  await store.saveCare('vet', { reason: 'Checkup', clinic: 'Maple Street Vet', status: 'done' }, { at: noon('2026-10-20') });
  await store.saveCare('doc', { title: 'Invoice', path: 'c/i.pdf', mime: 'application/pdf', bytes: 1 }, { at: noon('2026-10-20') });
  await store.saveCare('food', { name: 'Chicken pâté', type: 'wet', verdict: 'love', current: true }, {});
  await store.saveCare('daily', { what: 'fed' }, {});
  await store.saveCare('daily', { what: 'check', ok: true }, { at: Date.now() - 864e5 });
  await store.settled();
});
afterEach(() => { cleanup(); location.hash = ''; });

const h2s = (c: HTMLElement) => [...c.querySelectorAll('h2')].map((h) => h.textContent);
const files = (list: File[], types = ['Files']) => ({ dataTransfer: { types, files: list, dropEffect: 'none' } });

describe('Health on phones and tablets (under 1100 px) stays as before', () => {
  for (const w of [390, 900]) it(`${w} px: one column in today's order, the log as a list, no desktop classes`, () => {
    fakeMedia(w);
    const { container } = render(<Care />);
    expect(container.querySelector('.screen')!.className).toBe('screen');
    expect(container.querySelector('.healthcols, .healthlog, table, .dropnote')).toBeNull();
    expect(h2s(container)).toEqual(['Log something', 'Kitten vaccines and checkups', 'Food and treats', 'Documents', 'Health log']);
    // the log is still rows (Quick logs first), and quick logs aren't listed one by one
    const items = [...container.querySelectorAll('button.item')].map((b) => b.querySelector('b')?.textContent);
    expect(items.slice(-4)).toEqual(['Quick logs', 'Symptom', 'Weight', 'Vet visit']);
  });
});

describe('Health on desktop (1100 px and up)', () => {
  it('uses the wide screen and two columns: vet, visits, Coming up and Log something left; documents, weight, food right', () => {
    fakeMedia(1440);
    const { container } = render(<Care />);
    expect(container.querySelector('.screen')!.className).toBe('screen wide');
    const cols = container.querySelectorAll('.healthcols > .healthcol');
    expect(cols).toHaveLength(2);
    expect(h2s(cols[0] as HTMLElement)).toEqual(['Log something', 'Kitten vaccines and checkups']);
    expect(cols[0].textContent).toContain('Summary for the vet');
    expect(h2s(cols[1] as HTMLElement)).toEqual(['Documents', 'Food and treats']);
    expect(cols[1].textContent).toContain('Weight');
    // the log is after the columns, across both
    expect(container.querySelector('.healthcols + .healthlog')).toBeTruthy();
  });
  it('shows the Health log as a table (date · what · details · who), newest first, with the last 7 days’ quick logs', () => {
    fakeMedia(1440);
    const { container } = render(<Care />);
    const table = container.querySelector('.healthlog table')!;
    // no one else in the household here, so no "Who" column of blanks
    expect([...table.querySelectorAll('th')].map((t) => t.textContent)).toEqual(['Date', 'What', 'Details']);
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.map((r) => r.querySelectorAll('td')[1].textContent)).toEqual(['Fed', 'Daily check', 'Symptom', 'Weight', 'Vet visit']);
    expect(rows[1].querySelectorAll('td')[2].textContent).toBe('All normal');
    expect(rows[2].querySelectorAll('td')[2].textContent).toBe('Sneezing');
    expect(rows[0].className).toBe('quick');
  });
  it('a row opens what the list opens: the visit page, the entry’s form, or the quick-log sheet', () => {
    fakeMedia(1440);
    const { container } = render(<Care />);
    const row = (what: string) => [...container.querySelectorAll('tbody tr')].find((r) => r.querySelectorAll('td')[1].textContent === what)!;
    fireEvent.click(within(row('Weight') as HTMLElement).getByRole('button'));
    expect(screen.getByRole('dialog').textContent).toContain('Edit Weight');
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Close'));
    fireEvent.click(row('Fed'));
    expect(screen.getByRole('dialog').textContent).toContain('Chester: Quick logs');
    fireEvent.click(within(screen.getByRole('dialog')).getByLabelText('Close'));
    fireEvent.click(row('Vet visit'));
    expect(location.hash).toMatch(/^#\/health\/visit\//);
  });
  it('keeps its CSS in its own block, keyed only on the desktop-only classes and the drop note', async () => {
    const fs = 'node:fs';
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    const start = css.indexOf('/* ── Desktop Health'), end = css.indexOf('/* ── end of desktop Health');
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const block = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = [...block.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'));
    expect(selectors.length).toBeGreaterThan(10);
    for (const s of selectors) expect(s, s).toMatch(/^(\.healthcols|\.healthcol|\.healthlog|\.dropnote|html\[data-nav="(rail|side)"\] \.dropnote|:root(:not\(\[data-theme="light"\]\)|\[data-theme="dark"\]) \.dropnote)/);
  });
});

describe('Drag and drop a document', () => {
  it('Health: a file held over the screen shows the drop note; dragged text doesn’t; a file that isn’t a photo or PDF is refused', () => {
    fakeMedia(1440);
    const { container } = render(<Care />);
    const root = container.querySelector('.screen')!;
    fireEvent.dragEnter(root, files([], ['text/plain']));
    expect(container.querySelector('.dropnote')).toBeNull();
    fireEvent.dragEnter(root, files([]));
    expect(container.querySelector('.dropnote')).toBeTruthy();
    fireEvent.dragLeave(root, files([]));
    expect(container.querySelector('.dropnote')).toBeNull();
    fireEvent.dragEnter(root, files([]));
    fireEvent.drop(root, files([new File(['x'], 'notes.txt', { type: 'text/plain' })]));
    expect(container.querySelector('.dropnote')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('That file can’t be read. Drop a photo or a PDF.');
  });
  it('All documents: dropping opens the adder and hands it the file', () => {
    fakeMedia(1440);
    const { container } = render(<Documents />);
    expect(container.querySelector('.card.grey')).toBeNull(); // the adder is closed while there are documents
    const root = container.querySelector('.screen')!;
    fireEvent.dragEnter(root, files([]));
    expect(container.querySelector('.dropnote')).toBeTruthy();
    fireEvent.drop(root, files([new File(['x'], 'page.docx', { type: 'application/msword' })]));
    expect(screen.getByLabelText('Add a document').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Drop a photo or a PDF');
  });
});
