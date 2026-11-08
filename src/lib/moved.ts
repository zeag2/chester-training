/* PalDex's new home. On the old address only (GitHub Pages), new visitors are sent there and people who already use it
   see a card with the new link. Leave MOVED_TO empty to turn this off. */
export const MOVED_TO = 'https://paldex-4qh.pages.dev/';
/** Where PalDex used to live. Nowhere else (the new site, a dev server, a preview) ever redirects. */
export const OLD_HOSTS = ['zeag2.github.io'];

/** The new address when this copy is running at the old one, or null. */
export function movedTo(host = location.host): string | null {
  if (!MOVED_TO || !OLD_HOSTS.includes(host)) return null;
  try { return new URL(MOVED_TO).host === host ? null : MOVED_TO; } catch { return null; }
}
