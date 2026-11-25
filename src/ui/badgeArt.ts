/* The badge art files (src/assets/badges, from the approved set on artifact 6e9huJ9Z23diCgKwxCHzds) as URLs, keyed
   like badgeArtKey() in src/engine/badges.ts: "earned/sit", "locked/sit", "hidden/care". Small files are inlined by
   Vite as data URLs, which also work as the shine's mask. */
const files = import.meta.glob('../assets/badges/*/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const BADGE_ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('../assets/badges/', '').replace('.svg', ''), url]),
);

export const badgeArtUrl = (key: string): string | undefined => BADGE_ART[key];
