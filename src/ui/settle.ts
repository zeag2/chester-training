import { useLayoutEffect, useRef } from 'react';

/** "Settle into place" (docs/design-system.md, Motion): a row added while you watch fades and rises 6 px into place
    (220 ms, --ease-out, starting 40 ms late) while the rows around it slide to make room over the same 220 ms (FLIP),
    so the list never jumps. Reduced motion: a 120 ms fade, neighbours jump. Never on first render, and not when the
    whole list changes at once (switching pets).

    Put the returned ref on the list (or any ancestor) and `data-settle-key={id}` on each row:
      const ref = useSettle<HTMLTableSectionElement>(rows.map((r) => r.id));
      <tbody ref={ref}>{rows.map((r) => <tr key={r.id} data-settle-key={r.id}>…)}</tbody> */
export function useSettle<T extends HTMLElement>(keys: readonly string[]) {
  const ref = useRef<T>(null);
  const prev = useRef<{ keys: Set<string>; tops: Map<string, number> } | null>(null);
  useLayoutEffect(() => {
    const root = ref.current; if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-settle-key]')];
    const base = root.getBoundingClientRect().top;
    const tops = new Map(rows.map((el) => [el.dataset.settleKey!, el.getBoundingClientRect().top - base]));
    const before = prev.current; prev.current = { keys: new Set(keys), tops };
    if (!before || [...before.keys].join('|') === keys.join('|')) return; // first render, or nothing added: nothing settles
    const added = rows.filter((el) => !before.keys.has(el.dataset.settleKey!));
    const kept = rows.length - added.length;
    if (!added.length || kept === 0 || added.length > 3) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const el of added) {
      el.classList.remove('settle'); void el.offsetWidth; el.classList.add('settle');
      el.addEventListener('animationend', () => el.classList.remove('settle'), { once: true });
    }
    if (reduce) return;
    const css = getComputedStyle(document.documentElement);
    const dur = parseFloat(css.getPropertyValue('--dur')) || 220, ease = css.getPropertyValue('--ease-out').trim() || 'ease-out';
    for (const el of rows) {
      const k = el.dataset.settleKey!, was = before.tops.get(k);
      if (was == null || typeof el.animate !== 'function') continue;
      const dy = was - tops.get(k)!;
      if (Math.abs(dy) > 0.5) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: dur, easing: ease });
    }
  }); // every render, so the "before" positions are always the latest
  return ref;
}
