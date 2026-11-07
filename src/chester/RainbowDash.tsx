import { useMemo } from 'react';
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

export function RainbowDash({ coat, eyes, onDone }: { coat?: string; eyes?: string; onDone: () => void }) {
  const cat = useMemo(() => chesterSVG({ pose: 'walk', coat, eyes, mood: 'happy', uid: 'dash', width: 120, label: 'Chester dashing on a rainbow' }), [coat, eyes]);
  const trail = useMemo(ribbon, []);
  const sparkles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: (i * 37 + 11) % 100, y: (i * 53 + 7) % 90, d: (i % 5) * 0.18, s: 10 + (i % 3) * 6 })), []);
  return createPortal(<div className="dash" aria-hidden="true" onAnimationEnd={(e) => { if (e.animationName === 'dashfly') onDone(); }}>
    {sparkles.map((p, i) => <i key={i} className="dashstar" style={{ left: p.x + '%', top: p.y + '%', fontSize: p.s, animationDelay: p.d + 's' }}>✦</i>)}
    <div className="dashrider">
      <svg className="dashtrail" viewBox={`0 0 ${W} 80`} width={W} height={80}><g className="dashwave" dangerouslySetInnerHTML={{ __html: trail }} /></svg>
      <span className="dashcat" dangerouslySetInnerHTML={{ __html: cat }} />
    </div>
  </div>, document.body);
}
