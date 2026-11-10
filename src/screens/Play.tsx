import { useEffect, useRef, useState } from 'react';
import { Chester } from '../chester/Chester';
import type { ReactionId } from '../chester/reactions';
import { useStore } from '../db/store';
import { newBrain, POUNCE_S, pounceOffset, step, type AnyToy, type Brain, type Mode, type PlayEvent, type Target, type Toy } from '../engine/play';
import * as audio from '../lib/audio';
import { Hideout } from './Hideout';
import { PlayShell, usePlayTalk } from './PlayShell';

const TITLE: Record<Toy, string> = { laser: 'Laser dot', wand: 'Feather wand' };
const HINT: Record<Toy, string> = { laser: 'Drag your finger to move the dot. Keep it still and he’ll pounce.', wand: 'Drag to swish the feather. Dangle it low, or just above him.' };
const LINES: Partial<Record<Mode, string[]>> = {
  stare: ['It’s up there…', '*chatter chatter*', 'Get down here!'], watch: ['Where’s it going?', 'Ooh ooh ooh', '…'], stalk: ['*wiggle wiggle*', 'Don’t. Move.'],
  swat: ['Swat! Swat!', 'Mine!'], walk: ['Coming!', 'I see you…'], chase: ['ZOOMIES!', 'Gotta go fast!', 'Come back here!'],
};
/** Toys with their own game here: the free wand, and the others once bought. */
export const PLAYABLE: AnyToy[] = ['laser', 'wand', 'box', 'tunnel'];

/** Playing with a toy: the box and tunnel are hiding games (`Hideout.tsx`); the laser and wand are chasing games. */
export function Play({ toy: raw }: { toy?: string }) {
  if (raw === 'box' || raw === 'tunnel') return <Hideout toy={raw} />;
  return <ChaseToy toy={raw === 'wand' ? 'wand' : 'laser'} />;
}

