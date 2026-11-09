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

export type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'inapp' | 'other';
/** Which browser this is, for the Add to Home Screen steps (they differ by browser, not just by phone).
    `inapp`: a browser inside another app (Instagram, Facebook, TikTok…), which can't add to the Home Screen at all. */
export function browser(ua = navigator.userAgent): Browser {
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest|GSA\//.test(ua) || /; wv\)/.test(ua)) return 'inapp';
  if (/EdgiOS|EdgA|Edg\//.test(ua)) return 'edge';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/FxiOS|Firefox\//.test(ua)) return 'firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /iPhone|iPad|iPod|Macintosh/.test(ua)) return 'safari';
  return 'other';
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
