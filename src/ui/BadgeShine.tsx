import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { buzz } from '../lib/audio';

/** How long the tap shine runs (ms). Must equal --shine-ms in src/styles/tokens.css (a test checks). */
export const SHINE_MS = 520;
/** Reduced motion: the brief brighten instead (ms). Must equal --shine-flash-ms. */
export const SHINE_FLASH_MS = 240;

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A small four-point sparkle in the badge art's style. */
const Spark = ({ cls }: { cls: string }) => <svg className={`spark ${cls}`} viewBox="-7 -7 14 14" aria-hidden="true">
  <path d="M0 -6 C0.8 -2 2 -0.8 6 0 C2 0.8 0.8 2 0 6 C-0.8 2 -2 0.8 -6 0 C-2 -0.8 -0.8 -2 0 -6 Z" /></svg>;

/**
 * A badge picture that can shine when pressed (docs/design-system.md, "Badges"): a glint sweeps across it, clipped
 * to the badge's own shape (the same file is the mask), a small pop and tilt, two sparkles. About half a second; with
 * reduced motion, a brief brighten only. Only earned badges shine: pass `shine={false}` for locked and hidden ones.
 * The press is handled by the parent (BadgeTile's button), which bumps `pulse` to play it again.
 */
export function BadgeShine({ src, size, shine = true, pulse = 0 }: { src: string; size?: number; shine?: boolean; pulse?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const play = useCallback(() => {
    const n = el.current; if (!n || !shine) return;
    n.classList.remove('is-shining'); void n.offsetWidth; n.classList.add('is-shining'); // restart on every tap
    buzz(8);
  }, [shine]);
  useEffect(() => { if (pulse) play(); }, [pulse, play]);
  const style = { ...(size ? { '--badge-size': `${size}px` } : {}), '--badge-mask': `url("${src}")` } as CSSProperties; // default: --badge-tile
  return <span ref={el} className="badgeshine" style={style}>
    <img src={src} alt="" draggable={false} />
    {shine && <><span className="glint" aria-hidden="true" /><Spark cls="a" /><Spark cls="b" /></>}
  </span>;
}
