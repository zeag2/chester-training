import { useState, useSyncExternalStore } from 'react';

/* Adding PalDex to the Home Screen. Android (Chrome, Edge, Samsung) hands us an install prompt we can show from a button;
   iPhone has no such API, so there the button opens a short guide to Share → Add to Home Screen. */

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallPrompt | null = null;
let installed = false;
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

/** Call once at startup, before React renders: the prompt event can fire very early. */
export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; ping(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; ping(); });
}

export function isStandalone(): boolean {
  return !!(navigator as any).standalone || matchMedia('(display-mode: standalone)').matches;
}
export type Platform = 'ios' | 'android' | 'desktop';
export function platform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const SKIP = 'paldex-install-skip';
/** The install page shows first on a phone's browser, until it's added or skipped. */
export function wantsInstallStep(): boolean {
  if (isStandalone() || platform() === 'desktop') return false;
  try { return localStorage.getItem(SKIP) !== '1'; } catch { return true; }
}
export function skipInstallStep() { try { localStorage.setItem(SKIP, '1'); } catch { /* private mode */ } }

/** Whether the browser offered a real install prompt, and whether it has been installed this visit. */
export function useInstallState() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => (installed ? 'installed' : deferred ? 'prompt' : 'none'));
}
/** Show the browser's own install prompt. Returns true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const d = deferred; if (!d) return false;
  await d.prompt();
  const { outcome } = await d.userChoice;
  deferred = null; if (outcome === 'accepted') installed = true; ping();
  return outcome === 'accepted';
}

export function useInstallHint() { const [s] = useState(() => !isStandalone()); return s; }
