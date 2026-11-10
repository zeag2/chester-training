/* Hiding toys: the cardboard box and the crinkle tunnel. Like `play.ts`, a pure, deterministic "brain" (randomness is
   passed in) that the play screen feeds every frame and then draws.

   Units are pixels: `x` from the stage's left edge, `h` height above the floor; `size` is the cat's drawn width.
   The toy is a `Spot` on the floor: its middle, half its width and its height.
   - Box: he hops in and sits; then ducks out of sight (ear tips showing), peeks over the rim, pops up when you tap the
     box, sticks a paw out at a finger beside it, and springs out at a finger that waits there.
   - Tunnel: he zooms in one end and out the other (tap it for another lap), sometimes stops to hide in the middle (a
     bump in the tunnel shows where), peeks out of an end, pokes a paw out at a finger by an end, and bursts out when
     you tap the bump (you found him: Hide and seek) or tap him as he peeks out (Ambush!). */

import type { PlayEvent, Target } from './play';

export type HideToy = 'box' | 'tunnel';
export type HideMode = 'sit' | 'hop' | 'pop' | 'hide' | 'peek' | 'swat' | 'leap' | 'zoom' | 'paw';
export interface Spot { center: number; half: number; height: number }

export interface HideBrain {
  mode: HideMode;
  /** Seconds in this mode, and how long it lasts (for the timed ones). */
  t: number; dur: number;
  /** Where he is (his middle) and which way he faces (1 = right). */
  x: number; face: 1 | -1;
  /** A hop or leap: from where, to where, how high (px above the floor at the top of the arc). */
  from: number; to: number; lift: number;
  clock: number;
  /** Seconds since the last tap (he plays on his own when left alone). */
  idle: number;
  /** Seconds a finger has waited beside the toy while he hides (for the ambush). */
  near: number;
  /** Tunnel: where this run stops to hide (x), or null to go straight through; when the last laps ended. */
  stopAt: number | null; laps: number[];
  /** Whether this leap already caught (or missed). */
  done: boolean;
}

export interface HideInput {
  /** A tap that started this frame. */
  tap?: Target | null;
  /** A finger held down on the stage (where it is now). */
  finger?: Target | null;
}
export interface HideOpts { toy: HideToy; size: number; width: number; spot: Spot; rand?: () => number }

/** How long a hop into the box or a leap out takes (s). */
export const HOP_S = 0.8;
/** How fast he runs through the tunnel (cat widths a second). */
const ZOOM = 4.2;
const ease = (u: number) => u * u * (3 - 2 * u);

/** A new brain: sitting beside the toy, on its left, facing it. */
export function newHide(o: Pick<HideOpts, 'toy' | 'size' | 'spot'>): HideBrain {
  const x = o.spot.center - o.spot.half - o.size * (o.toy === 'box' ? 0.55 : 0.6);
  return { mode: 'sit', t: 0, dur: o.toy === 'box' ? 1.2 : 1.6, x, face: 1, from: x, to: x, lift: 0, clock: 0, idle: 0, near: 0, stopAt: null, laps: [], done: false };
}

/** Where he's drawn mid-hop or mid-leap: x, and height above the floor. */
export function hopOffset(b: HideBrain): { x: number; lift: number } {
  if (b.mode !== 'hop' && b.mode !== 'leap') return { x: b.x, lift: 0 };
  const u = Math.min(1, b.t / HOP_S);
  const a = Math.max(0, Math.min(1, (u - 0.15) / 0.7));
  return { x: b.from + (b.to - b.from) * ease(a), lift: b.lift * Math.sin(Math.PI * a) };
}

/** Is he (mostly) out of sight inside the toy? The screen draws the toy in front of him then. */
export function inside(b: HideBrain, o: Pick<HideOpts, 'toy'>): boolean {
  if (o.toy === 'box') return b.mode === 'pop' || b.mode === 'hide' || b.mode === 'peek' || b.mode === 'swat' || (b.mode === 'hop' && b.t / HOP_S > 0.6);
  // in the tunnel (or half in, at an end) for everything but sitting outside and the second half of a burst out
  return b.mode === 'leap' ? b.t / HOP_S < 0.3 : b.mode !== 'sit';
}

