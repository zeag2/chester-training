import { FLOOR, ballX, radiusAt, rollAt, trailPath } from './yarn';

const BASE = '#ef8f9a', STRAND = '#c45466', LINE = '#161a2b';
/** [angle, tilt, offset]: hand-placed wraps so the ball looks wound, not geometric */
const WRAPPING: [number, number, number][] = [[-58, 14, 2], [-52, 26, -3], [-8, 9, 4], [-2, 31, 0], [34, 20, -5], [41, 36, 3], [78, 12, -2], [118, 27, 5], [126, 16, -6]];
const ns = { vectorEffect: 'non-scaling-stroke' } as const;

/** The timer: a real-looking yarn ball that rolls (strands turn, lighting stays put), shrinks as it unwinds and leaves a loopy trail. */
export function YarnBall({ p, hop, hurry }: { p: number; hop: number; hurry: boolean }) {
  const r = radiusAt(p), s = r / 40, x = ballX(p), ang = rollAt(p);
  const spin = { transform: `rotate(${ang.toFixed(1)}deg)`, transformBox: 'view-box', transformOrigin: '0 0', transition: 'transform 1s linear' } as const;
  return <svg viewBox="0 0 350 220" width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
    <defs><clipPath id="yclip"><circle r="40" /></clipPath></defs>
    <path d={`M0 ${FLOOR} H350`} stroke="#ecebe5" strokeWidth="3" strokeLinecap="round" />
    <path d={trailPath(p)} stroke={LINE} strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
    <path d={trailPath(p)} stroke={BASE} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <g style={{ transform: `translate(${x.toFixed(1)}px,${FLOOR}px) scale(${s.toFixed(3)})`, transformBox: 'view-box', transformOrigin: '0 0', transition: 'transform 1s linear' }}>
      <ellipse cx="0" cy="1" rx="34" ry="5" fill="rgba(29,35,64,.13)" />
      <g className={hurry ? 'yhurry' : ''}><g className={hop % 2 ? 'yhopA' : 'yhopB'}><g className="yrock"><g transform="translate(0,-40)">
        <circle r="40" fill={BASE} />
        <g clipPath="url(#yclip)">
          <g style={spin}>
            {WRAPPING.map(([a, k, o], i) => <ellipse key={i} cx={o} rx="41" ry={k} transform={`rotate(${a})`} fill="none" stroke={STRAND} strokeWidth="2.4" {...ns} />)}
          </g>
          <path d="M40 0A40 40 0 1 1 -40 0A40 40 0 1 1 40 0Z M30 -9A37 37 0 1 0 -44 -9A37 37 0 1 0 30 -9Z" fillRule="evenodd" fill="#8c2a3c" opacity=".28" />
        </g>
        <path d="M-27 -16 A31 31 0 0 1 -8 -32" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".6" {...ns} />
        <circle r="40" fill="none" stroke={LINE} strokeWidth="3.5" {...ns} />
        <g style={spin}><path d="M27 -29 C37 -42 50 -36 46 -25" stroke={STRAND} strokeWidth="3" fill="none" strokeLinecap="round" {...ns} /></g>
      </g></g></g></g>
    </g>
  </svg>;
}
