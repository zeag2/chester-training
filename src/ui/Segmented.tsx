import { useRef } from 'react';

/** Segmented control (docs/design-system.md, Components): switches between exclusive, equal views of one screen
    (Health "Overview · Log · Documents", Skills "Tree · List"). A tablist; the white thumb slides to the chosen
    segment over --dur (CSS `.seg.slide` / `.segthumb`), and jumps with reduced motion. The view it shows is the
    screen's `role="tabpanel"`: give it `id={segPanelId(idBase)}` and `aria-labelledby={segTabId(idBase, value)}`. */
export const segTabId = (base: string, v: string) => `${base}-tab-${v}`;
export const segPanelId = (base: string) => `${base}-panel`;

export function Segmented<T extends string>({ label, options, value, onChange, idBase, style }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void; idBase: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const i = Math.max(0, options.findIndex(([v]) => v === value));
  const move = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length][0];
    onChange(next);
    ref.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(segTabId(idBase, next))}`)?.focus();
  };
  return <div ref={ref} className="seg slide" role="tablist" aria-label={label} onKeyDown={move}
    style={{ ...style, '--seg-n': options.length, '--seg-i': i } as React.CSSProperties}>
    <span className="segthumb" aria-hidden="true" />
    {options.map(([v, l]) => <button key={v} type="button" role="tab" id={segTabId(idBase, v)} aria-selected={v === value} aria-controls={segPanelId(idBase)}
      tabIndex={v === value ? 0 : -1} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
  </div>;
}

/** The view a screen remembers for this session (sessionStorage; private mode just forgets). */
export function rememberedView<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = sessionStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
}
export function rememberView(key: string, v: string) { try { sessionStorage.setItem(key, v); } catch { /* private mode */ } }

/** Put the view in the address without a new history entry (so Back still leaves the screen, and a reload lands on it). */
export function showViewInAddress(path: string) {
  if (location.hash !== '#/' + path) history.replaceState(history.state, '', '#/' + path);
}
