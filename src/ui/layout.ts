import { useSyncExternalStore } from 'react';

/** phone: under 760 px (today's layout, untouched). tablet: 760–1099 px (side rail). desktop: 1100 px and up (side nav). */
export type Layout = 'phone' | 'tablet' | 'desktop';

export const TABLET_MIN = 760, DESKTOP_MIN = 1100;
const Q_TABLET = `(min-width: ${TABLET_MIN}px)`, Q_DESKTOP = `(min-width: ${DESKTOP_MIN}px)`;

/** The layout for the window right now. Without matchMedia (tests, very old browsers) it's the phone layout. */
export function currentLayout(): Layout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'phone';
  if (window.matchMedia(Q_DESKTOP).matches) return 'desktop';
  return window.matchMedia(Q_TABLET).matches ? 'tablet' : 'phone';
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const qs = [window.matchMedia(Q_TABLET), window.matchMedia(Q_DESKTOP)];
  qs.forEach((q) => q.addEventListener?.('change', cb));
  return () => qs.forEach((q) => q.removeEventListener?.('change', cb));
}

/** phone / tablet / desktop, updated when the window crosses 760 or 1100 px. */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, currentLayout, () => 'phone');
}
