import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chesterSVG } from './art';
import * as audio from '../lib/audio';

/* Zoomies: he sprints off one side of the screen in a real gallop (the run pose), comes tearing back in from the
   other, leaps into a tucked backflip (the curl pose, spinning once), lands running and skids to a stop on his spot.
   The sitting cat hides meanwhile (`gone` on its wrapper). Timings in ms. */
export const ZOOM_MS = 2700;
const T = { off: 650, back: 850, flip: 1500, land: 2150, end: 2600 };
const easeIn = (u: number) => u * u;
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp = (u: number) => Math.max(0, Math.min(1, u));

export function Zoomies({ from, coat, eyes, wear, onDone }: { from: DOMRect; coat?: string; eyes?: string; wear?: string; onDone: () => void }) {
  const W = Math.max(90, from.width * 0.9);
  const run = useMemo(() => chesterSVG({ pose: 'run', coat, eyes, wear, mood: 'curious', uid: 'zrun', width: W, label: 'Zoomies' }), [coat, eyes, wear, W]);
  const curl = useMemo(() => chesterSVG({ pose: 'curl', coat, eyes, wear, uid: 'zcurl', width: W, label: 'Flip' }), [coat, eyes, wear, W]);
  const el = useRef<HTMLDivElement>(null);
  const [tucked, setTucked] = useState(false);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const vw = window.innerWidth;
    const home = from.left + from.width / 2;            // his middle, where he sat
    const floor = from.top + from.width * 0.957;        // the sitting cat's feet line
    const top = floor - W * 0.957;
    let raf = 0; const t0 = performance.now(); let tuck = false; let sparkled = false;
    audio.chirp(true); audio.buzz([10, 30, 10]);
    const tick = (now: number) => {
      const t = now - t0; let x = home, lift = 0, rot = 0, sx = 1;
      if (t < T.off) x = home + (vw + W - home) * easeIn(t / T.off);                       // off to the right
      else if (t < T.back) x = vw + W * 2;                                                   // gone…
      else if (t < T.flip) x = -W + (home - W * 0.9 + W) * easeOut((t - T.back) / (T.flip - T.back)); // …and back from the left
      else if (t < T.land) {                                                                 // leap into a backflip
        const u = (t - T.flip) / (T.land - T.flip);
        x = home - W * 0.9 + W * 0.8 * u; lift = W * 0.95 * Math.sin(Math.PI * u); rot = -360 * smooth(clamp((u - 0.08) / 0.84));
        const want = u > 0.1 && u < 0.9; if (want !== tuck) { tuck = want; setTucked(want); }
        if (!sparkled && u > 0.5) { sparkled = true; audio.sparkle(); }
      } else {                                                                               // land running, skid to a stop
        if (tuck) { tuck = false; setTucked(false); }
        const u = clamp((t - T.land) / (T.end - T.land));
        x = home - W * 0.1 + W * 0.1 * easeOut(u); sx = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, u * 2.5)) ;
      }
      const e = el.current;
      if (e) e.style.transform = `translate(${(x - W / 2).toFixed(1)}px, ${(top - lift).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${(2 - sx).toFixed(3)})`;
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
      <span style={{ display: tucked ? 'none' : 'block' }} dangerouslySetInnerHTML={{ __html: run }} />
      <span style={{ display: tucked ? 'block' : 'none' }} dangerouslySetInnerHTML={{ __html: curl }} />
    </div>
  </div>, document.body);
}
