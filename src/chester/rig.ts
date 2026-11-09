/* Chester's physics rig: parts driven by damped springs each frame, so motion has follow-through.
   The body leans from the hips (feet stay planted), the head follows a beat later, and the ears and the
   tail chain lag behind and settle. CSS keyframes still play inside these wrappers, so the two add up. */
import { stepSpring, type Spring } from './spring';

type Cfg = { tension: number; friction: number };
const BODY: Cfg = { tension: 180, friction: 16 };
const HEAD: Cfg = { tension: 120, friction: 11 };
const EAR: Cfg = { tension: 210, friction: 9 };
const TAIL = (i: number): Cfg => ({ tension: 150 - i * 12, friction: 9 - i * 0.4 });

/** Rest shape of the sitting tail, from the base at the hip to the tip. */
export const SIT_TAIL: [number, number][][] = [
  [[132, 176], [160, 180], [178, 162], [176, 134]],
  [[176, 134], [175, 120], [178, 108], [186, 106]],
];
const N = 9; // joints along the tail

function cubic(p: [number, number][], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]];
}

/** Evenly spaced joints along the rest curves → segment lengths and each segment's bend from the one before. */
export function tailRest(curves = SIT_TAIL, n = N): { base: [number, number]; lens: number[]; angle0: number; bends: number[] } {
  const dense: [number, number][] = [];
  curves.forEach((c, k) => { for (let i = k ? 1 : 0; i <= 60; i++) dense.push(cubic(c, i / 60)); });
  const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1];
  const pts: [number, number][] = [];
  for (let j = 0, i = 0; j < n; j++) { const s = (total * j) / (n - 1); while (i < cum.length - 2 && cum[i + 1] < s) i++; pts.push(dense[i]); }
  pts[n - 1] = dense[dense.length - 1];
  const ang = pts.slice(1).map((p, i) => Math.atan2(p[1] - pts[i][1], p[0] - pts[i][0]));
  return { base: pts[0], lens: pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), angle0: ang[0], bends: ang.map((a, i) => (i ? a - ang[i - 1] : 0)) };
}

