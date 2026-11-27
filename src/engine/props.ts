/* The four props' games (Sprinkle donut, Sisal tower, Sunny window, Catnip pickle): which gesture on the stage plays
   which of the 20 moves, and how long each plays before he goes back to resting by his prop. Pure, so it's tested
   without a screen; `src/screens/PropPlay.tsx` reads gestures and draws the scenes (`src/chester/propScenes.ts`). */

export type PropToy = 'donut' | 'post' | 'perch' | 'kicker';
export const PROP_TOYS: PropToy[] = ['donut', 'post', 'perch', 'kicker'];
export const isPropToy = (t: string | undefined): t is PropToy => (PROP_TOYS as string[]).includes(t ?? '');

/** What a finger did on the stage. `taps` = three taps close together; `wiggle` = a drag back and forth; `flick` =
    one quick swipe; `idle` = nobody touched it for IDLE_MS while he rested. */
export type Gesture = 'tap' | 'taps' | 'hold' | 'wiggle' | 'flick' | 'idle';

export interface PropMove {
  id: string; name: string; hint: string;
  gesture: Gesture;
  /** Only right after this move (while it plays or within AFTER_MS of it ending; for `idle`, when it was the last move). */
  after?: string;
  /** How long it plays (a whole number of the scene's loops in props.css), then he rests. */
  ms: number;
}

/** Gesture timings, in ms. */
export const GESTURE = { holdMs: 600, tapsWindow: 900, flickMs: 350, flickPx: 40, wigglePx: 14, moveSlop: 14 };
/** How long he rests untouched before an idle move; how soon after a move an `after` tap still counts. */
export const IDLE_MS = 6000;
export const AFTER_MS = 3000;
/** An `after` tap only counts once the move it follows has been playing this long (so a quick burst of taps
    doesn't skip straight past it). */
export const AFTER_MIN_MS = 800;
/** Idle moves in a row before he just rests (no endless loop on an untouched screen). */
export const IDLE_CHAIN = 3;

/* Durations are whole loops of each scene's animation in props.css (loop length in the comment). Tuned 2026-11-27
   after playing them in a browser: the short loops play long enough to read, the one-shot scenes play once. */
export const PROP_MOVES: Record<PropToy, PropMove[]> = {
  donut: [
    { id: 'knead', name: 'Biscuit baker', hint: 'Tap the donut.', gesture: 'tap', ms: 4400 }, // 1.1 s × 4
    { id: 'blink', name: 'Slow blink', hint: 'Hold a finger on him for a second.', gesture: 'hold', ms: 7200 }, // 3.6 s × 2
    { id: 'circles', name: 'Round and round', hint: 'Leave him be for a bit.', gesture: 'idle', ms: 6000 }, // 6 s once
    { id: 'nap', name: 'Donut hole', hint: 'After he’s turned round and round, leave him be again.', gesture: 'idle', after: 'circles', ms: 9200 }, // 4.6 s × 2
    { id: 'yawn', name: 'Wake-up yawn', hint: 'Tap him while he naps.', gesture: 'tap', after: 'nap', ms: 4000 }, // 4 s once
  ],
  post: [
    { id: 'stretch', name: 'Big stretch', hint: 'Tap the tower.', gesture: 'tap', ms: 4400 }, // 4.4 s once
    { id: 'scratch', name: 'Scratch scratch', hint: 'Tap the tower three times, quickly.', gesture: 'taps', ms: 3600 }, // .9 s × 4
    { id: 'pom', name: 'Pom-pom bat', hint: 'Flick the pom-pom: a quick swipe.', gesture: 'flick', ms: 3600 }, // 1.8 s × 2
    { id: 'top', name: 'Top of the tower', hint: 'Leave him alone with the tower for a while.', gesture: 'idle', ms: 7000 }, // 7 s once
    { id: 'strut', name: 'Proud strut', hint: 'Tap him right after a scratch.', gesture: 'tap', after: 'scratch', ms: 6000 }, // 6 s once
  ],
  perch: [
    { id: 'birdtv', name: 'Bird TV', hint: 'Tap the window.', gesture: 'tap', ms: 5000 }, // 5 s once
    { id: 'chatter', name: 'Ek-ek-ek', hint: 'Tap again while he watches the bird.', gesture: 'tap', after: 'birdtv', ms: 4800 }, // 2.4 s × 2
    { id: 'paw', name: 'Paw on the glass', hint: 'Hold your finger on the glass.', gesture: 'hold', ms: 6400 }, // 3.2 s × 2
    { id: 'loaf', name: 'Sunbeam loaf', hint: 'Leave him in the sun for a bit.', gesture: 'idle', ms: 10000 }, // 5 s × 2
    { id: 'rain', name: 'Rainy day doze', hint: 'Rub the glass back and forth to bring the rain.', gesture: 'wiggle', ms: 9200 }, // nap 4.6 s × 2
  ],
  kicker: [
    { id: 'sniff', name: 'Sniff test', hint: 'Tap the pickle.', gesture: 'tap', ms: 4000 }, // 4 s once
    { id: 'kicks', name: 'Bunny kicks', hint: 'Wiggle the pickle: drag it back and forth.', gesture: 'wiggle', ms: 2940 }, // .42 s × 7
    { id: 'roll', name: 'Roly-poly', hint: 'Let him keep the pickle: hold a finger on it.', gesture: 'hold', ms: 6000 }, // 3 s × 2
    { id: 'zoomies', name: 'Catnip zoomies', hint: 'Toss the pickle: a quick swipe.', gesture: 'flick', ms: 4800 }, // 2.4 s × 2
    { id: 'bliss', name: 'Blissed out', hint: 'After the zoomies, leave him be.', gesture: 'idle', after: 'zoomies', ms: 8000 }, // 4 s × 2
  ],
};

