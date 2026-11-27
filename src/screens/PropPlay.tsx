import { useEffect, useMemo, useRef, useState } from 'react';
import '../chester/chester.css';
import '../chester/props.css';
import { fillScene, restScene, sceneById } from '../chester/propScenes';
import { useStore } from '../db/store';
import { classify, GESTURE, IDLE_CHAIN, IDLE_MS, pickPropMove, track, type Gesture, type LastMove, type PropMove, type PropToy } from '../engine/props';
import { ITEM_BY_ID } from '../engine/corner';
import * as audio from '../lib/audio';
import { prefersReducedMotion } from '../ui/BadgeShine';
import { PlayShell, usePlayTalk } from './PlayShell';

const HINT: Record<PropToy, string> = {
  donut: 'Tap the donut, hold a finger on him, or just leave him be.',
  post: 'Tap the tower, swipe the pom-pom, or leave him to it.',
  perch: 'Tap the window, hold a finger on the glass, or rub it.',
  kicker: 'Tap the pickle, wiggle it, swipe it or hold it.',
};
/** What he says when a move starts. */
const LINE: Record<string, string> = {
  knead: 'Biscuits!', blink: '*slow blink*', circles: 'Round… and round…', nap: 'Zzz…', yawn: '*yaaawn*',
  stretch: 'Mmmrrrp.', scratch: '*scritch scritch*', pom: 'Got it! Got it!', top: 'King of the tower.', strut: 'Did you see that?',
  birdtv: 'Bird. Bird. BIRD.', chatter: 'Ek ek ek!', paw: 'Let me out there.', loaf: 'So warm…', rain: 'Cozy day.',
  sniff: '*sniff sniff*', kicks: 'Take that, pickle!', roll: 'My pickle.', zoomies: 'ZOOMIES!', bliss: 'Wow. Wow.',
};

/** Playing with one of the props: a stage showing him by it, where a tap, a hold, a swipe, a wiggle or leaving him
    be plays one of its five moves (rules and timings in `src/engine/props.ts`), then he rests again. */
export function PropPlay({ prop }: { prop: PropToy }) {
  const { cat } = useStore();
  const { line, setLine, toast, played, foundMove } = usePlayTalk(prop);
  const [view, setView] = useState({ scene: `${prop}-rest`, n: 0 });
  const last = useRef<LastMove | null>(null);
  const timers = useRef<{ end?: number; idle?: number; hold?: number }>({});
  const idles = useRef(0);
  const taps = useRef<number[]>([]);
  const finger = useRef(track());
  const press = useRef<{ on: boolean; held: boolean }>({ on: false, held: false });
  const reduce = useMemo(prefersReducedMotion, []);

  const clear = (k: 'end' | 'idle' | 'hold') => { window.clearTimeout(timers.current[k]); timers.current[k] = undefined; };
  /** Resting: after IDLE_MS untouched, an idle move (a few in a row at most; one with reduced motion). */
  const rest = () => {
    setView((v) => ({ scene: `${prop}-rest`, n: v.n + 1 }));
    clear('idle');
    if (idles.current >= (reduce ? 1 : IDLE_CHAIN)) return;
    timers.current.idle = window.setTimeout(() => { const m = pickPropMove(prop, 'idle', last.current, Date.now()); if (m) { idles.current++; start(m); } }, IDLE_MS);
  };
  const start = (m: PropMove) => {
    const now = Date.now();
    last.current = { move: m.id, start: now, end: now + m.ms };
    setView((v) => ({ scene: `${prop}-${m.id}`, n: v.n + 1 }));
    setLine(LINE[m.id] ?? '');
    audio.chirp();
    void foundMove(m.id); void played();
    clear('idle'); clear('end');
    timers.current.end = window.setTimeout(rest, m.ms);
  };
  const fire = (g: Gesture) => {
    idles.current = 0;
    const now = Date.now();
    const m = pickPropMove(prop, g, last.current, now) ?? (g === 'taps' ? pickPropMove(prop, 'tap', last.current, now) : null);
    if (m) start(m);
    else if (!last.current || now >= last.current.end) rest(); // a touch that plays nothing still restarts the idle wait
  };

  useEffect(() => { rest(); return () => { clear('end'); clear('idle'); clear('hold'); }; }, [prop]); // eslint-disable-line react-hooks/exhaustive-deps

  const svg = useMemo(() => {
    const s = view.scene.endsWith('-rest') ? restScene(prop) : sceneById(view.scene) ?? restScene(prop);
    return fillScene(s, { coat: cat?.coat, eyes: cat?.eyes, wear: cat?.corner?.wearing, name: cat?.name });
  }, [view, prop, cat?.coat, cat?.eyes, cat?.corner?.wearing, cat?.name]);
  if (!cat) return null;
  const title = ITEM_BY_ID[prop]?.name ?? prop;
  const vb = (sceneById(view.scene) ?? restScene(prop)).vb.split(' ').map(Number);
  // the floor band starts at his floor line (y = 190 in the scene's own units)
  const floorAt = `${(((190 - vb[1]) / vb[3]) * 100).toFixed(1)}%`;

  return <PlayShell toy={prop} title={title} toast={toast} line={line}>
    <div className="playstage propstage" tabIndex={0} role="application" aria-label={`Play area. ${HINT[prop]}`}
      style={{ ['--floor-at' as string]: floorAt }}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        finger.current.down(e.clientX, e.clientY, Date.now()); press.current = { on: true, held: false };
        clear('hold');
        timers.current.hold = window.setTimeout(() => { if (press.current.on) { press.current.held = true; fire('hold'); } }, GESTURE.holdMs);
      }}
      onPointerMove={(e) => { if (!press.current.on) return; finger.current.move(e.clientX, e.clientY); const p = finger.current.up(Date.now()); if (p.dist >= GESTURE.moveSlop) clear('hold'); }}
      onPointerUp={() => {
        clear('hold'); if (!press.current.on) return; press.current.on = false;
        if (press.current.held) return;
        const now = Date.now(), p = finger.current.up(now);
        if (p.dist < GESTURE.moveSlop) taps.current = [...taps.current.filter((t) => now - t <= GESTURE.tapsWindow), now];
        const g = classify({ ...p, quick: taps.current.length });
        if (g === 'taps') taps.current = [];
        if (g) fire(g);
      }}
      onPointerCancel={() => { clear('hold'); press.current.on = false; }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire('tap'); } }}>
      <div key={view.n} className="propscene" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
    <p className="s" style={{ textAlign: 'center', marginTop: 'var(--sp-2)' }}>{HINT[prop]}</p>
  </PlayShell>;
}
