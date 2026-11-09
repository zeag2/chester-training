/* Playing with a toy on screen: the cat's "brain". Pure and deterministic (randomness is passed in), so it can be
   tested without a browser. The play screen feeds it where the toy is every frame and draws what it decides.

   Units are pixels: `x` from the stage's left edge, `h` height above the floor. `size` is the cat's drawn width.
   A real cat watches a fast toy, walks over to a slow one, crouches and wiggles, then pounces; a laser dot up the wall
   gets stared at (and chattered at); a feather dangling low gets swatted, one swishing past overhead gets leapt at. */

export type Toy = 'laser' | 'wand';
export interface Target { x: number; h: number }
export type Mode = 'sit' | 'watch' | 'stare' | 'walk' | 'chase' | 'stalk' | 'pounce' | 'land' | 'swat' | 'happy';

export interface Brain {
  mode: Mode;
  /** Seconds in this mode. */
  t: number;
  /** Where the cat stands (its middle), and which way it faces (1 = right). */
  x: number; face: 1 | -1;
  /** A pounce or leap: from where, to where, and how high (extra lift above a normal hop, px). */
  from: number; to: number; lift: number;
  /** How fast the toy is moving (px/s, smoothed). */
  speed: number;
  prev: Target | null;
  /** How long to crouch before this pounce. */
  stalkFor: number;
  /** Swat timer (a swat every so often while the feather dangles in reach). */
  swatAt: number;
  /** When the last catches happened (seconds since start), for "twice in a row". */
  catches: number[];
  clock: number;
  /** Whether this pounce already caught (or missed) its target. */
  done: boolean;
  /** When the toy last moved (clock seconds), for its speed. */
  movedAt?: number;
  /** Seconds the laser has been dashing about without a break (for the zoomies move). */
  dash?: number;
}

export type PlayEvent = { kind: 'move'; move: string } | { kind: 'catch' } | { kind: 'miss' } | { kind: 'pounce' } | { kind: 'swat' };

/** The moves to discover with each toy, in the order you're likely to find them, with a hint for the next one. */
export const PLAY_MOVES: Record<Toy, { id: string; name: string; hint: string }[]> = {
  laser: [
    { id: 'wiggle', name: 'Butt wiggle', hint: 'Hold the dot still near him.' },
    { id: 'zoomies', name: 'Zoomies', hint: 'Whip the dot back and forth across the floor.' },
    { id: 'pounce', name: 'Big pounce', hint: 'Let him get close, then keep still.' },
    { id: 'catch', name: 'Got it!', hint: 'Keep the dot still while he pounces.' },
    { id: 'chatter', name: 'Wall chatter', hint: 'Hold the dot up high on the wall.' },
    { id: 'double', name: 'Double catch', hint: 'Let him catch it twice in a row.' },
  ],
  wand: [
    { id: 'swat', name: 'Swat swat', hint: 'Dangle the feather low, right by his face.' },
    { id: 'bite', name: 'Gotcha bite', hint: 'Let the feather rest in reach while he swats.' },
    { id: 'leap', name: 'Big leap', hint: 'Swish the feather past, a little above him.' },
    { id: 'aircatch', name: 'Mid-air catch', hint: 'Hold the feather still just above him while he leaps.' },
    { id: 'double', name: 'Double catch', hint: 'Let him catch it twice in a row.' },
  ],
};
/** Each move found the first time: a few treats (once per pet, merged by id like the rest of the corner). */
export const MOVE_REWARD = { treats: 3, bond: 0 };

/** How long a pounce or leap takes (s), and when he's in the air (fractions of it). Matches the rig's hop. */
export const POUNCE_S = 0.95;
const AIR = [0.2, 0.7] as const;
const APEX = 0.45;
const ease = (u: number) => u * u * (3 - 2 * u);

export function newBrain(x: number): Brain {
  return { mode: 'sit', t: 0, x, face: 1, from: x, to: x, lift: 0, speed: 0, prev: null, stalkFor: 0.8, swatAt: 0, catches: [], clock: 0, done: false };
}

