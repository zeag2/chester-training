import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Sheet } from './Sheet';

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
afterEach(() => { cleanup(); listeners.clear(); });

/** A page with an opener button, like the real ones: opens a form with a field and Save. */
function Page({ inner }: { inner?: boolean }) {
  const [open, setOpen] = useState(false);
  const [cal, setCal] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open</button>
    {open && <Sheet label="New entry" onClose={() => setOpen(false)}>
      <button aria-label="Close" onClick={() => setOpen(false)}>x</button>
      <input aria-label="Weight" />
      <button className="btn sheetsave" onClick={() => inner ? setCal(true) : setOpen(false)}>Save</button>
    </Sheet>}
    {cal && <Sheet label="Add to which calendar?" onClose={() => setCal(false)}><button>Apple</button><button>Google</button></Sheet>}
  </>;
}
const open = () => { const b = screen.getByText('Open'); b.focus(); fireEvent.click(b); return b; };
const esc = () => fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
const tab = (shiftKey = false) => fireEvent.keyDown(document.activeElement || document.body, { key: 'Tab', shiftKey });

describe('Sheets on phones (under 760 px) stay bottom sheets', () => {
  it('keeps the same wrapper markup as before', () => {
    fakeMedia(390);
    const { container } = render(<Sheet label="Log something" onClose={() => {}}><p>hi</p></Sheet>);
    expect(container.innerHTML).toBe('<div class="overlay sheetbg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Log something" tabindex="-1"><p>hi</p></div></div>');
  });
  it('does not move focus on open (no surprise keyboard), but still gives it back on close', () => {
    fakeMedia(390); render(<Page />);
    const b = open();
    expect(document.activeElement).toBe(b);
    esc();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(b);
  });
  it('keeps the phone CSS, and keys every new sheet rule off the tablet/desktop classes', async () => {
    const fs = 'node:fs'; // read the file itself: vitest drops CSS imports
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    expect(css).toContain('.sheetbg{background:rgba(10,10,8,.42);justify-content:flex-end}');
    expect(css).toContain('.sheet{background:var(--bg);border-radius:26px 26px 0 0;padding:16px 20px calc(24px + var(--safe-b));max-height:88dvh;overflow:auto;width:100%;max-width:480px;margin:0 auto;animation:ksheet 320ms var(--ease-out)}');
    const start = css.indexOf('/* ── Tablet and desktop sheets'), end = css.indexOf('/* ── Tablet and desktop navigation');
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const section = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes \w+\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
    const selectors = [...section.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'));
    expect(selectors.length).toBeGreaterThan(8);
    for (const s of selectors) expect(s, s).toMatch(/\.sheetbg(\.dialog|\.panel|:is\(\.dialog,\.panel\))/);
    // the Save buttons only stick on the wide layouts
    for (const line of css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => l.includes('.sheetsave'))) expect(line, line).toMatch(/\.sheetbg(\.panel|:is\(\.dialog,\.panel\)) \.sheetsave/);
  });
});

describe('Sheets on tablet and desktop', () => {
  it('tablet (760–1099 px): a centred dialog; desktop (1100 px and up): a side panel; resizing switches', () => {
    fakeMedia(900);
    const { container } = render(<Sheet label="Book a visit" onClose={() => {}}><p>hi</p></Sheet>);
    expect(container.firstElementChild!.className).toBe('overlay sheetbg dialog');
    setWidth(1440); expect(container.firstElementChild!.className).toBe('overlay sheetbg panel');
    setWidth(759); expect(container.firstElementChild!.className).toBe('overlay sheetbg');
  });
  it('moves focus into the dialog on open, unless a field already has it', () => {
    fakeMedia(1280);
    const { unmount } = render(<Page />); open();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    render(<Sheet label="Your vet" onClose={() => {}}><input aria-label="Clinic" autoFocus /></Sheet>);
    expect(document.activeElement).toBe(screen.getByLabelText('Clinic'));
  });
  it('Esc closes it and focus goes back to the opener', () => {
    fakeMedia(900); render(<Page />);
    const b = open();
    expect(screen.getByRole('dialog', { name: 'New entry' })).toBeTruthy();
    esc();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(b);
  });
  it('Tab and Shift+Tab stay inside the sheet', () => {
    fakeMedia(1280); render(<Page />); open();
    const [close, field, save] = [screen.getByLabelText('Close'), screen.getByLabelText('Weight'), screen.getByText('Save')];
    tab(); expect(document.activeElement).toBe(close); // from the dialog itself to its first control
    save.focus(); tab(); expect(document.activeElement).toBe(close);
    tab(true); expect(document.activeElement).toBe(save);
    field.focus(); tab(); expect(document.activeElement).toBe(field); // middle items: the browser moves on as usual
  });
  it('a sheet over a sheet: Esc closes only the top one, then the one under it', () => {
    fakeMedia(1280); render(<Page inner />); open();
    const save = screen.getByText('Save'); save.focus(); fireEvent.click(save);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    esc();
    expect(screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-label'))).toEqual(['New entry']);
    expect(document.activeElement).toBe(save);
    esc();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('clicking the dim area closes it, clicking inside does not', () => {
    for (const w of [390, 900, 1440]) {
      fakeMedia(w); render(<Page />); open();
      fireEvent.click(screen.getByLabelText('Weight'));
      expect(screen.getByRole('dialog'), `${w} px`).toBeTruthy();
      fireEvent.click(screen.getByRole('dialog').parentElement!);
      expect(screen.queryByRole('dialog'), `${w} px`).toBeNull();
      cleanup();
    }
  });
  it('locks the page scroll on tablet/desktop while any sheet is open (nested too), never on phones', () => {
    const h = document.documentElement;
    fakeMedia(390); render(<Page />); open();
    expect(h.style.overflow).toBe('');
    cleanup();
    fakeMedia(1440); render(<Page inner />); open();
    expect(h.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByText('Save')); expect(screen.getAllByRole('dialog')).toHaveLength(2);
    esc(); expect(h.style.overflow).toBe('hidden');
    esc(); expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.style.overflow).toBe('');
  });
});