/** The move playing now (or that played last). `end` is when it stops (in the future while it plays). */
export interface LastMove { move: string; start: number; end: number }

/** Which move a gesture plays, given the last move; null if it plays none (he keeps doing what he's doing). Moves
    that follow another (`after`) win over plain ones for the same gesture. */
export function pickPropMove(prop: PropToy, g: Gesture, last: LastMove | null, now: number): PropMove | null {
  const moves = PROP_MOVES[prop].filter((m) => m.gesture === g);
  const follows = (m: PropMove) => !!last && m.after === last.move && (g === 'idle'
    ? true
    : now - last.start >= AFTER_MIN_MS && now - last.end <= AFTER_MS);
  const after = moves.find((m) => m.after && follows(m));
  if (after) return after;
  const plain = moves.find((m) => !m.after);
  if (!plain || !last || now >= last.end) return plain ?? null;
  // he's in the middle of a move: don't restart the same one, and give a new one a moment to get going
  // (three quick taps still turn a stretch into a scratch)
  if (last.move === plain.id) return null;
  if (g !== 'taps' && now - last.start < AFTER_MIN_MS) return null;
  return plain;
}

/** Sorts one finger's press into a gesture: how long it was down, how far it went, and how often it turned back. */
export function classify(p: { ms: number; dist: number; turns: number; quick: number }): Exclude<Gesture, 'idle'> | null {
  if (p.turns >= 2) return 'wiggle';
  if (p.dist >= GESTURE.flickPx && p.ms <= GESTURE.flickMs) return 'flick';
  if (p.dist < GESTURE.moveSlop && p.ms >= GESTURE.holdMs) return 'hold';
  if (p.dist < GESTURE.moveSlop) return p.quick >= 3 ? 'taps' : 'tap';
  return p.dist >= GESTURE.flickPx * 2 ? 'flick' : null; // a slow, long drag still tosses; a small slow one is nothing
}

/** Tracks one finger: the distance travelled and how often its horizontal direction turned back. */
export function track() {
  let x0 = 0, y0 = 0, lx = 0, dir = 0, run = 0, turns = 0, dist = 0, t0 = 0;
  return {
    down(x: number, y: number, t: number) { x0 = lx = x; y0 = y; dir = 0; run = 0; turns = 0; dist = 0; t0 = t; },
    move(x: number, y: number) {
      dist = Math.max(dist, Math.hypot(x - x0, y - y0));
      const dx = x - lx; if (Math.abs(dx) < 2) return;
      const d = Math.sign(dx);
      if (d === dir) run += Math.abs(dx);
      else { if (dir !== 0 && run >= GESTURE.wigglePx) turns++; dir = d; run = Math.abs(dx); }
      lx = x;
    },
    up(t: number) { return { ms: t - t0, dist, turns }; },
  };
}
