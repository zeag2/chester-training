import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { chesterSVG } from './art';

/* Chester's rainbow dash: tap him lots and he streaks across the screen riding a soft, wavy pastel ribbon.
   Our own take on a "cat with a rainbow trail": no pixel art, no pastry, no borrowed music. */
const STRIPES = ['#ff9aa8', '#ffc38a', '#ffe590', '#a9e6a1', '#94cdf7', '#c4a8f2'];
const W = 640, BAND = 7, WAVE = 80, AMP = 6;

function ribbon(): string {
  let out = '';
  STRIPES.forEach((c, i) => {
    let d = ''; const y0 = 20 + i * BAND;
    for (let x = 0; x <= W + WAVE; x += 8) {
      const y = y0 + Math.sin((x / WAVE) * Math.PI * 2) * AMP;
      d += (x ? ' L' : 'M') + x + ' ' + y.toFixed(1);
    }
    out += `<path d="${d}" stroke="${c}" stroke-width="${BAND + 0.6}" fill="none" stroke-linecap="round"/>`;
  });
  return out;
}

/** Two passes: across, then back the other way (facing the other way), lower down. */
export const PASSES = [{ top: '30%', dir: 1 }, { top: '56%', dir: -1 }] as const;
/** One pass: a quick swoop in, a slow glide across, a quick zip out. The tune lasts both passes. */
export const PASS_MS = 3800;
export const DASH_MS = PASS_MS * PASSES.length;

export function RainbowDash({ coat, eyes, wear, onDone, onPass }: { coat?: string; eyes?: string; wear?: string; onDone: () => void; onPass?: (i: number) => void }) {
  const cat = useMemo(() => chesterSVG({ pose: 'fly', coat, eyes, wear, mood: 'happy', uid: 'dash', width: 130, label: 'Chester dashing on a rainbow' }), [coat, eyes, wear]);
  const [pass, setPass] = useState(0);
  useEffect(() => { onPass?.(pass); }, [pass]); // eslint-disable-line react-hooks/exhaustive-deps
  const p = PASSES[pass];
  const trail = useMemo(ribbon, []);
  const sparkles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (i * 37 + 11) % 100, y: (i * 53 + 7) % 90, d: (i % 5) * 0.18, s: 10 + (i % 3) * 6 })), []);
  return createPortal(<div className="dash" aria-hidden="true" onAnimationEnd={(e) => { if (e.animationName === 'dashfly' || e.animationName === 'dashflyL') { if (pass + 1 < PASSES.length) setPass(pass + 1); else onDone(); } }}>
    {sparkles.map((p, i) => <i key={i} className="dashstar" style={{ left: p.x + '%', top: p.y + '%', fontSize: p.s, animationDelay: p.d + 's' }}>✦</i>)}
    <div key={pass} className={`dashrider${p.dir < 0 ? ' left' : ''}`} style={{ top: p.top, ['--dash-ms' as string]: PASS_MS + 'ms' }}>
      <div className="dashflip" style={{ transform: p.dir < 0 ? 'scaleX(-1)' : undefined }}>
        <svg className="dashtrail" viewBox={`0 0 ${W} 80`} width={W} height={80}><g className="dashwave" dangerouslySetInnerHTML={{ __html: trail }} /></svg>
        <span className="dashcat" dangerouslySetInnerHTML={{ __html: cat }} />
      </div>
    </div>
  </div>, document.body);
}
