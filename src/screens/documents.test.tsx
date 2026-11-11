import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { store } from '../db/store';
import { Documents } from './Documents';
import { TooltipHost, tipText, TIP_DELAY } from '../ui/Tooltip';

// A fake matchMedia for a window `w` px wide that can hover (same idea as src/ui/layout.test.tsx).
function fakeMedia(w: number, hover = true) {
  window.matchMedia = ((q: string) => {
    const min = Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0);
    return { matches: q.includes('hover') ? hover : w >= min, media: q, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
}
const noon = (d: string) => Date.parse(d + 'T12:00:00');

beforeAll(async () => {
  await store.load();
  await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-05-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
  await store.saveCare('doc', { title: 'Invoice', path: 'c/i.pdf', mime: 'application/pdf', bytes: 1, summary: 'Checkup, $85.' }, { at: noon('2026-10-20') });
  await store.saveCare('doc', { title: 'Rabies tag', path: 'c/r.jpg', mime: 'image/jpeg', bytes: 1 }, { at: noon('2026-11-02') });
  await store.settled();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('All documents', () => {
  for (const w of [390, 900]) it(`${w} px: one list as before, a tap opens the document, no preview`, () => {
    fakeMedia(w);
    const { container } = render(<Documents />);
    expect(container.querySelector('.screen')!.className).toBe('screen');
    expect(container.querySelector('.docpanes, .docpreview, .docrow.on')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Rabies tag' })).toBeTruthy();
  });

  it('desktop: two panes; the newest is shown first, a click shows another; PDF in an iframe, a photo as an image', async () => {
    fakeMedia(1440);
    vi.spyOn(store, 'docUrl').mockImplementation(async (p) => 'https://x.test/' + p);
    const { container } = render(<Documents />);
    expect(container.querySelector('.screen')!.className).toBe('screen wide');
    expect(container.querySelectorAll('.docpanes > .doclist .docrow')).toHaveLength(2);
    const pane = container.querySelector('.docpreview')!;
    expect(pane.getAttribute('aria-label')).toBe('Preview of Rabies tag');
    expect((await screen.findByRole('img', { name: 'Rabies tag' })).getAttribute('src')).toBe('https://x.test/c/r.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Show Invoice' }));
    expect(container.querySelector('.docrow.on')!.textContent).toContain('Invoice');
    expect(container.querySelector('.docpreview')!.textContent).toContain('Checkup, $85.');
    expect((await screen.findByTitle('Invoice')).tagName).toBe('IFRAME');
  });

  it('desktop: signed out (no link), the preview says so instead', async () => {
    fakeMedia(1440);
    vi.spyOn(store, 'docUrl').mockImplementation(() => { throw new Error('Sharing is off'); });
    render(<Documents />);
    expect(await screen.findByText(/need you signed in/)).toBeTruthy();
  });
});

describe('Tooltips on icon-only buttons', () => {
  it('uses data-tip, else the aria-label up to its colon', () => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', 'More for Invoice: rename, link to a visit or delete');
    expect(tipText(b)).toBe('More for Invoice');
    b.setAttribute('data-tip', 'More');
    expect(tipText(b)).toBe('More');
  });

  const hoverBack = () => {
    const btn = document.createElement('button'); btn.className = 'iconbtn'; btn.setAttribute('aria-label', 'Back'); document.body.append(btn);
    fireEvent.pointerOver(btn, { pointerType: 'mouse' });
    return btn;
  };

  it('with a mouse, shows the label after about half a second, and hides on click', () => {
    fakeMedia(1440);
    vi.useFakeTimers();
    render(<TooltipHost />);
    const btn = hoverBack();
    expect(document.querySelector('.tooltip')).toBeNull();
    act(() => { vi.advanceTimersByTime(TIP_DELAY); });
    expect(document.querySelector('.tooltip')!.textContent).toBe('Back');
    act(() => { fireEvent.pointerDown(btn); });
    expect(document.querySelector('.tooltip')).toBeNull();
    btn.remove();
  });

  it('never on a device that can’t hover (phones)', () => {
    fakeMedia(390, false);
    vi.useFakeTimers();
    render(<TooltipHost />);
    const btn = hoverBack();
    act(() => { vi.advanceTimersByTime(TIP_DELAY * 2); });
    expect(document.querySelector('.tooltip')).toBeNull();
    btn.remove();
  });
});
