/* PalDex's new home. Once set, the old address (GitHub Pages) sends new visitors there, and shows people who already
   use it a card with the new link. Leave empty to turn this off. Example: 'https://paldex.pages.dev/' */
export const MOVED_TO = 'https://paldex-4qh.pages.dev/';

/** The new address when this copy is running somewhere else, or null. */
export function movedTo(): string | null {
  if (!MOVED_TO) return null;
  try { return new URL(MOVED_TO).origin === location.origin ? null : MOVED_TO; } catch { return null; }
}
