import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { chesterSVG, type Mood, type Pose } from './art';
import { pickReaction, REACTIONS, SESSION_REACTIONS, type ReactionId } from './reactions';
import * as audio from '../lib/audio';
import { leanFor } from './spring';
import { Rig } from './rig';
import { RainbowDash } from './RainbowDash';
import './chester.css';

export interface ChesterProps {
  pose?: Pose; coat?: string; eyes?: string; mood?: Mood; raised?: boolean; anim?: string; width?: number; extra?: string;
  interactive?: boolean; label?: string; onPet?: (line: string, id: ReactionId) => void; react?: ReactionId | null; reactKey?: number;
}

const IDLES = ['i1', 'i3', 'i4', 'i2', 'i5', 'i3', 'i1'];
/** Reactions the rig performs as full moves (wind-up, stretch, tucked legs, squash) instead of CSS. */
const RIG_MOVES: Partial<Record<ReactionId, 'hop' | 'pounce'>> = { r1: 'hop', r6: 'hop', r11: 'hop', r14: 'pounce' };
/** Which jolt the rig gives ears and tail for each reaction, and when (ms) it lands. */
const KICKS: Partial<Record<ReactionId, ['hop' | 'bonk' | 'shake' | 'spin' | 'flick', number]>> = {
  r1: ['hop', 520], r6: ['hop', 520], r11: ['hop', 480], r8: ['bonk', 380], r10: ['shake', 300], r2: ['spin', 0], r4: ['shake', 120], r5: ['flick', 0], r9: ['flick', 200], r13: ['flick', 300], r14: ['hop', 400],
};

