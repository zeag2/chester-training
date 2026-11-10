import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/* A short note at the bottom of the screen after something is saved from a sheet that has already closed
   ("Booked Tue, Nov 24, 10:30 AM · Added to calendar"), with an optional Undo. One at a time; it goes after a few
   seconds. `<ToastHost />` is mounted once, in App. */

export interface ToastNote { msg: string; action?: { label: string; run: () => void }; ms?: number }
let current: (ToastNote & { id: number }) | null = null;
let n = 0;
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

export function showToast(t: ToastNote) { current = { ...t, id: ++n }; ping(); }
export function hideToast() { current = null; ping(); }

export function ToastHost() {
  const t = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current);
  useEffect(() => {
    if (!t) return;
    const id = t.id; const timer = window.setTimeout(() => { if (current?.id === id) hideToast(); }, t.ms ?? 6000);
    return () => window.clearTimeout(timer);
  }, [t]);
  if (!t) return null;
  return createPortal(<div key={t.id} className="toast pop wrap" role="status">
    <span className="msg sp">{t.msg}</span>
    {t.action && <button className="btn2" onClick={() => { const a = t.action!; hideToast(); a.run(); }}>{t.action.label}</button>}
  </div>, document.body);
}
