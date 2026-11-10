import { useEffect, useRef, useState } from 'react';
import { Chester } from '../chester/Chester';
import type { Pose } from '../chester/art';
import { useStore } from '../db/store';
import { HOP_S, hopOffset, inside, newHide, stepHide, type HideBrain, type HideMode, type HideOpts, type HideToy, type Spot } from '../engine/hideout';
import type { PlayEvent, Target } from '../engine/play';
import * as audio from '../lib/audio';
import { PlayShell, usePlayTalk } from './PlayShell';

const TITLE: Record<HideToy, string> = { box: 'Cardboard box', tunnel: 'Crinkle tunnel' };
const HINT: Record<HideToy, string> = {
  box: 'Tap the box when he hides. Hold a finger beside it and see what happens.',
  tunnel: 'Tap the tunnel to send him through. When he hides, tap the bump.',
};
const LINES: Partial<Record<HideMode, string[]>> = {
  hide: ['You can’t see me.', 'Shh. I’m not here.', '*rustle rustle*'], peek: ['…', 'I see you.', 'Peekaboo.'],
  zoom: ['ZOOM!', 'Crinkle crinkle!', 'Wheee!'], paw: ['Swat!', 'Mine!'], swat: ['Swat!', 'Paw of doom!'],
};
/** What he says when a move happens (the first time each visit, or by chance after). */
const MOVE_LINE: Record<string, string> = {
  fits: 'If I fits, I sits.', boo: 'BOO!', swat: 'Swat swat!', ambush: 'AMBUSH!', paw: 'Got your finger!', laps: 'Again! Again!', hide: 'You found me!',
};

/** How far down (px, as a share of his width) he sits in the box in each mode: popped up, ducked to the ear tips… */
const SINK: Partial<Record<HideMode, number>> = { pop: -0.25, peek: -0.03, hide: 0.2, swat: 0.02 };

/** The stage's layout: his size, the floor, and where the toy stands. */
function layout(toy: HideToy, w: number, h: number) {
  const S = Math.round(toy === 'box' ? Math.min(140, w * 0.34) : Math.min(120, w * 0.27));
  const floor = h - 34;
  const spot: Spot = toy === 'box'
    ? { center: Math.round(w * 0.58), half: Math.round(S * 0.62), height: Math.round(S * 0.36) }
    : { center: Math.round(w / 2), half: Math.round(Math.min(S * 1.4, w / 2 - S * 0.95)), height: Math.round(S * 0.6) };
  return { S, floor, spot };
}

/** His pose for a mode (`u`: how far through a hop or leap). Side-on poses face the way he's going. */
function poseFor(toy: HideToy, m: HideMode, u: number): Pose {
  if (m === 'hop' || m === 'leap') return u < 0.15 ? 'crouch' : u < 0.85 ? 'leap' : toy === 'box' && m === 'hop' ? 'sit' : 'crouch';
  if (m === 'zoom') return 'run';
  if (m === 'swat') return 'reach';
  if (m === 'hide' || m === 'peek' || m === 'paw') return toy === 'tunnel' ? 'crouch' : 'sit';
  return 'sit';
}
/** Which part of a hop or leap he's in (so React only re-renders when the pose changes). */
const phase = (b: HideBrain) => (b.mode === 'hop' || b.mode === 'leap' ? (b.t / HOP_S < 0.15 ? 0 : b.t / HOP_S < 0.85 ? 1 : 2) : 0);