/** Advance him by `dt` seconds. */
export function stepHide(b0: HideBrain, input: HideInput, dt: number, o: HideOpts): { b: HideBrain; events: PlayEvent[] } {
  const rand = o.rand ?? Math.random;
  const S = o.size; const sp = o.spot; const ev: PlayEvent[] = [];
  const b: HideBrain = { ...b0, t: b0.t + dt, clock: b0.clock + dt, idle: input.tap ? 0 : b0.idle + dt };
  const to = (m: HideMode, dur = 0) => { b.mode = m; b.t = 0; b.dur = dur; };
  const clampX = (x: number) => Math.max(S * 0.45, Math.min(o.width - S * 0.45, x));
  const move = (m: string) => ev.push({ kind: 'move', move: m });
  const tap = input.tap ?? null; const finger = input.finger ?? null;
  const onToy = (p: Target | null, pad = 0) => !!p && Math.abs(p.x - sp.center) < sp.half + pad && p.h < sp.height + S * 0.3;
  // a finger beside the toy (not on it), low down
  const beside = (p: Target | null) => !!p && !onToy(p) && Math.abs(p.x - sp.center) < sp.half + S * 1.1 && p.h < sp.height + S * 0.8;

  // hops and leaps play out whatever happens next
  if (b.mode === 'hop' || b.mode === 'leap') {
    const u = b.t / HOP_S; const was = (b.t - dt) / HOP_S;
    if (b.mode === 'leap' && !b.done && was < 0.5 && u >= 0.5) {
      b.done = true;
      const at = hopOffset(b); const paw = { x: b.to + b.face * S * 0.28, h: at.lift * 0.5 };
      // an ambush lands on a finger that's still there; a burst out of the tunnel is a catch whatever happens
      const hit = o.toy === 'tunnel' || (!!finger && Math.abs(finger.x - paw.x) < S * 0.6 && finger.h < S * 1.2);
      ev.push(hit ? { kind: 'catch' } : { kind: 'miss' });
    }
    if (u < 1) return { b, events: ev };
    b.x = b.to; b.lift = 0;
    if (b.mode === 'hop') { to('pop', 1.4); move('fits'); return { b, events: ev }; }
    b.face = b.x < sp.center ? 1 : -1; to('sit', o.toy === 'box' ? 1.8 : 2.5);
    return { b, events: ev };
  }

  if (o.toy === 'box') {
    const nearBox = beside(finger);
    b.near = b.mode === 'hide' && nearBox ? b.near + dt : 0;
    switch (b.mode) {
      case 'sit': // beside the box: hop in after a moment, or on any tap
        if (b.t >= b.dur || tap) { b.face = sp.center >= b.x ? 1 : -1; b.from = b.x; b.to = sp.center; b.lift = sp.height + S * 0.35; to('hop'); ev.push({ kind: 'pounce' }); }
        break;
      case 'pop': // sitting up in the box
        if (b.t >= b.dur) to('hide', 1.6 + rand() * 1.6);
        break;
      case 'hide': // ducked down, ear tips showing
        if (onToy(tap)) { to('pop', 1.2); move('boo'); ev.push({ kind: 'catch' }); break; }
        if (b.near >= 1.0 && finger) {                       // a finger waiting beside the box: AMBUSH
          b.face = finger.x >= sp.center ? 1 : -1; b.from = b.x;
          b.to = clampX(finger.x - b.face * S * 0.28); b.lift = sp.height + S * 0.45; b.done = false;
          to('leap'); ev.push({ kind: 'pounce' }); move('ambush'); break;
        }
        if (b.t >= b.dur) { to('peek', 2 + rand() * 1.5); move('peek'); }
        break;
      case 'peek': // eyes over the rim
        if (onToy(tap)) { to('pop', 1.2); move('boo'); ev.push({ kind: 'catch' }); break; }
        if (nearBox && finger) { b.face = finger.x >= sp.center ? 1 : -1; to('swat', 0.7); ev.push({ kind: 'swat' }, { kind: 'catch' }); move('swat'); break; }
        if (b.t >= b.dur) to('hide', 1.6 + rand() * 1.6);
        break;
      case 'swat': // a paw out over the edge
        if (b.t >= b.dur) {
          if (nearBox && finger) { b.face = finger.x >= sp.center ? 1 : -1; to('swat', 0.6 + rand() * 0.3); ev.push({ kind: 'swat' }); }
          else to('peek', 1.5 + rand());
        }
        break;
      default: to('hide', 1.5);
    }
    return { b, events: ev };
  }

  // the tunnel
  const x0 = sp.center - sp.half, x1 = sp.center + sp.half;
  const outL = x0 - S * 0.6, outR = x1 + S * 0.6;
  const nearEnd = (x: number) => (Math.abs(x - x0) < Math.abs(x - x1) ? -1 : 1);
  const startZoom = (dest: number, stop: boolean) => {
    b.face = dest >= b.x ? 1 : -1; b.from = b.x; b.to = dest;
    b.stopAt = stop ? x0 + sp.half * 2 * (0.3 + rand() * 0.4) : null;
    to('zoom');
  };
  const burst = (side: 1 | -1, m: string) => {
    b.face = side; b.from = b.x; b.to = clampX((side > 0 ? x1 : x0) + side * S * 1.1); b.lift = S * 0.55; b.done = false;
    to('leap'); ev.push({ kind: 'pounce' }); move(m);
  };
  // a tap on the tunnel right where he's hiding (the bump), or by an end where he's peeking out
  const atHim = (p: Target | null) => !!p && Math.abs(p.x - b.x) < S * 0.8 && p.h < sp.height + S * 0.5;
  const byEnd = (p: Target | null): 1 | -1 | 0 => (!p || p.h > sp.height + S * 0.6 ? 0 : p.x < x0 && p.x > x0 - S * 1.3 ? -1 : p.x > x1 && p.x < x1 + S * 1.3 ? 1 : 0);
  switch (b.mode) {
    case 'sit': // outside an end, facing the tunnel: zoom through on a tap, or now and then on his own
      if ((tap && (onToy(tap, S * 0.4) || atHim(tap))) || b.t >= b.dur) startZoom(b.x < sp.center ? outR : outL, rand() < 0.35);
      break;
    case 'zoom': {
      const v = S * ZOOM * dt;
      const was = b.x; b.x = b.face > 0 ? Math.min(b.to, b.x + v) : Math.max(b.to, b.x - v);
      if (b.stopAt != null && (was - b.stopAt) * (b.x - b.stopAt) <= 0) { b.x = b.stopAt; b.stopAt = null; to('hide', 2 + rand() * 1.5); break; }
      if (b.x === b.to) {
        const through = (b.from - sp.center) * (b.x - sp.center) < 0; // came out the other end
        b.face = b.x < sp.center ? 1 : -1; to('sit', 3.5 + rand() * 2);
        if (through) {
          move('zoom');
          b.laps = [...b.laps.filter((c) => b.clock - c < 10), b.clock];
          if (b.laps.length >= 3) { move('laps'); b.laps = []; }
        }
      }
      break;
    }
    case 'hide': { // stopped inside: the tunnel bulges and rustles. Hide and seek is found only by tapping the bump.
      const end = byEnd(tap) || byEnd(finger);
      if (atHim(tap)) { burst(nearEnd(b.x), 'hide'); break; }
      if (end) { b.face = end; b.x = end > 0 ? x1 - S * 0.12 : x0 + S * 0.12; to('paw', 0.9); ev.push({ kind: 'swat' }, { kind: 'catch' }); move('paw'); break; }
      if (b.t >= b.dur) { const side = nearEnd(b.x); b.face = side; b.x = side > 0 ? x1 + S * 0.05 : x0 - S * 0.05; to('peek', 1.6 + rand() * 1.2); move('peek'); }
      break;
    }
    case 'peek': // head out of an end
      if (tap && (atHim(tap) || byEnd(tap) === b.face)) { burst(b.face, 'ambush'); break; }
      if (b.t >= b.dur) startZoom(b.face > 0 ? outR : outL, false); // out he comes
      break;
    case 'paw': // a paw poking out of an end
      if (b.t >= b.dur) {
        if (byEnd(finger) === b.face) { to('paw', 0.6 + rand() * 0.3); ev.push({ kind: 'swat' }); }
        else { b.x = b.face > 0 ? x1 - S * 0.5 : x0 + S * 0.5; to('hide', 1.2 + rand()); }
      }
      break;
    default: to('sit', 1);
  }
  return { b, events: ev };
}
