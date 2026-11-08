/* The app is named after the kittens: "Chester", or "Chester & Luna". That name goes on the browser tab, on the
   iPhone Home Screen (apple-mobile-web-app-title, read when Add to Home Screen is tapped) and in the install manifest
   (Android). Names typed before installing travel into the installed app in the start URL (?pets=Chester,Luna),
   because an iPhone Home Screen app doesn't share storage with Safari. */

const KEY = 'paldex-pending-pets';
const BASE_TITLE = 'PalDex';

export function titleFor(names: string[]): string {
  const n = names.map((x) => x.trim()).filter(Boolean);
  if (n.length === 0) return BASE_TITLE;
  if (n.length === 1) return n[0];
  return n.slice(0, -1).join(', ') + ' & ' + n[n.length - 1];
}

/** Kitten names typed before setup (on the install page, or carried in from the start URL). */
export function pendingPets(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []; } catch { return []; }
}
export function setPendingPets(names: string[]) {
  try { const n = names.map((x) => x.trim()).filter(Boolean).slice(0, 6); if (n.length) localStorage.setItem(KEY, JSON.stringify(n)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
}
/** Once a pet is set up, take its name off the waiting list. */
export function donePendingPet(name: string) {
  const n = pendingPets(); const i = n.findIndex((x) => x.trim().toLowerCase() === name.trim().toLowerCase());
  setPendingPets(i >= 0 ? [...n.slice(0, i), ...n.slice(i + 1)] : n.slice(1));
}

/** At startup: keep names passed in the start URL, then tidy the URL. */
export function takePendingFromUrl() {
  const q = new URLSearchParams(location.search); const v = q.get('pets');
  if (v == null) return;
  if (!pendingPets().length) setPendingPets(v.split(',').map(decodeURIComponent));
  q.delete('pets'); const rest = q.toString();
  history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
}

let original: Promise<Record<string, any> | null> | null = null;
let applied = '';
/** Put the kittens' names on the tab, the iPhone Home Screen name and the install manifest. */
export function applyAppName(names: string[], carry = false) {
  const title = titleFor(names);
  const clean = names.map((x) => x.trim()).filter(Boolean);
  const key = title + '|' + (carry ? clean.join(',') : '');
  if (key === applied) return; applied = key;
  document.title = title;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'apple-mobile-web-app-title'; document.head.appendChild(meta); }
  meta.content = title;
  const base = new URL(import.meta.env.BASE_URL, location.href);
  const start = carry && clean.length ? `?pets=${clean.map(encodeURIComponent).join(',')}` : '';
  // iPhone fallback: if it uses the page's own address for the icon, the names ride along there too
  const standalone = !!(navigator as any).standalone || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  if (start && !standalone && location.pathname === base.pathname) history.replaceState(history.state, '', base.pathname + start + location.hash);
  void swapManifest(title, new URL(start, base).href, key);
}

async function swapManifest(title: string, startUrl: string, key: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]'); if (!link) return; // dev builds have none
  original ??= (async () => {
    try { const href = new URL(link.getAttribute('href')!, location.href); const m = await (await fetch(href)).json(); m.icons = (m.icons ?? []).map((i: any) => ({ ...i, src: new URL(i.src, href).href })); return m; }
    catch { return null; }
  })();
  const m = await original; if (!m || key !== applied) return;
  const base = new URL(import.meta.env.BASE_URL, location.href).href;
  const out = { ...m, id: new URL(import.meta.env.BASE_URL, location.href).pathname, name: title, short_name: title, start_url: startUrl, scope: base };
  link.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(out));
}