/** The cardboard box, in stage px: the back (inside wall and flaps, behind him) and the front (in front of him). */
function BoxArt({ spot, floor, part }: { spot: Spot; floor: number; part: 'back' | 'front' }) {
  const L = spot.center - spot.half, R = spot.center + spot.half, rim = floor - spot.height, bot = floor + 6;
  const d = spot.height * 0.34; const i = spot.half * 0.12; const fh = spot.height * 0.7;
  const line = { stroke: '#232320', strokeWidth: 2.5, strokeLinejoin: 'round' as const };
  if (part === 'back') return <g>
    <path d={`M${L + i} ${rim - d} L${L + i + 8} ${rim - d - fh} L${R - i - 8} ${rim - d - fh} L${R - i} ${rim - d} Z`} fill="#cfa671" {...line} />
    <path d={`M${L} ${rim} L${L + i} ${rim - d} L${L + i - spot.half * 0.42} ${rim - d - fh * 0.45} L${L - spot.half * 0.4} ${rim - fh * 0.3} Z`} fill="#d9b382" {...line} />
    <path d={`M${R} ${rim} L${R - i} ${rim - d} L${R - i + spot.half * 0.42} ${rim - d - fh * 0.45} L${R + spot.half * 0.4} ${rim - fh * 0.3} Z`} fill="#d9b382" {...line} />
    <path d={`M${L} ${rim} L${L + i} ${rim - d} L${R - i} ${rim - d} L${R} ${rim} Z`} fill="#8a6038" {...line} />
  </g>;
  return <g>
    <ellipse cx={spot.center} cy={bot - 1} rx={spot.half * 1.12} ry={5} fill="rgba(29,35,64,.12)" />
    <path d={`M${L} ${rim} L${R} ${rim} L${R} ${bot} L${L} ${bot} Z`} fill="#d9b382" {...line} />
    <path d={`M${R - spot.half * 0.22} ${rim + 1.5} L${R - 1.5} ${rim + 1.5} L${R - 1.5} ${bot - 1.5} L${R - spot.half * 0.22} ${bot - 1.5} Z`} fill="#c99d68" />
    <path d={`M${spot.center - spot.half * 0.18} ${rim} L${spot.center + spot.half * 0.18} ${rim} L${spot.center + spot.half * 0.18} ${rim + spot.height * 0.42} L${spot.center - spot.half * 0.18} ${rim + spot.height * 0.42} Z`} fill="#e9d3ae" />
    <path d={`M${L} ${rim} L${R} ${rim} L${R} ${bot} L${L} ${bot} Z`} fill="none" {...line} />
  </g>;
}

/** The crinkle tunnel's outline, with a bump where he is (`at`, `bump` px high). */
function tunnelPaths(spot: Spot, floor: number, at: number | null, bump: number) {
  const x0 = spot.center - spot.half, x1 = spot.center + spot.half, top = floor - spot.height, bot = floor + 3;
  const w = spot.half * 0.32;
  const y = (x: number) => top - (at == null ? 0 : bump * Math.exp(-(((x - at) / w) ** 2)));
  const n = 24; const pts: string[] = [];
  for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; pts.push(`${x.toFixed(1)} ${y(x).toFixed(1)}`); }
  const body = `M${x0} ${bot} L${pts.join(' L')} L${x1} ${bot} Z`;
  const ribs: string[] = []; const nr = Math.max(4, Math.round((x1 - x0) / (spot.height * 0.42)));
  for (let k = 1; k < nr; k++) { const x = x0 + ((x1 - x0) * k) / nr; const t = y(x); ribs.push(`M${x.toFixed(1)} ${t.toFixed(1)} Q${(x + spot.height * 0.14).toFixed(1)} ${((t + bot) / 2).toFixed(1)} ${x.toFixed(1)} ${bot}`); }
  return { body, ribs: ribs.join(' ') };
}

/** The hiding toys: the box (he hops in, hides, peeks, pops up, swats, ambushes) and the tunnel (zooms through, hides,
    peeks, pokes a paw out, bursts out). The brain is `src/engine/hideout.ts`; this draws it. */
