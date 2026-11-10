import { useEffect, useState } from 'react';
export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => { const f = () => { setR(read()); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path: string) => { location.hash = '#/' + path; };

/* How many in-app pages are behind this one, kept in each history entry's state: 0 for the page the app was opened
   on (a link, a bookmark, the Home Screen), one more for each page reached from inside the app. Going back restores
   the earlier entry's state, so it's always right. `history.length` isn't: it counts other sites in the tab too. */
let depth = 0;
const depthOf = (st: unknown) => (st && typeof (st as { depth?: unknown }).depth === 'number' ? (st as { depth: number }).depth : null);
/** Sets up the counting (once, at start-up; again in tests). */
export function trackHistory() {
  depth = depthOf(history.state) ?? 0;
  if (depthOf(history.state) == null) history.replaceState({ ...(history.state ?? {}), depth }, '');
}
if (typeof window !== 'undefined') {
  trackHistory();
  window.addEventListener('hashchange', () => {
    const d = depthOf(history.state);
    if (d == null) { depth += 1; history.replaceState({ ...(history.state ?? {}), depth }, ''); } // a new page
    else depth = d; // back or forward to one we've seen
  });
}
/** Back to the previous in-app page, or to `fallback` when this page is where the app was opened (so Back never
    leaves the app). */
export function back(fallback: string) {
  if (depthOf(history.state) ?? depth) history.back(); else go(fallback);
}