/** Where the cat is drawn mid-pounce: its x, and how far above the floor (px) on top of the rig's own hop. */
export function pounceOffset(b: Brain): { x: number; lift: number } {
  if (b.mode !== 'pounce') return { x: b.x, lift: 0 };
  const u = Math.min(1, b.t / POUNCE_S);
  const a = Math.max(0, Math.min(1, (u - AIR[0]) / (AIR[1] - AIR[0])));
  return { x: b.from + (b.to - b.from) * ease(a), lift: b.lift * Math.sin(Math.PI * a) };
}

export interface StepOpts { toy: Toy; size: number; width: number; rand?: () => number }

/** Advance the cat by `dt` seconds, given where the toy is (null: nowhere to be seen). */
export function step(b0: Brain, target: Target | null, dt: number, o: StepOpts): { b: Brain; events: PlayEvent[] } {
  const rand = o.rand ?? Math.random;
  const S = o.size; const ev: PlayEvent[] = [];
  const b: Brain = { ...b0, t: b0.t + dt, clock: b0.clock + dt, catches: b0.catches };
  // toy speed: distance over the time since it last moved (touch moves don't arrive every frame), smoothed so a single
  // jump of the finger doesn't count as a dash; it only fades once the toy has really stopped (0.15 s)
  if (target && b.prev && dt > 0) {
    const moved = Math.hypot(target.x - b.prev.x, target.h - b.prev.h);
    if (moved > 0.5) { const gap = Math.max(dt, b.clock - (b.movedAt ?? b.clock - dt)); b.speed = b.speed * 0.6 + (moved / gap) * 0.4; b.movedAt = b.clock; }
    else if (b.clock - (b.movedAt ?? 0) > 0.15) b.speed *= Math.exp(-dt * 6);
  } else if (!target) b.speed = 0;
  b.prev = target ? { ...target } : null;
  const to = (m: Mode) => { b.mode = m; b.t = 0; };
  const reach = S * 0.95;
  const clampX = (x: number) => Math.max(S * 0.45, Math.min(o.width - S * 0.45, x));
  const caught = () => {
    ev.push({ kind: 'catch' }); if (o.toy === 'laser') ev.push({ kind: 'move', move: 'catch' });
    b.catches = [...b.catches.filter((c) => b.clock - c < 6), b.clock];
    if (b.catches.length >= 2) ev.push({ kind: 'move', move: 'double' });
  };

  // a pounce or leap plays out whatever the toy does next
  if (b.mode === 'pounce') {
    const u = b.t / POUNCE_S; const was = (b.t - dt) / POUNCE_S;
    const at = pounceOffset(b);
    const check = b.lift > 0 ? APEX : AIR[1];
    if (!b.done && was < check && u >= check) {
      b.done = true;
      // a leap reaches up toward where it's heading; a pounce lands on the floor
      const paw = b.lift > 0 ? { x: b.to + b.face * S * 0.28, h: at.lift + S * 0.7 } : { x: at.x + b.face * S * 0.28, h: S * 0.15 };
      const hit = !!target && Math.abs(target.x - paw.x) < S * 0.42 && Math.abs(target.h - paw.h) < S * (b.lift > 0 ? 0.55 : 0.4);
      if (hit) { caught(); if (b.lift > 0) ev.push({ kind: 'move', move: 'aircatch' }); } else ev.push({ kind: 'miss' });
    }
    if (u >= 1) { b.x = b.to; b.lift = 0; to(b.catches[b.catches.length - 1] === undefined || b.clock - b.catches[b.catches.length - 1] > 1 ? 'land' : 'happy'); }
    return { b, events: ev };
  }
  if ((b.mode === 'land' && b.t < 0.45) || (b.mode === 'happy' && b.t < 1.3)) return { b, events: ev };

  if (!target) { if (b.mode !== 'sit') to('sit'); return { b, events: ev }; }
  const dx = target.x - b.x; const dist = Math.abs(dx);
  const facing: 1 | -1 = dx >= 0 ? 1 : -1;

  if (o.toy === 'laser') {
    if (target.h > S * 1.15) {                                   // up the wall: out of reach, so stare (and chatter)
      if (b.mode !== 'stare') to('stare');
      else if (b.t >= 2.5 && b.t - dt < 2.5) ev.push({ kind: 'move', move: 'chatter' });
      return { b, events: ev };
    }
    // the dot is on the move: sprint after it (zoomies), and just watch it, crouched, once he's on top of it;
    // he only stalks and pounces once it's (nearly) still
    const was = b.dash ?? 0; b.dash = b.speed > S * 2 ? was + dt : Math.max(0, was - dt * 0.5); // turnarounds don't reset it
    if (was < 1.5 && b.dash >= 1.5) ev.push({ kind: 'move', move: 'zoomies' });
    if (b.speed > S * 1.5) {
      // run behind it at about its own speed (so it's a sprint, not catch-up-and-stop); a gap between "start running"
      // and "stop and watch" so he doesn't flicker between the two
      if (b.mode === 'chase' ? dist > S * 0.2 : dist > S * 0.5) {
        if (b.mode !== 'chase') to('chase');
        const v = Math.min(S * 5.5, b.speed * 0.75 + dist * 1.5);
        b.face = facing; b.x = clampX(b.x + facing * Math.min(dist - S * 0.15, v * dt));
      } else if (b.mode !== 'watch') to('watch');
      return { b, events: ev };
    }
    if (dist > reach * 1.25 && b.mode !== 'stalk') {             // go over to it: a trot when close, a sprint when far
      const far = dist > S * 2.5;
      if (b.mode !== (far ? 'chase' : 'walk')) to(far ? 'chase' : 'walk');
      b.face = facing; b.x = clampX(b.x + facing * Math.min(dist - reach, S * (far ? 5 : 1.7) * dt));
      return { b, events: ev };
    }
    if (b.mode !== 'stalk') { to('stalk'); b.face = facing; b.stalkFor = 0.6 + rand() * 0.7; return { b, events: ev }; }
    if (b.t >= 0.5 && b.t - dt < 0.5) ev.push({ kind: 'move', move: 'wiggle' });
    if (b.t >= b.stalkFor) {                                     // spring!
      // land with the paw (a little ahead of his middle) on the dot, but no further than a long jump
      b.face = facing; b.from = b.x; b.to = clampX(b.x + facing * Math.max(0, Math.min(dist - S * 0.28, reach * 1.3)));
      b.lift = 0; b.done = false; to('pounce'); ev.push({ kind: 'pounce' }, { kind: 'move', move: 'pounce' });
    }
    return { b, events: ev };
  }

  // the wand: a feather on a string
  b.face = facing;
  if (dist < S * 0.62 && target.h < S * 1.0) {                   // in reach and low: swat at it
    if (b.mode !== 'swat') { to('swat'); b.swatAt = 0; }
    if (b.t >= b.swatAt) { ev.push({ kind: 'swat' }, { kind: 'move', move: 'swat' }); b.swatAt = b.t + 0.45 + rand() * 0.35; }
    if (b.t > 0.9 && b.speed < S * 0.9 && rand() < dt * 1.6) { caught(); ev.push({ kind: 'move', move: 'bite' }); to('happy'); }
    return { b, events: ev };
  }
  if (target.h < S * 2.2 && dist < S * 2.2 && (b.speed > S * 1.5 || target.h >= S * 1.0) && b.mode !== 'walk') {
    // swishing past or hanging just above: leap for it
    b.from = b.x; b.to = clampX(b.x + facing * Math.max(0, Math.min(dist - S * 0.28, S * 1.6))); b.lift = Math.max(S * 0.2, Math.min(S * 1.3, target.h - S * 0.55));
    b.done = false; to('pounce'); ev.push({ kind: 'pounce' }, { kind: 'move', move: 'leap' });
    return { b, events: ev };
  }
  if (target.h < S * 2.2 && dist > S * 0.9) {                    // walk over under it
    if (b.mode !== 'walk') to('walk');
    b.x = clampX(b.x + facing * Math.min(dist - S * 0.5, S * 1.7 * dt));
    if (dist < S * 1.0) to('watch');
    return { b, events: ev };
  }
  if (b.mode !== 'watch') to('watch');
  return { b, events: ev };
}

/** The moves of a toy this pet has found (from its corner log: `move-<toy>-<move>` ids). */
export function movesFound(log: { id: string }[] | undefined, toy: Toy): string[] {
  const p = `move-${toy}-`;
  return PLAY_MOVES[toy].map((m) => m.id).filter((id) => (log ?? []).some((e) => e.id === p + id));
}
