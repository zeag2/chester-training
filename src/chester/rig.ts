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

export const restTailPath = () => smoothPath(tailPoints(tailRest(), []));

const sp = (): Spring => ({ x: 0, v: 0 });
const DEG = Math.PI / 180;

export class Rig {
  private all: SVGGElement | null; private head: SVGGElement | null;
  private earL: SVGGElement | null; private earR: SVGGElement | null;
  private tailO: SVGPathElement | null; private tailF: SVGPathElement | null;
  private rest = tailRest();
  private s = { lean: sp(), sq: sp(), head: sp(), hx: sp(), earL: sp(), earR: sp(), tail: Array.from({ length: N - 1 }, sp) };
  private raf = 0; private last = 0; private t0 = performance.now(); private flickAt = 0; private flick = 0;
  /** Finger lean, -1..1, while stroking; null otherwise. */
  stroke: number | null = null;
  visible = true;

  constructor(svg: SVGSVGElement) {
    const q = <T extends Element>(c: string) => svg.querySelector<T>(c);
    this.all = q('.r-all'); this.head = q('.r-head'); this.earL = q('.r-earL'); this.earR = q('.r-earR');
    this.tailO = q('.rt-o'); this.tailF = q('.rt-f');
    this.flickAt = this.t0 + 2500 + Math.random() * 4000;
    this.start();
  }

  start() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

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
    const petting = this.stroke !== null; const lean = this.stroke ?? 0;

    // body leans from the hips toward the finger; head goes further and tilts into the hand
    const prevLean = s.lean.x;
    s.lean = stepSpring(s.lean, lean * 7, dt, BODY);
    const leanVel = (s.lean.x - prevLean) / Math.max(1, dt);
    s.sq = stepSpring(s.sq, petting ? 1.2 : 0, dt, BODY);
    const prevHead = s.head.x;
    s.head = stepSpring(s.head, petting ? lean * 8 + Math.sin(t * 2.1) * 1.5 : 0, dt, HEAD);
    const headVel = (s.head.x - prevHead) / Math.max(1, dt);
    s.hx = stepSpring(s.hx, lean * 4, dt, HEAD);

    // ears: relax back while petted, and lag behind the head's turns
    s.earL = stepSpring(s.earL, (petting ? -9 : 0) - headVel * 260, dt, EAR);
    s.earR = stepSpring(s.earR, (petting ? 9 : 0) - headVel * 260, dt, EAR);

    // tail: a slow sway at the base, each joint following the one before (the whip), plus the odd flick
    if (now > this.flickAt) { this.flick = 1; this.flickAt = now + 4000 + Math.random() * 6000; }
    this.flick *= Math.pow(0.04, dt / 1000);
    const sway = (petting ? 4 : 3) * Math.sin(t * (petting ? 1.4 : 1.75)) - leanVel * 250;
    s.tail.forEach((j, i) => {
      const lead = i === 0 ? sway : s.tail[i - 1].x * 0.6;
      const curl = petting ? (i > N - 4 ? 5 : 0) : this.flick * (i > N - 4 ? 14 * Math.sin(now / 70) : 0);
      const n = stepSpring(j, lead + curl, dt, TAIL(i));
      s.tail[i] = { x: Math.max(-14, Math.min(14, n.x)), v: Math.abs(n.x) >= 14 ? 0 : n.v };
    });

    this.render(t, petting);
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(t: number, petting: boolean) {
    const s = this.s;
    const breathe = 1 + Math.sin(t * 1.96) * 0.006;
    const sq = s.sq.x * 0.012;
    // skew keeps the feet line (y = 188) fixed, so he leans instead of sliding
    this.all?.setAttribute('transform', `translate(100 188) skewX(${(-s.lean.x).toFixed(2)}) scale(${(1 + sq).toFixed(4)} ${((1 - sq) * breathe).toFixed(4)}) translate(-100 -188)`);
    this.head?.setAttribute('transform', `rotate(${s.head.x.toFixed(2)} 100 132) translate(${s.hx.x.toFixed(2)} ${(petting ? 1.5 : 0).toFixed(1)})`);
    this.earL?.setAttribute('transform', `rotate(${s.earL.x.toFixed(2)} 62 58)`);
    this.earR?.setAttribute('transform', `rotate(${s.earR.x.toFixed(2)} 138 58)`);
    if (this.tailO && this.tailF) {
      const d = smoothPath(tailPoints(this.rest, s.tail.map((j) => j.x * DEG)));
      this.tailO.setAttribute('d', d); this.tailF.setAttribute('d', d);
    }
  }
}
