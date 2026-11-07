import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { chesterSVG, type Mood, type Pose } from './art';
import { pickReaction, REACTIONS, type ReactionId } from './reactions';
import * as audio from '../lib/audio';
import './chester.css';

export interface ChesterProps {
  pose?: Pose; coat?: string; eyes?: string; mood?: Mood; raised?: boolean; anim?: string; width?: number;
  interactive?: boolean; label?: string; onPet?: (line: string, id: ReactionId) => void; react?: ReactionId | null;
}

const IDLES = ['i1', 'i3', 'i4', 'i2', 'i5', 'i3', 'i1'];

export function Chester(p: ChesterProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svg = useMemo(() => chesterSVG({ pose: p.pose, coat: p.coat, eyes: p.eyes, mood: p.mood, raised: p.raised, anim: p.anim, width: p.width, uid, label: p.label }),
    [p.pose, p.coat, p.eyes, p.mood, p.raised, p.anim, p.width, uid, p.label]);
  const ref = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const [fx, setFx] = useState('');
  const [idle, setIdle] = useState('');
  const last = useRef<ReactionId | null>(null);
  const timer = useRef<number>(0);

  const play = (id: ReactionId) => {
    setFx('');
    requestAnimationFrame(() => setFx(id));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFx(''), REACTIONS.find((r) => r.id === id)?.ms ?? 1300);
  };

  // external trigger (e.g. a good rep in a session)
  useEffect(() => { if (p.react) play(p.react); }, [p.react]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const pet = () => {
    const id = pickReaction(last.current); last.current = id;
    const r = REACTIONS.find((x) => x.id === id)!;
    if (r.sound === 'purr') { audio.purr(1 + Math.random() * 0.8); audio.buzz([8, 40, 8, 40, 8]); }
    else if (r.sound === 'sparkle') { audio.sparkle(); audio.buzz([10, 30, 30]); }
    else if (r.sound === 'sneeze') { audio.chirp(false); audio.buzz(20); }
    else { audio.chirp(Math.random() > 0.3); audio.buzz(12); }
    play(id);
    p.onPet?.(r.lines[Math.floor(Math.random() * r.lines.length)], id);
  };

  const cls = `tapme ${fx || idle}`;
  const inner = <>
    <span dangerouslySetInnerHTML={{ __html: svg }} style={{ display: 'block' }} />
    <span className="fxl" aria-hidden="true"><i>&#9829;</i><i>&#9829;</i><i>&#9829;</i></span>
  </>;
  if (!p.interactive) return <div ref={ref as any} className={cls} style={{ display: 'inline-block' }}>{inner}</div>;
  return <button ref={ref as any} type="button" className={cls} onClick={pet} aria-label={`Pet ${p.label ?? 'Chester'}`}>{inner}</button>;
}
