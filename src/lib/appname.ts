/* The app is named after the cats: "Chester", or "Chester & Luna", with an icon drawn from them. The name goes on the
   browser tab, the Home Screen title and the install manifest. Cats named before installing travel into the installed
   app in its address (?pets=Chester~black~gold,Luna~orange~green), because an iPhone Home Screen app doesn't share
   storage with Safari. On iPhone, the manifest link is dropped before adding to the Home Screen: with one present, iOS
   takes the start address (and name) from the manifest file, so the cats never arrived. Without it, iOS uses the page:
   its title, its apple-touch-icon and its own address. */
import { drawIcon } from './appicon';

export interface PetLook { name: string; coat?: string; eyes?: string }
const KEY = 'paldex-pending-pets';
const BASE_TITLE = 'PalDex';

export function titleFor(names: (string | PetLook)[]): string {
  const n = names.map((x) => (typeof x === 'string' ? x : x.name).trim()).filter(Boolean);
  if (n.length === 0) return BASE_TITLE;
  if (n.length === 1) return n[0];
  return n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1];
}

const asLook = (x: unknown): PetLook | null => typeof x === 'string' ? (x.trim() ? { name: x.trim() } : null)
  : x && typeof x === 'object' && typeof (x as PetLook).name === 'string' && (x as PetLook).name.trim() ? { name: (x as PetLook).name.trim(), coat: (x as PetLook).coat, eyes: (x as PetLook).eyes } : null;

