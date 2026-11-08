/* The Home Screen icon drawn from the person's own cat(s): one cat, or two side by side, on PalDex's mint. Made on a
   canvas as a PNG data URL, used for the iPhone apple-touch-icon and the Android manifest icons. */
import { chesterSVG } from '../chester/art';
import type { PetLook } from './appname';

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
const load = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

const cache = new Map<string, Promise<string | null>>();
/** A square PNG icon (data URL) of the cats, or null where there's no canvas (tests, very old browsers). */
export function drawIcon(pets: PetLook[], size = 512): Promise<string | null> {
  const ps = pets.filter((p) => p.name.trim()).slice(0, 2);
  const key = ps.map((p) => `${p.coat ?? 'black'}/${p.eyes ?? 'gold'}`).join('|') + '@' + size;
  if (!cache.has(key)) cache.set(key, (async () => {
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const g = cv.getContext('2d'); if (!g) return null;
      g.fillStyle = '#e6f3ee'; g.fillRect(0, 0, size, size);
      const one = ps.length < 2;
      const cats = ps.length ? ps : [{ name: 'x', coat: 'black', eyes: 'gold' }];
      const w = one ? size * 0.92 : size * 0.7;
      for (let i = 0; i < cats.length; i++) {
        const img = await load(svgUrl(chesterSVG({ pose: 'sit', coat: cats[i].coat, eyes: cats[i].eyes, mood: 'happy', uid: 'ic' + i, width: w })));
        const x = one ? (size - w) / 2 : i === 0 ? -size * 0.1 : size * 0.38;
        const y = one ? size * 0.02 : size * 0.1;
        g.drawImage(img, x, y, w, w);
      }
      return cv.toDataURL('image/png');
    } catch { return null; }
  })());
  return cache.get(key)!;
}