export function Hideout({ toy }: { toy: HideToy }) {
  const { cat } = useStore();
  const stage = useRef<HTMLDivElement>(null);
  const catEl = useRef<HTMLDivElement>(null);
  const tiltEl = useRef<HTMLDivElement>(null);
  const tunBody = useRef<SVGPathElement>(null);
  const tunRibs = useRef<SVGPathElement>(null);
  const [size, setSize] = useState({ w: 340, h: 400 });
  const { S, floor, spot } = layout(toy, size.w, size.h);
  const opts: HideOpts = { toy, size: S, width: size.w, spot };
  const brain = useRef<HideBrain>(newHide(opts));
  const [view, setView] = useState({ mode: 'sit' as HideMode, face: 1 as 1 | -1, phase: 0, inside: false });
  const { line, setLine, toast, played, foundMove } = usePlayTalk(toy);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(0);
  // a tap waiting for the next frame, and a finger held down
  const tapRef = useRef<Target | null>(null);
  const finger = useRef<Target | null>(null);
  if (import.meta.env.DEV) (globalThis as { __hideBrain?: unknown }).__hideBrain = brain; // for checks and screenshots

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const fit = () => { const r = el.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }); };
    fit(); const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit); ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // a new layout: start again beside the toy
  useEffect(() => { brain.current = newHide(opts); }, [S, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async (events: PlayEvent[]) => {
    for (const e of events) {
      if (e.kind === 'pounce') { audio.chirp(true); audio.buzz(12); if (toy === 'tunnel') audio.crinkle(0.3); }
      if (e.kind === 'swat') { audio.chirp(false); audio.buzz(8); if (toy === 'tunnel') audio.crinkle(0.15); }
      if (e.kind === 'miss') { setLine('So close!'); if (Math.random() < 0.4) audio.meow('mrrp'); }
      if (e.kind === 'catch') { audio.sparkle(); audio.buzz([10, 40, 20]); setShake((n) => n + 1); await played(); }
      if (e.kind === 'move') { if (MOVE_LINE[e.move]) setLine(MOVE_LINE[e.move]); await foundMove(e.move); }
    }
  };

  // the frame loop: think, then draw (positions go straight to the DOM; React only hears about pose changes)
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const o: HideOpts = { toy, size: S, width: size.w, spot };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const tap = tapRef.current; tapRef.current = null;
      const r = stepHide(brain.current, { tap, finger: finger.current }, dt, o);
      const was = brain.current; const b = r.b; brain.current = b;
      if (b.mode !== was.mode) {
        const l = LINES[b.mode]; if (l && Math.random() < 0.5) setLine(l[Math.floor(Math.random() * l.length)]);
        if (b.mode === 'zoom') audio.crinkle(0.7);
      }
      const v = { mode: b.mode, face: b.face, phase: phase(b), inside: inside(b, o) };
      setView((p) => (p.mode === v.mode && p.face === v.face && p.phase === v.phase && p.inside === v.inside ? p : v));
      if (r.events.length) void handle(r.events);
      const at = hopOffset(b); const u = b.t / HOP_S;
      if (tiltEl.current) tiltEl.current.style.transform = (b.mode === 'hop' || b.mode === 'leap') && u > 0.15 && u < 0.85 ? `rotate(${(-26 * Math.cos(Math.PI * (u - 0.15) / 0.7)).toFixed(1)}deg)` : '';
      if (catEl.current) {
        catEl.current.style.transform = `translate(${(at.x - S / 2).toFixed(1)}px, ${(-at.lift).toFixed(1)}px)`;
        // eyes on your finger, or on the middle of the stage
        const f = finger.current ?? { x: size.w / 2, h: S };
        const dx = f.x - at.x, dy = (at.lift + S * 0.42) - f.h; const d = Math.max(1, Math.hypot(dx, dy));
        catEl.current.style.setProperty('--lx', ((dx / d) * 3.2).toFixed(2) + 'px'); catEl.current.style.setProperty('--ly', ((dy / d) * 2.4).toFixed(2) + 'px');
      }
      if (toy === 'tunnel' && tunBody.current && tunRibs.current) {
        // a bump where he is inside: a big rustling one while he hides, a small one running through
        const amp = b.mode === 'hide' ? spot.height * (0.16 + 0.04 * Math.sin(now / 45)) : b.mode === 'zoom' && Math.abs(b.x - spot.center) < spot.half ? spot.height * 0.1
          : b.mode === 'peek' || b.mode === 'paw' ? spot.height * 0.08 : 0;
        const hx = b.mode === 'peek' || b.mode === 'paw' ? b.x - b.face * spot.half * 0.35 : b.x;
        const p = tunnelPaths(spot, floor, amp ? hx : null, amp);
        tunBody.current.setAttribute('d', p.body); tunRibs.current.setAttribute('d', p.ribs);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [toy, S, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent): Target => {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), h: Math.max(0, floor - (e.clientY - r.top)) };
  };
  if (!cat) return null;
  const { mode, face } = view;
  const pose = poseFor(toy, mode, view.phase === 0 ? 0 : view.phase === 1 ? 0.5 : 0.9);
  const flip = pose !== 'sit' && face < 0;
  // in the box he sinks behind its front; peeking out of the tunnel he's behind it
  const sink = toy === 'box' && view.inside ? (SINK[mode] ?? -0.2) * S : 0;
  const mood = mode === 'pop' || mode === 'sit' ? 'happy' : mode === 'swat' || mode === 'paw' || mode === 'leap' || mode === 'zoom' ? 'open' : 'curious';
  const tun = toy === 'tunnel' ? tunnelPaths(spot, floor, null, 0) : null;
  const x0 = spot.center - spot.half, x1 = spot.center + spot.half, mid = floor - spot.height / 2 + 1.5;
  const ex = spot.height * 0.2, ey = spot.height / 2 + 1.5;

  return <PlayShell toy={toy} title={TITLE[toy]} toast={toast} line={line}>
    <div ref={stage} className="playstage"
      onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); const p = at(e); tapRef.current = p; finger.current = p; if (!touched) setTouched(true); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') finger.current = at(e); }}
      onPointerUp={() => { finger.current = null; }} onPointerCancel={() => { finger.current = null; }}
      role="application" aria-label={`Play area. ${HINT[toy]}`}
      style={{ position: 'relative', height: 'min(440px, 58dvh)', marginTop: 8, borderRadius: 28, overflow: 'hidden', touchAction: 'none', userSelect: 'none', background: 'linear-gradient(var(--sky) 0 calc(100% - 34px), var(--butter) calc(100% - 34px))' }}>
      {!touched && <p className="s" style={{ position: 'absolute', top: 14, left: 16, right: 16, textAlign: 'center', pointerEvents: 'none' }}>{HINT[toy]}</p>}
      {toy === 'box' && <svg aria-hidden="true" width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}><BoxArt spot={spot} floor={floor} part="back" /></svg>}
      {/* he's clipped at the floor, so sinking into the box never shows him below it */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floor + 6, overflow: 'hidden', pointerEvents: 'none', zIndex: view.inside ? 1 : 3 }}>
        <div ref={catEl} style={{ position: 'absolute', left: 0, top: floor - S * 0.957, width: S, willChange: 'transform' }}>
          <div style={{ transform: `translateY(${sink.toFixed(1)}px)`, transition: 'transform .22s cubic-bezier(.3,1.5,.5,1)' }}>
            <div style={{ transform: flip ? 'scaleX(-1)' : undefined }}><div ref={tiltEl} style={{ transformOrigin: '51% 70%' }}>
              <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} width={S} label={cat.name} pose={pose} mood={mood} /></div></div>
          </div>
        </div>
      </div>
      {toy === 'box' && <svg key={shake} className={shake ? 'boxjolt' : undefined} aria-hidden="true" width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 2, transformOrigin: `${spot.center}px ${floor}px` }}><BoxArt spot={spot} floor={floor} part="front" /></svg>}
      {tun && <svg aria-hidden="true" width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 2 }}>
        <ellipse cx={spot.center} cy={floor + 4} rx={spot.half + ex * 1.4} ry={5} fill="rgba(29,35,64,.12)" />
        <path ref={tunBody} d={tun.body} fill="#6c7bd0" stroke="#232320" strokeWidth={2.5} strokeLinejoin="round" />
        <path ref={tunRibs} d={tun.ribs} fill="none" stroke="#4d5bb0" strokeWidth={2.5} strokeLinecap="round" />
        {[x0, x1].map((x) => <g key={x}><ellipse cx={x} cy={mid} rx={ex} ry={ey} fill="#8794dc" stroke="#232320" strokeWidth={2.5} />
          <ellipse cx={x} cy={mid + 1} rx={ex * 0.62} ry={ey * 0.76} fill="#2a2d4a" /></g>)}
      </svg>}
    </div>
  </PlayShell>;
}