/** Cats named before setup (on the install page, or carried in from the start address), with their looks. */
export function pendingPets(): PetLook[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.map(asLook).filter((x): x is PetLook => !!x) : []; } catch { return []; }
}
export function setPendingPets(pets: (string | PetLook)[]) {
  try { const n = pets.map(asLook).filter((x): x is PetLook => !!x).slice(0, 6); if (n.length) localStorage.setItem(KEY, JSON.stringify(n)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
/** Once a pet is set up, take it off the waiting list. */
export function donePendingPet(name: string) {
  const n = pendingPets(); const i = n.findIndex((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  setPendingPets(i >= 0 ? [...n.slice(0, i), ...n.slice(i + 1)] : n.slice(1));
}

/** Cats in an address: name~coat~eyes, comma-separated. */
export function encodePets(pets: PetLook[]): string {
  return pets.filter((p) => p.name.trim()).map((p) => [encodeURIComponent(p.name.trim().replace(/~/g, '-')), p.coat ?? '', p.eyes ?? ''].join('~').replace(/~+$/, '')).join(',');
}
export function decodePets(v: string): PetLook[] {
  return v.split(',').map((part) => { const [n, coat, eyes] = part.split('~'); let name = ''; try { name = decodeURIComponent(n ?? ''); } catch { name = n ?? ''; }
    return { name: name.trim(), coat: coat || undefined, eyes: eyes || undefined }; }).filter((p) => p.name);
}

/** At startup: keep cats passed in the start address, then tidy the address. */
export function takePendingFromUrl() {
  const q = new URLSearchParams(location.search); const v = q.get('pets');
  if (v == null) return;
  if (!pendingPets().length) setPendingPets(decodePets(v));
  q.delete('pets'); const rest = q.toString();
  history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
}

const isStandalone = () => !!(navigator as any).standalone || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/* An iPhone Home Screen app keeps the name and icon it was added with: changing the cats later doesn't update them.
   So the installed app remembers what it was added with (its first launch), and when the cats' names or looks that
   feed the icon change, Home says once: remove it and add it again. Not in Safari tabs, not on Android (Android
   updates the icon from the manifest). */
const ADDED_KEY = 'paldex-homescreen-look';
const NOTE_KEY = 'paldex-homescreen-note';
/** What the Home Screen title and icon are drawn from: all the names, and the first two cats' looks. */
export function homeLook(pets: (string | PetLook)[]): string {
  const looks = pets.map(asLook).filter((x): x is PetLook => !!x);
  return titleFor(looks) + '|' + looks.slice(0, 2).map((p) => `${p.coat ?? 'black'}/${p.eyes ?? 'gold'}`).join(',');
}
const homeApp = () => isIOS() && isStandalone();
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
/** In the installed iPhone app: remember the cats it was added with, the first time it runs with any. */
export function rememberHomeLook(pets: (string | PetLook)[], app = homeApp()) {
  if (!app || !pets.map(asLook).some(Boolean) || read(ADDED_KEY)) return;
  write(ADDED_KEY, homeLook(pets));
}
/** Whether to show "Your Home Screen icon still shows the old cats": in the installed iPhone app, the cats changed
    since it was added, and the note hasn't been closed for this change. */
export function staleHomeIcon(pets: (string | PetLook)[], app = homeApp()): boolean {
  if (!app) return false;
  const added = read(ADDED_KEY); const now = homeLook(pets);
  return !!added && !!pets.map(asLook).some(Boolean) && added !== now && read(NOTE_KEY) !== now;
}
export function closeHomeIconNote(pets: (string | PetLook)[]) { write(NOTE_KEY, homeLook(pets)); }

let original: Promise<Record<string, any> | null> | null = null;
let applied = '';
/** Put the cats' names and faces on the tab, the Home Screen title and icon, and the install manifest.
    `carry`: setup isn't done yet, so the cats ride along in the address for the installed app to pick up. */
export function applyAppName(pets: (string | PetLook)[], carry = false) {
  const looks = pets.map(asLook).filter((x): x is PetLook => !!x);
  const title = titleFor(looks);
  const key = title + '|' + (carry ? encodePets(looks) : '') + '|' + looks.map((p) => p.coat + '/' + p.eyes).join(',');
  if (key === applied) return; applied = key;
  rememberHomeLook(looks);
  document.title = title;
  meta('apple-mobile-web-app-title', title);
  const base = new URL(import.meta.env.BASE_URL, location.href);
  const start = carry && looks.length ? `?pets=${encodePets(looks)}` : '';
  const standalone = isStandalone();
  if (start && !standalone && location.pathname === base.pathname) history.replaceState(history.state, '', base.pathname + start + location.hash);
  // iPhone, before it's on the Home Screen: let iOS use this page (title, icon, address), not the manifest file
  if (isIOS() && !standalone) { document.querySelector('link[rel="manifest"]')?.remove(); meta('apple-mobile-web-app-capable', 'yes'); meta('mobile-web-app-capable', 'yes'); }
  void (async () => {
    const icon = looks.length ? await drawIcon(looks, 180) : null;
    const big = looks.length ? await drawIcon(looks, 512) : null;
    if (key !== applied) return;
    if (icon) { let l = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]'); if (!l) { l = document.createElement('link'); l.rel = 'apple-touch-icon'; document.head.appendChild(l); } l.href = icon; }
    await swapManifest(title, new URL(start, base).href, key, big);
  })();
}

function meta(name: string, content: string) {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!m) { m = document.createElement('meta'); m.name = name; document.head.appendChild(m); }
  m.content = content;
}

async function swapManifest(title: string, startUrl: string, key: string, icon: string | null) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]'); if (!link) return; // dev builds have none; iPhone drops it
  original ??= (async () => {
    try { const href = new URL(link.getAttribute('href')!, location.href); const m = await (await fetch(href)).json(); m.icons = (m.icons ?? []).map((i: any) => ({ ...i, src: new URL(i.src, href).href })); return m; }
    catch { return null; }
  })();
  const m = await original; if (!m || key !== applied) return;
  const base = new URL(import.meta.env.BASE_URL, location.href).href;
  const icons = icon ? [{ src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' }, ...m.icons] : m.icons;
  const out = { ...m, icons, id: new URL(import.meta.env.BASE_URL, location.href).pathname, name: title, short_name: title, start_url: startUrl, scope: base };
  link.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(out));
}
