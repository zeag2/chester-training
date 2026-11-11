import { useEffect, useRef, type ReactNode } from 'react';
import { useLayout } from './layout';

/* The one wrapper every form and sheet uses (docs/plans/2026-11-11-desktop-layout.md, step 2).
   - phone (under 760 px): the bottom sheet, exactly the markup it always had (`overlay sheetbg` > `sheet`).
   - tablet (760–1099 px): adds `dialog`: a centred dialog, 520 px, at most 85vh, scrolling inside, with the
     `.sheetsave` button stuck to its bottom.
   - desktop (1100 px and up): adds `panel`: a 420 px panel on the right, so the page stays readable behind it.
   Everywhere: Esc closes the top sheet, Tab and Shift+Tab stay inside it, and focus goes back to whatever opened it.
   Clicking the dim area closes it, as before. */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
/** Open sheets, newest last: only the top one answers Esc and keeps Tab inside it (a calendar choice over Book a visit). */
const open: HTMLElement[] = [];
/** How many tablet/desktop sheets hold the page's scroll lock (nested sheets share it). */
let locks = 0;

export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const layout = useLayout();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  const wide = layout !== 'phone';

  useEffect(() => {
    const el = ref.current!; open.push(el);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (open[open.length - 1] !== el) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => !x.closest('[hidden],[inert]'));
      if (!items.length) { e.preventDefault(); el.focus(); return; }
      const first = items[0], last = items[items.length - 1], at = document.activeElement;
      if (!el.contains(at) || (at === el && !e.shiftKey)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && (at === first || at === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      open.splice(open.indexOf(el), 1);
      // back to the button that opened it, if it's still on the page (a saved form may have re-rendered it away)
      if (opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // with a keyboard and mouse (tablet/desktop), start inside the dialog unless a field already took focus (autoFocus);
  // phones keep today's behaviour (no focus move, so no surprise keyboard or scroll)
  useEffect(() => {
    const el = ref.current!;
    if (wide && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [wide]);

  // tablet/desktop: the page behind doesn't scroll under the wheel while a sheet is open (padding stands in for a
  // classic scrollbar, so nothing shifts sideways); phones are left exactly as before
  useEffect(() => {
    if (!wide) return;
    const h = document.documentElement;
    if (locks++ === 0) { const bar = window.innerWidth - h.clientWidth; h.style.overflow = 'hidden'; if (bar > 0) h.style.paddingRight = bar + 'px'; }
    return () => { if (--locks === 0) { h.style.overflow = ''; h.style.paddingRight = ''; } };
  }, [wide]);

  return <div className={'overlay sheetbg' + (layout === 'tablet' ? ' dialog' : layout === 'desktop' ? ' panel' : '')} onClick={onClose}>
    <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={(e) => e.stopPropagation()}>{children}</div>
  </div>;
}