/** Joint positions for a tail bent by extra angles (radians) per segment. */
export function tailPoints(rest: ReturnType<typeof tailRest>, extra: number[]): [number, number][] {
  const pts: [number, number][] = [rest.base]; let a = rest.angle0;
  rest.lens.forEach((len, i) => { a += (i ? rest.bends[i] : 0) + (extra[i] ?? 0); const p = pts[i]; pts.push([p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len]); });
  return pts;
}

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
export function smoothPath(p: [number, number][]): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], e = p[Math.min(p.length - 1, i + 2)];
    d += ` C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}

type Curves = [number, number][][];
/** Two "M x y C x y x y x y" strings (base half, tip half) → control points for tailRest. */
export function curvesOf(d1: string, d2: string): Curves {
  return [d1, d2].map((d) => { const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number); return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]] as [number, number][]; });
}
export const restTailPath = (curves?: Curves) => smoothPath(tailPoints(tailRest(curves), []));

const sp = (): Spring => ({ x: 0, v: 0 });

/** One pose on a move's timeline (t = 0..1). Missing channels hold the previous value. */
interface Key { t: number; x?: number; y?: number; sx?: number; sy?: number; lean?: number; head?: number; hy?: number; legL?: number; legR?: number }
type Chan = Exclude<keyof Key, 't'>;
const CHANS: Chan[] = ['x', 'y', 'sx', 'sy', 'lean', 'head', 'hy', 'legL', 'legR'];
const REST: Record<Chan, number> = { x: 0, y: 0, sx: 1, sy: 1, lean: 0, head: 0, hy: 0, legL: 0, legR: 0 };
const tuck = (v: number) => ({ legL: v, legR: v });

/** Hop, pounce and dance as real stages: wind-up, stretch, tucked legs in the air, squash on landing. Springs add the overshoot. */
export const MOVES: Record<string, { ms: number; loop?: boolean; keys: Key[] }> = {
  hop: { ms: 950, keys: [
    { t: 0 },
    { t: 0.13, y: 3, sx: 1.1, sy: 0.85, head: 3, hy: 4 },                    // crouch
    { t: 0.27, y: -26, sx: 0.92, sy: 1.13, head: -4, hy: -1, ...tuck(0) },   // launch: stretch
    { t: 0.45, y: -36, sx: 1, sy: 1, ...tuck(0.75) },                        // apex: legs tucked
    { t: 0.6, y: -18, sx: 0.96, sy: 1.05, ...tuck(0.4) },
    { t: 0.7, y: 0, ...tuck(0) },                                            // touch down
    { t: 0.78, y: 2, sx: 1.13, sy: 0.83, head: 5, hy: 5 },                   // squash
    { t: 0.9, y: 0, sx: 0.98, sy: 1.03, head: -1, hy: 0 },
    { t: 1, ...REST },
  ] },
  pounce: { ms: 1700, keys: [
    { t: 0 },
    { t: 0.1, y: 6, sx: 1.1, sy: 0.82, head: 5, hy: 6 },                     // low stalk
    { t: 0.18, lean: 3 }, { t: 0.24, lean: -3 }, { t: 0.3, lean: 3 }, { t: 0.36, lean: -3 }, { t: 0.42, lean: 0 }, // butt wiggle
    { t: 0.5, y: 7, sx: 1.12, sy: 0.8 },                                     // hold…
    { t: 0.58, x: 22, y: -24, sx: 0.9, sy: 1.16, lean: -9, head: -6, hy: -2, ...tuck(0) }, // spring!
    { t: 0.67, x: 40, y: -14, sx: 1, sy: 1, lean: -4, ...tuck(0.6) },
    { t: 0.74, x: 46, y: 2, sx: 1.15, sy: 0.82, lean: 2, head: 6, hy: 5, ...tuck(0) }, // land on the target
    { t: 0.82, x: 46, y: 0, sx: 0.98, sy: 1.03, head: 0, hy: 0, lean: 0 },
    { t: 1, ...REST },                                                        // pad back to his spot
  ] },
  // yarn batting, on the same 3 s beat as the paw's burst of swats and the ball's nudge: lean in, swat, settle, watch
  bat: { ms: 3000, loop: true, keys: [
    { t: 0, head: 5, hy: 1 },
    { t: 0.03, lean: 1, sy: 0.97, sx: 1.02 },
    { t: 0.06, lean: 5, head: 9, hy: 2, sy: 1.02, sx: 0.99 },
    { t: 0.12, lean: 2, head: 6 },
    { t: 0.18, lean: 5, head: 9, sy: 1.02 },
    { t: 0.28, lean: 0, head: 4, hy: 1, sy: 1, sx: 1 },
    { t: 0.5, head: -2, hy: 0 },
    { t: 0.75, head: 4 },
    { t: 1, head: 5, hy: 1 },
  ] },
  // crouched low, eyes on the prize, back end wiggling (loops until the pounce)
  stalk: { ms: 700, loop: true, keys: [
    { t: 0, y: 6, sx: 1.1, sy: 0.82, head: 5, hy: 6, lean: 0 },
    { t: 0.25, lean: 3 }, { t: 0.5, lean: -3 }, { t: 0.75, lean: 3 },
    { t: 1, y: 6, sx: 1.1, sy: 0.82, head: 5, hy: 6, lean: 0 },
  ] },
  dance: { ms: 1100, loop: true, keys: [
    { t: 0, lean: -6, head: 7, y: 0, sx: 1.06, sy: 0.92, legL: 0, legR: 0.5 },
    { t: 0.25, lean: 0, head: 0, y: -9, sx: 0.97, sy: 1.05, legL: 0, legR: 0 },
    { t: 0.5, lean: 6, head: -7, y: 0, sx: 1.06, sy: 0.92, legL: 0.5, legR: 0 },
    { t: 0.75, lean: 0, head: 0, y: -9, sx: 0.97, sy: 1.05, legL: 0, legR: 0 },
    { t: 1, lean: -6, head: 7, y: 0, sx: 1.06, sy: 0.92, legL: 0, legR: 0.5 },
  ] },
};

const ease = (u: number) => u * u * (3 - 2 * u);
/** Value of every channel at time t (0..1): each channel eases between the keys that set it. */
export function sampleMove(keys: Key[], t: number): Record<Chan, number> {
  const out = { ...REST };
  for (const c of CHANS) {
    let a: Key | null = null, b: Key | null = null;
    for (const k of keys) { if (k[c] === undefined && k.t !== 0 && k.t !== 1) continue; if (k.t <= t) a = k; else { b = k; break; } }
    const va = a?.[c] ?? REST[c], vb = b?.[c] ?? (b ? REST[c] : va);
    out[c] = !a ? va : !b ? va : va + (vb - va) * ease((t - a.t) / Math.max(1e-6, b.t - a.t));
  }
  return out;
}
const DEG = Math.PI / 180;

export class Rig {
  private all: SVGGElement | null; private head: SVGGElement | null;
  private earL: SVGGElement | null; private earR: SVGGElement | null;
  private tailO: SVGPathElement | null; private tailF: SVGPathElement | null;
  private rest = tailRest();
  /** How lively the tail is in this pose (a curled-up nap barely moves it). */
  private amp = 1;
  /** Lying, loafing or kneading: he breathes and nuzzles but doesn't lean from the hips. */
  private lying = false;
  private s = { lean: sp(), sq: sp(), head: sp(), hx: sp(), earL: sp(), earR: sp(), tail: Array.from({ length: N - 1 }, sp),
    mx: sp(), my: sp(), msx: { x: 1, v: 0 }, msy: { x: 1, v: 0 }, mlean: sp(), mhead: sp(), mhy: sp(), legL: sp(), legR: sp() };
  private move: { name: string; t0: number } | null = null;
  private legs: { L: SVGGElement | null; R: SVGGElement | null } = { L: null, R: null };
  private shadow: SVGGElement | null = null;
  private svg: SVGSVGElement | null = null;
  private raf = 0; private last = 0; private t0 = performance.now(); private flickAt = 0; private flick = 0;
  /** Finger lean, -1..1, while stroking; null otherwise. */
  stroke: number | null = null;
  visible = true;

  constructor(svg: SVGSVGElement) {
    const q = <T extends Element>(c: string) => svg.querySelector<T>(c);
    this.all = q('.r-all'); this.head = q('.r-head'); this.earL = q('.r-earL'); this.earR = q('.r-earR');
    this.tailO = q('.rt-o'); this.tailF = q('.rt-f');
    const tg = q<SVGGElement>('.rtail');
    if (tg?.dataset.tail) this.rest = tailRest(JSON.parse(tg.dataset.tail));
    this.amp = Number(tg?.dataset.amp ?? 1) || 1;
    this.lying = !svg.classList.contains('pose-sit');
    this.legs = { L: q('.r-legL'), R: q('.r-legR') }; this.shadow = q('.r-shadow');
    svg.classList.add('rigged');
    if (svg.classList.contains('dance') && !this.lying) this.play('dance');
    if (svg.classList.contains('bat') && !this.lying) this.play('bat');
    this.svg = svg;
    this.flickAt = this.t0 + 2500 + Math.random() * 4000;
    this.start();
  }

  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  /** Play a keyframed move (hop, pounce, dance). Dance loops until another move or stop(). */
  play(name: keyof typeof MOVES) { if (MOVES[name] && !this.lying) this.move = { name, t0: performance.now() }; }
  /** Stop a move (a looping one like dance or stalk); the springs settle him back. */
  halt() { this.move = null; }

  /** A jolt for the secondary parts: ears and tail react to a hop, bonk or sneeze. */
  kick(kind: 'hop' | 'bonk' | 'shake' | 'spin' | 'flick', delayMs = 0) {
    const go = () => {
      const s = this.s;
      if (kind === 'hop') { s.earL.v -= 260; s.earR.v += 260; s.tail.forEach((t, i) => (t.v += (i + 1) * 30)); s.sq.v -= 3; }
      if (kind === 'bonk') { s.head.v += 160; s.earL.v -= 200; s.earR.v -= 120; s.tail[0].v -= 60; }
      if (kind === 'shake') { s.earL.v += 400; s.earR.v -= 400; s.head.v -= 120; }
      if (kind === 'spin') s.tail.forEach((t, i) => (t.v -= (i + 2) * 40));
      if (kind === 'flick') s.tail.forEach((t, i) => (t.v += i * 25));
    };
    if (delayMs) window.setTimeout(go, delayMs); else go();
  }

  private tick = (now: number) => {
    this.raf = 0;
    const dt = Math.min(48, now - this.last); this.last = now;
    if (!this.visible || document.hidden) { this.raf = requestAnimationFrame(this.tick); return; }
    const t = (now - this.t0) / 1000; const s = this.s;
    let m = sampleMove([{ t: 0 }, { t: 1 }], 0);
    if (this.move) {
      // a paused training session freezes the move where it is, like the CSS paw
      if (this.svg?.closest('.paused')) this.move.t0 += dt;
      const def = MOVES[this.move.name]; let u = (now - this.move.t0) / def.ms;
      if (u >= 1) { if (def.loop) { u %= 1; } else { this.move = null; u = 1; } }
      m = sampleMove(def.keys, Math.min(1, u));
    }
    const STIFF = { tension: 700, friction: 30 }, LAG = { tension: 260, friction: 15 };
    const prevY = s.my.x;
    s.mx = stepSpring(s.mx, m.x, dt, STIFF); s.my = stepSpring(s.my, m.y, dt, STIFF);
    s.msx = stepSpring(s.msx, m.sx, dt, STIFF); s.msy = stepSpring(s.msy, m.sy, dt, STIFF);
    s.mlean = stepSpring(s.mlean, m.lean, dt, STIFF);
    s.mhead = stepSpring(s.mhead, m.head, dt, LAG); s.mhy = stepSpring(s.mhy, m.hy, dt, LAG);
    s.legL = stepSpring(s.legL, m.legL, dt, STIFF); s.legR = stepSpring(s.legR, m.legR, dt, STIFF);
    const yVel = (s.my.x - prevY) / Math.max(1, dt);
    const petting = this.stroke !== null; const lean = this.stroke ?? 0;

    // body leans from the hips toward the finger; head goes further and tilts into the hand
    const prevLean = s.lean.x;
    s.lean = stepSpring(s.lean, this.lying ? 0 : lean * 7, dt, BODY);
    const leanVel = (s.lean.x - prevLean) / Math.max(1, dt);
    s.sq = stepSpring(s.sq, petting ? 1.2 : 0, dt, BODY);
    const prevHead = s.head.x;
    s.head = stepSpring(s.head, petting ? lean * 8 + Math.sin(t * 2.1) * 1.5 : 0, dt, HEAD);
    const headVel = (s.head.x - prevHead) / Math.max(1, dt);
    s.hx = stepSpring(s.hx, lean * 4, dt, HEAD);

    // ears: relax back while petted, and lag behind the head's turns
    s.earL = stepSpring(s.earL, (petting ? -9 : 0) - headVel * 260 + yVel * 90, dt, EAR);
    s.earR = stepSpring(s.earR, (petting ? 9 : 0) - headVel * 260 - yVel * 90, dt, EAR);

    // tail: a slow sway at the base, each joint following the one before (the whip), plus the odd flick
    if (now > this.flickAt) { this.flick = 1; this.flickAt = now + 4000 + Math.random() * 6000; }
    this.flick *= Math.pow(0.04, dt / 1000);
    const sway = ((petting ? 4 : 3) * Math.sin(t * (petting ? 1.4 : 1.75)) - leanVel * 250 + yVel * 60) * this.amp;
    s.tail.forEach((j, i) => {
      const lead = i === 0 ? sway : s.tail[i - 1].x * 0.6;
      const curl = (petting ? (i > N - 4 ? 5 : 0) : this.flick * (i > N - 4 ? 14 * Math.sin(now / 70) : 0)) * Math.max(this.amp, 0.6);
      const n = stepSpring(j, lead + curl, dt, TAIL(i));
      s.tail[i] = { x: Math.max(-14, Math.min(14, n.x)), v: Math.abs(n.x) >= 14 ? 0 : n.v };
    });

    this.render(t, petting);
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(t: number, petting: boolean) {
    const s = this.s;
    const breathe = 1 + Math.sin(t * 1.96) * 0.006;
    const sq = this.lying ? 0 : s.sq.x * 0.012;
    // skew keeps the feet line (y = 188) fixed, so he leans instead of sliding
    const f = (n: number) => n.toFixed(3);
    this.all?.setAttribute('transform', `translate(${f(100 + s.mx.x)} ${f(188 + s.my.x)}) skewX(${f(-s.lean.x - s.mlean.x)}) scale(${f((1 + sq) * s.msx.x)} ${f((1 - sq) * breathe * s.msy.x)}) translate(-100 -188)`);
    this.head?.setAttribute('transform', `rotate(${f(s.head.x + s.mhead.x)} 100 132) translate(${f(s.hx.x)} ${f((petting ? 1.5 : 0) + s.mhy.x)})`);
    // legs fold up from the hip when tucked
    this.legs.L?.setAttribute('transform', `translate(0 148) scale(1 ${f(1 - 0.38 * Math.max(0, s.legL.x))}) translate(0 -148)`);
    this.legs.R?.setAttribute('transform', `translate(0 148) scale(1 ${f(1 - 0.38 * Math.max(0, s.legR.x))}) translate(0 -148)`);
    // the shadow stays on the floor: smaller and fainter the higher he is, and it follows him sideways
    const lift = Math.max(0, -s.my.x);
    this.shadow?.setAttribute('transform', `translate(${f(100 + s.mx.x)} 190) scale(${f(Math.max(0.45, 1 - lift / 70))} 1) translate(-100 -190)`);
    this.shadow?.setAttribute('opacity', f(Math.max(0.35, 1 - lift / 60)));
    this.earL?.setAttribute('transform', `rotate(${s.earL.x.toFixed(2)} 62 58)`);
    this.earR?.setAttribute('transform', `rotate(${s.earR.x.toFixed(2)} 138 58)`);
    if (this.tailO && this.tailF) {
      const d = smoothPath(tailPoints(this.rest, s.tail.map((j) => j.x * DEG)));
      this.tailO.setAttribute('d', d); this.tailF.setAttribute('d', d);
    }
  }
}
