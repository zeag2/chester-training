import { useEffect, useState } from 'react';

/* Tooltips on icon-only buttons (docs/plans/2026-11-11-desktop-layout.md §4): with a mouse, resting on a
   `.iconbtn` (or anything with `data-tip`) for about half a second shows its label in a small bubble under it.
   Only where the device can hover, so phones never see one. The text is the button's own aria-label (or data-tip),
   so screen readers already have it: the bubble is aria-hidden. `<TooltipHost />` is mounted once, in App. */

const SEL = '.iconbtn[aria-label],[data-tip]';
export const TIP_DELAY = 500;

/** The text for a target: data-tip wins, else the aria-label up to its first colon ("More for X: rename…" → "More for X"). */
export function tipText(el: Element): string {
  const t = el.getAttribute('data-tip') ?? el.getAttribute('aria-label') ?? '';
  return t.split(':')[0].trim();
}

type Tip = { text: string; x: number; y: number; above: boolean };

export function TooltipHost() {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover:hover)').matches) return;
    let timer = 0, target: Element | null = null;
    const hide = () => { clearTimeout(timer); target = null; setTip(null); };
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.(SEL) ?? null;
      if (el === target) return;
      hide();
      if (!el) return;
      const text = tipText(el);
      if (!text) return;
      target = el;
      timer = window.setTimeout(() => {
        if (!target?.isConnected) return;
        const r = target.getBoundingClientRect();
        const above = r.bottom + 40 > window.innerHeight;
        setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90), y: above ? r.top - 6 : r.bottom + 6, above });
      }, TIP_DELAY);
    };
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('keydown', hide, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, []);
  if (!tip) return null;
  return <div className={'tooltip' + (tip.above ? ' above' : '')} aria-hidden="true" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}
