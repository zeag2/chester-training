import { useEffect, useRef, useState } from 'react';
import { Chester } from './Chester';
import type { ReactionId } from './reactions';
import * as audio from '../lib/audio';

export interface SceneCat { id: string; name: string; coat?: string; eyes?: string; wear?: string }

/* A yarn ball rolls in and every cat runs after it: they chase it to the right, it gets batted back and they wheel
   round after it, the lead cat pounces, everyone's pleased, the ball rolls away and they trot back to their spots.
   About 6 seconds. Cats start and end where the Home row has them (lead at 0, the others `gap` apart). */
type Phase = 'enter' | 'run' | 'bat' | 'pounce' | 'home';
const AT: [Phase, number][] = [['run', 650], ['bat', 1750], ['pounce', 3050], ['home', 4500]];
const DONE_MS = 6000;

const Yarn = () => <svg viewBox="0 0 40 40" width={30} height={30} aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#ef8f9a" stroke="#232320" strokeWidth="3" />
  <path d="M6 15 C14 19 24 13 34 18 M5 24 C14 21 25 28 35 24 M14 4 C18 14 18 26 24 37" stroke="#c45466" strokeWidth="2.6" fill="none" strokeLinecap="round" /></svg>;

export function Chase({ cats, width, size, gap, onDone }: { cats: SceneCat[]; width: number; size: number; gap: number; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('enter');
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    audio.chirp(true);
    const ts = AT.map(([p, ms]) => window.setTimeout(() => { setPhase(p); if (p === 'bat') audio.chirp(); if (p === 'pounce') audio.purr(0.9); }, ms));
    ts.push(window.setTimeout(() => done.current(), DONE_MS));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, []);
  const n = cats.length;
  const home = (i: number) => i * gap;
  // where the ball is, and where each cat is heading, per phase (px from the row's left)
  const ballX = phase === 'enter' ? width * 0.66 : phase === 'run' ? width * 0.7 : phase === 'bat' ? width * 0.1 : phase === 'pounce' ? width * 0.12 : -60;
  const catX = (i: number) => phase === 'enter' ? home(i)
    : phase === 'run' ? Math.max(0, width * 0.7 - size * 0.9 - i * gap * 0.75)
    : phase === 'bat' || phase === 'pounce' ? width * 0.1 + size * 0.35 + i * gap * 1.15
    : home(i);
  const moving = phase === 'run' || phase === 'bat' || phase === 'home';
  const faceLeft = phase === 'bat' || phase === 'pounce';
  const dur = phase === 'run' ? 0.95 : phase === 'bat' ? 1.2 : phase === 'home' ? 1.35 : 0.4;
  const react = (i: number): ReactionId | null => phase === 'pounce' ? (i === 0 ? 'r14' : 'r8') : null;
  return <div className="chase" style={{ width, height: size * 1.02 }} aria-hidden="true">
    <span className={`chaseball ${phase}`} style={{ transform: `translateX(${ballX}px)`, transitionDuration: phase === 'enter' ? '0.9s' : phase === 'bat' ? '1.1s' : '0.9s' }}><Yarn /></span>
    {cats.map((c, i) => <div key={c.id} className="chasecat" style={{ transform: `translateX(${catX(i)}px)`, transitionDuration: dur + 's', transitionDelay: moving ? i * 0.12 + 's' : '0s', zIndex: n - i }}>
      <div style={{ transform: faceLeft && moving ? 'scaleX(-1)' : undefined }}>
        <Chester coat={c.coat} eyes={c.eyes} wear={c.wear} pose={moving ? 'walk' : 'sit'} mood={phase === 'pounce' || phase === 'home' ? 'happy' : 'curious'}
          width={i === 0 ? size : size * 0.85} label={c.name} react={react(i)} reactKey={phase === 'pounce' ? 1 : 0} /></div>
    </div>)}
  </div>;
}