/** The chasing toys: drag the laser dot or the feather and he chases, stalks, pounces, swats and leaps on his own. */
function ChaseToy({ toy }: { toy: Toy }) {
  const { cat } = useStore();
  const stage = useRef<HTMLDivElement>(null);
  const catEl = useRef<HTMLDivElement>(null);
  const dotEl = useRef<HTMLDivElement>(null);
  const wandEl = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 340, h: 400 });
  const [mode, setMode] = useState<Mode>('sit');
  const [face, setFace] = useState<1 | -1>(1);
  // mid-jump (the middle of a pounce): drawn in the air pose, tilted along the arc
  const [air, setAir] = useState(false);
  const tiltEl = useRef<HTMLDivElement>(null);
  const [react, setReact] = useState<{ id: ReactionId; n: number } | null>(null);
  const { line, setLine, toast, played, foundMove } = usePlayTalk(toy);
  const [touched, setTouched] = useState(false);

  const S = Math.round(Math.min(140, box.w * 0.34));
  const floor = box.h - 34;
  // where the toy is (pointer for the laser; a lagging feather for the wand), in stage px
  const finger = useRef<{ x: number; y: number } | null>(null);
  const feather = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const brain = useRef<Brain>(newBrain(box.w / 2));
  const airRef = useRef(false);
  if (import.meta.env.DEV) (globalThis as { __playBrain?: unknown }).__playBrain = brain; // for checks and screenshots

  useEffect(() => {
    const el = stage.current; if (!el) return;
    const fit = () => { const r = el.getBoundingClientRect(); setBox({ w: Math.round(r.width), h: Math.round(r.height) }); };
    fit(); const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit); ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => { brain.current = { ...brain.current, x: Math.min(brain.current.x, box.w - S / 2) }; if (toy === 'wand' && !finger.current) { feather.current = { x: box.w * 0.7, y: floor - S * 2.6, vx: 0, vy: 0 }; } }, [box.w, box.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async (events: PlayEvent[]) => {
    for (const e of events) {
      if (e.kind === 'pounce') { audio.chirp(true); audio.buzz(12); }
      if (e.kind === 'swat') { audio.chirp(false); audio.buzz(8); }
      if (e.kind === 'miss') { setLine(toy === 'laser' ? 'Where did it go?!' : 'So close!'); if (Math.random() < 0.4) audio.meow('mrrp'); }
      if (e.kind === 'catch') {
        audio.sparkle(); audio.buzz([10, 40, 20]); setReact({ id: 'r13', n: Date.now() }); setLine(toy === 'laser' ? 'Got it! …I think?' : 'GOT IT. Nom nom.');
        await played();
      }
      if (e.kind === 'move') await foundMove(e.move);
    }
  };

  // the frame loop: move the feather, think, then draw (positions go straight to the DOM; React only hears about mode changes)
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let target: Target | null = null;
      if (toy === 'laser') { const f = finger.current; if (f) target = { x: f.x, h: Math.max(0, floor - f.y) }; }
      else {
        const p = feather.current; const a = finger.current ?? { x: p.x, y: p.y };
        // a feather on a string: it chases the finger with a little lag and overshoot, and sways when left alone
        const ax = (a.x - p.x) * 90 - p.vx * 9, ay = (a.y - p.y) * 90 - p.vy * 9 + (finger.current ? 0 : Math.sin(now / 500) * 40);
        p.vx += ax * dt; p.vy += ay * dt; p.x += p.vx * dt; p.y = Math.min(floor - 6, p.y + p.vy * dt);
        target = { x: p.x, h: Math.max(0, floor - p.y) };
        const svg = wandEl.current;
        if (svg) {
          const top = finger.current ? finger.current.x : p.x;
          svg.querySelector('path')!.setAttribute('d', `M${top} -10 Q${top} ${p.y * 0.55} ${p.x} ${p.y}`);
          svg.querySelector('g')!.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${Math.max(-40, Math.min(40, p.vx * 0.08))})`);
        }
      }
      const r = step(brain.current, target, dt, { toy, size: S, width: box.w });
      const was = brain.current; brain.current = r.b;
      if (r.b.mode !== was.mode) { setMode(r.b.mode); const l = LINES[r.b.mode]; if (l && Math.random() < 0.5) setLine(l[Math.floor(Math.random() * l.length)]); }
      if (r.b.face !== was.face) setFace(r.b.face);
      if (r.events.length) void handle(r.events);
      const at = pounceOffset(r.b);
      // in the air for the middle of a pounce: nose up on the way up, nose down on the way down (laser leaps only)
      const u = r.b.mode === 'pounce' ? r.b.t / POUNCE_S : -1; const flying = u > 0.15 && u < 0.85;
      if (flying !== airRef.current) { airRef.current = flying; setAir(flying); }
      if (tiltEl.current) tiltEl.current.style.transform = flying && toy === 'laser' ? `rotate(${(-26 * Math.cos(Math.PI * Math.min(1, Math.max(0, (u - 0.15) / 0.7)))).toFixed(1)}deg)` : '';
      if (catEl.current) {
        catEl.current.style.transform = `translate(${(at.x - S / 2).toFixed(1)}px, ${(-at.lift).toFixed(1)}px)`;
        // eyes follow the toy
        if (target) {
          const dx = target.x - at.x, dy = (floor - target.h) - (floor - at.lift - S * 0.42); const d = Math.max(1, Math.hypot(dx, dy));
          catEl.current.style.setProperty('--lx', ((dx / d) * 3.2).toFixed(2) + 'px'); catEl.current.style.setProperty('--ly', ((dy / d) * 2.4).toFixed(2) + 'px');
        }
      }
      if (dotEl.current && toy === 'laser') { const f = finger.current; dotEl.current.style.opacity = f ? '1' : '0'; if (f) dotEl.current.style.transform = `translate(${f.x - 9}px, ${f.y - 9}px)`; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [toy, S, box.w, floor]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    finger.current = { x: Math.max(4, Math.min(r.width - 4, e.clientX - r.left)), y: Math.max(4, Math.min(floor - 2, e.clientY - r.top)) };
    if (!touched) setTouched(true);
  };
  if (!cat) return null;
  // what he looks like in each mode: side-on play poses (they face the way he's heading), the sit for the calm moments
  const pose = mode === 'walk' ? 'walk' : mode === 'chase' ? 'run' : mode === 'stalk' || mode === 'land' ? 'crouch'
    : mode === 'pounce' ? (air ? (toy === 'wand' ? 'reach' : 'leap') : 'crouch')
    : mode === 'swat' ? 'reach' : mode === 'watch' ? (toy === 'laser' ? 'crouch' : 'sit') : 'sit';
  const side = pose !== 'sit';

  return <PlayShell toy={toy} title={TITLE[toy]} toast={toast} line={line}>
    <div ref={stage} className="playstage" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); point(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') point(e); }}
      role="application" aria-label={`Play area. ${HINT[toy]}`}
      style={{ position: 'relative', height: 'min(440px, 58dvh)', marginTop: 8, borderRadius: 28, overflow: 'hidden', touchAction: 'none', userSelect: 'none', background: 'linear-gradient(var(--sky) 0 calc(100% - 34px), var(--butter) calc(100% - 34px))' }}>
      {!touched && <p className="s" style={{ position: 'absolute', top: 14, left: 16, right: 16, textAlign: 'center', pointerEvents: 'none' }}>{HINT[toy]}</p>}
      <div ref={catEl} style={{ position: 'absolute', left: 0, top: floor - S * 0.957, width: S, pointerEvents: 'none', willChange: 'transform' }}>
        <div style={{ transform: side && face < 0 ? 'scaleX(-1)' : undefined }}><div ref={tiltEl} style={{ transformOrigin: '51% 70%' }}>
          <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} width={S} label={cat.name} pose={pose}
            mood={mode === 'happy' ? 'happy' : air || mode === 'swat' ? 'open' : 'curious'}
            react={react?.id ?? null} reactKey={react?.n} /></div></div>
      </div>
      {toy === 'laser' && <div ref={dotEl} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 18, height: 18, borderRadius: 9, background: '#ff3b3b', boxShadow: '0 0 10px 4px rgba(255,59,59,.55)', opacity: 0, pointerEvents: 'none' }} />}
      {toy === 'wand' && <svg ref={wandEl} aria-hidden="true" width={box.w} height={box.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <path d="" fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeOpacity={0.6} />
        <g><path d="M0 0 C-10 8 -12 26 -4 40 C2 30 8 18 0 0 Z" fill="#ef8f9a" stroke="#232320" strokeWidth={2} /><path d="M0 2 C-3 14 -4 26 -4 38" stroke="#c45466" strokeWidth={1.5} fill="none" />
          <path d="M2 2 C10 10 12 24 6 34 C2 26 0 14 2 2 Z" fill="#9fc0ea" stroke="#232320" strokeWidth={2} /></g>
      </svg>}
    </div>
  </PlayShell>;
}