export function Chester(p: ChesterProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svg = useMemo(() => chesterSVG({ pose: p.pose, coat: p.coat, eyes: p.eyes, mood: p.mood, raised: p.raised, anim: p.anim, width: p.width, uid, label: p.label, extra: p.extra }),
    [p.pose, p.coat, p.eyes, p.mood, p.raised, p.anim, p.width, uid, p.label, p.extra]);
  const ref = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const [fx, setFx] = useState('');
  const [idle, setIdle] = useState('');
  const last = useRef<ReactionId | null>(null);
  const timer = useRef<number>(0);

  const play = (id: ReactionId) => {
    const move = RIG_MOVES[id];
    if (move && rig.current) rig.current.play(move);
    else { const k = KICKS[id]; if (k) rig.current?.kick(k[0], k[1]); }
    setFx('');
    requestAnimationFrame(() => setFx(id));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFx(''), REACTIONS.find((r) => r.id === id)?.ms ?? SESSION_REACTIONS[id] ?? 1300);
  };

  // external trigger (e.g. a good rep in a session)
  useEffect(() => { if (p.react) play(p.react); }, [p.react, p.reactKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!p.interactive) return;
    const el = ref.current; if (!el) return;
    let lt = 0, it = 0, k = 0;
    const down = (e: PointerEvent) => {
      const b = el.getBoundingClientRect(); const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height * 0.42);
      const d = Math.max(1, Math.hypot(dx, dy));
      el.style.setProperty('--lx', ((dx / d) * 3.2).toFixed(2) + 'px'); el.style.setProperty('--ly', ((dy / d) * 2.4).toFixed(2) + 'px');
      window.clearTimeout(lt); lt = window.setTimeout(() => { el.style.setProperty('--lx', '0px'); el.style.setProperty('--ly', '0px'); }, 2200);
      const t = e.target as HTMLElement;
      if (!el.contains(t) && t.closest?.('a,button')) { setIdle('notice'); window.clearTimeout(it); it = window.setTimeout(() => setIdle(''), 520); }
    };
    document.addEventListener('pointerdown', down, { passive: true });
    const iv = window.setInterval(() => { if (document.hidden) return; setIdle(IDLES[k++ % IDLES.length]); window.clearTimeout(it); it = window.setTimeout(() => setIdle(''), 1900); }, 5200);
    return () => { document.removeEventListener('pointerdown', down); window.clearInterval(iv); window.clearTimeout(lt); window.clearTimeout(it); };
  }, [p.interactive]);

  // the rig: springs that give the sitting pose follow-through (lean, head lag, ears, tail chain)
  const body = useRef<HTMLSpanElement>(null);
  const rig = useRef<Rig | null>(null);
  useEffect(() => {
    const el = body.current?.querySelector('svg'); if (!el || !el.querySelector('.rtail, .r-all')) return;
    const r = new Rig(el); rig.current = r;
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([e]) => { r.visible = e.isIntersecting; });
    io?.observe(el);
    return () => { r.stop(); io?.disconnect(); rig.current = null; };
  }, [svg]);

  // stroke to pet: drag sideways across him and he leans into your finger, then settles back with follow-through
  const drag = useRef({ on: false, x0: 0, y0: 0, moved: false, purrAt: 0 });
  const [stroking, setStroking] = useState(false);
  const onDown = (e: React.PointerEvent) => { drag.current = { on: true, x0: e.clientX, y0: e.clientY, moved: false, purrAt: 0 }; };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d.on) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved) { if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return; d.moved = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setStroking(true); p.onPet?.(['Prrrr... more', 'Ooh yes, pets', 'Right there...'][Math.floor(Math.random() * 3)], 'r3'); }
    if (rig.current) rig.current.stroke = leanFor(dx);
    const now = performance.now(); if (now > d.purrAt) { audio.purr(1.9); audio.buzz([6, 40, 6]); d.purrAt = now + 1700; }
  };
  const onUp = () => { const d = drag.current; if (!d.on) return; d.on = false; if (rig.current) rig.current.stroke = null; if (d.moved) setStroking(false); };

  // tap him lots (8 taps in 3 s) and he does a rainbow dash, at most once every 10 s
  const taps = useRef<number[]>([]);
  const dashAt = useRef(-Infinity);
  const [dash, setDash] = useState(false);
  const pet = () => {
    if (drag.current.moved) { drag.current.moved = false; return; }
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 8 && now - dashAt.current > 10_000 && !dash) {
      taps.current = []; dashAt.current = now; setDash(true);
      audio.jingle(); audio.buzz([20, 60, 20, 60, 40]);
      window.setTimeout(() => setDash(false), 3600);
      p.onPet?.('WHEEEE! Rainbow dash!', 'r5');
      return;
    }
    const id = pickReaction(last.current, Math.random, (p.pose ?? 'sit') === 'sit'); last.current = id;
    const r = REACTIONS.find((x) => x.id === id)!;
    if (r.sound === 'purr') { audio.purr(id === 'r12' ? 3.4 : 1 + Math.random() * 0.8); audio.buzz([8, 40, 8, 40, 8]); }
    else if (r.sound === 'sparkle') { audio.sparkle(); audio.buzz([10, 30, 30]); }
    else if (r.sound === 'sneeze') { audio.chirp(false); audio.buzz(20); }
    else if (r.sound === 'meow') { audio.meow((['mew', 'meow', 'mrrp'] as const)[Math.floor(Math.random() * 3)]); audio.buzz(10); }
    else { audio.chirp(Math.random() > 0.3); audio.buzz(12); }
    play(id);
    p.onPet?.(r.lines[Math.floor(Math.random() * r.lines.length)], id);
  };

  const cls = `tapme ${stroking ? 'stroking' : fx || idle}${dash ? ' gone' : ''}`;
  const inner = <>
    <span ref={body} className="strokebody" dangerouslySetInnerHTML={{ __html: svg }} style={{ display: 'block' }} />
    <span className="fxl" aria-hidden="true"><i>&#9829;</i><i>&#9829;</i><i>&#9829;</i></span>
    {dash && <RainbowDash coat={p.coat} eyes={p.eyes} onDone={() => setDash(false)} />}
  </>;
  if (!p.interactive) return <div ref={ref as any} className={cls} style={{ display: 'inline-block' }}>{inner}</div>;
  return <button ref={ref as any} type="button" className={cls} onClick={pet} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label={`Pet ${p.label ?? 'Chester'}`}>{inner}</button>;
}
