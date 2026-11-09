import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chesterSVG } from './art';
import * as audio from '../lib/audio';

/* Zoomies: he sprints off one side of the screen in a real gallop (the run pose), comes tearing back in from the
   other, leaps into a big tucked backflip in the middle of the screen (the curl pose, spinning once), lands running
   and dashes back to his spot.
   The sitting cat hides meanwhile (`gone` on its wrapper). Timings in ms. */
export const ZOOM_MS = 3100;
const T = { off: 650, back: 850, flip: 1400, land: 2300, end: 3000 };
const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp = (u: number) => Math.max(0, Math.min(1, u));

export function Zoomies({ from, coat, eyes, wear, onDone }: { from: DOMRect; coat?: string; eyes?: string; wear?: string; onDone: () => void }) {
  const W = Math.max(90, from.width * 0.9);
  const run = useMemo(() => chesterSVG({ pose: 'run', coat, eyes, wear, mood: 'curious', uid: 'zrun', width: W, label: 'Zoomies' }), [coat, eyes, wear, W]);
  const curl = useMemo(() => chesterSVG({ pose: 'curl', coat, eyes, wear, uid: 'zcurl', width: W, label: 'Flip' }), [coat, eyes, wear, W]);
  const el = useRef<HTMLDivElement>(null);
  const flip = useRef<HTMLDivElement>(null);
  const [tucked, setTucked] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const home = from.left + from.width / 2;            // his middle, where he sat
    const floor = from.top + from.width * 0.957;        // the sitting cat's feet line
    const top = floor - W * 0.957;
    // the flip happens in the middle of the screen, as high as fits (its top stays 60 px inside the screen)
    const mid = vw / 2;
    const lift = Math.max(W * 0.5, Math.min(W * 1.4, top - 60, vh * 0.45));
    let raf = 0; const t0 = performance.now(); let tuck = false; let sparkled = false;
    audio.chirp(true); audio.buzz([10, 30, 10]);
    const tick = (now: number) => {
      const t = now - t0; let x = home, up = 0, rot = 0, sx = 1, face = 1, big = 1;
      if (t < T.off) x = home + (vw + W - home) * easeIn(t / T.off);                        // off to the right
      else if (t < T.back) x = vw + W * 2;                                                    // gone…
      else if (t < T.flip) x = -W + (mid - W * 0.6 + W) * easeOut((t - T.back) / (T.flip - T.back)); // …back in from the left
      else if (t < T.land) {                                                                  // a big backflip mid-screen
        const u = (t - T.flip) / (T.land - T.flip);
        x = mid - W * 0.6 + W * 1.0 * u; up = lift * Math.sin(Math.PI * u);
        const spin = clamp((u - 0.1) / 0.8); rot = -360 * smooth(spin); big = 1 + 0.25 * Math.sin(Math.PI * spin);
        const want = u > 0.12 && u < 0.88; if (want !== tuck) { tuck = want; setTucked(want); }
        if (!sparkled && u > 0.5) { sparkled = true; audio.sparkle(); }
      } else {                                                                                // land running, back to his spot
        if (tuck) { tuck = false; setTucked(false); }
        const u = clamp((t - T.land) / (T.end - T.land)); const start = mid + W * 0.4;
        face = home < start ? -1 : 1;
        x = start + (home - start) * easeOut(u); sx = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 3));
      }
      const e = el.current;
      if (e) e.style.transform = `translate(${(x - W / 2).toFixed(1)}px, ${(top - up).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${(sx * big).toFixed(3)}, ${((2 - sx) * big).toFixed(3)})`;
      if (flip.current) flip.current.style.transform = face < 0 ? 'scaleX(-1)' : '';
      if (t >= ZOOM_MS) { done.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // spin about the middle of the curled-up ball (100, 122 in pose units)
  const origin = `${((100 + 14) / 232) * W}px ${((122 + 34) / 232) * W}px`;
  return createPortal(<div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 60, overflow: 'hidden' }}>
    <div ref={el} style={{ position: 'absolute', left: 0, top: 0, width: W, transformOrigin: origin, willChange: 'transform', transform: 'translate(-999px,-999px)' }}>
      <div ref={flip}><span style={{ display: tucked ? 'none' : 'block' }} dangerouslySetInnerHTML={{ __html: run }} /></div>
      <span style={{ display: tucked ? 'block' : 'none' }} dangerouslySetInnerHTML={{ __html: curl }} />
    </div>
  </div>, document.body);
}
