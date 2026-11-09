/* Chester: original art, one thin outline, flat fills with one soft shadow, simple faces.
   Everything returns SVG strings so poses share one rig; CSS plays the moves and rig.ts adds follow-through. */
import { curvesOf, restTailPath } from './rig';

export interface Coat { name: string; base: string; shade: string; light: string; line: string; inner: string; nose: string; stripe?: string; white?: boolean; patches?: [string, string]; point?: string }

export const COATS: Record<string, Coat> = {
  black:  { name: 'Black',         base: '#353746', shade: '#272935', light: '#4a4c5e', line: '#161a2b', inner: '#f2a6b4', nose: '#f2a6b4' },
  orange: { name: 'Orange tabby',  base: '#f3a65e', shade: '#e08a3e', light: '#fbd9ad', line: '#3d2a33', inner: '#f6b4b4', nose: '#ee8e93', stripe: '#d9772c' },
  grey:   { name: 'Grey',          base: '#9aa0b4', shade: '#8189a0', light: '#e4e6ef', line: '#26294a', inner: '#f2a8b2', nose: '#e8939e' },
  white:  { name: 'White',         base: '#fbfaf7', shade: '#e3e3ee', light: '#ffffff', line: '#2c3050', inner: '#f6b7c1', nose: '#ef9aa6' },
  cream:  { name: 'Cream',         base: '#f3dcb5', shade: '#e2c08f', light: '#fdf2de', line: '#4a3528', inner: '#f6b9b6', nose: '#ee9aa2', stripe: '#e2b980' },
  brown:  { name: 'Brown tabby',   base: '#a8805a', shade: '#8a6444', light: '#ead3b6', line: '#33241c', inner: '#f0b2a6', nose: '#d68e84', stripe: '#6b4a2e' },
  silver: { name: 'Silver tabby',  base: '#ced3dc', shade: '#b4bac7', light: '#f1f3f7', line: '#2a2f45', inner: '#f2b9c0', nose: '#e09aa3', stripe: '#717789' },
  tuxedo: { name: 'Tuxedo',        base: '#353746', shade: '#272935', light: '#fbfaf7', line: '#161a2b', inner: '#f2a6b4', nose: '#f2a6b4', white: true },
  calico: { name: 'Calico',        base: '#fbfaf7', shade: '#e6e4ec', light: '#ffffff', line: '#2c3050', inner: '#f6b7c1', nose: '#ef9aa6', patches: ['#f3a65e', '#4a3f3c'] },
  tortie: { name: 'Tortoiseshell', base: '#3d3330', shade: '#2c2422', light: '#5a4840', line: '#161112', inner: '#e8a5a8', nose: '#c98488', patches: ['#d7823a', '#9b5326'] },
  point:  { name: 'Colorpoint',    base: '#f4ebdd', shade: '#e2d4bf', light: '#fdf8ef', line: '#3c2e26', inner: '#e3b6a6', nose: '#7a5a48', point: '#6e5140' },
};

export const EYES: Record<string, { name: string; ring: string; ring2?: string }> = {
  gold: { name: 'Gold', ring: '#f2bb3d' }, copper: { name: 'Copper', ring: '#e07d2e' }, green: { name: 'Green', ring: '#8cc152' },
  blue: { name: 'Blue', ring: '#6db3f2' }, hazel: { name: 'Hazel', ring: '#b39b4b' }, odd: { name: 'Odd', ring: '#6db3f2', ring2: '#f2bb3d' },
};

export type Mood = 'curious' | 'happy' | 'sleepy' | 'open';
export type Pose = 'sit' | 'doze' | 'walk' | 'ball' | 'sleep' | 'drape' | 'loaf' | 'knead' | 'fly' | 'run' | 'curl' | 'full';

/* Style (docs/plans/2026-11-08-cat-art-style.md): one thin, even outline; flat fills with one soft shadow shape;
   a small head on a long body; very simple faces; the tail does the acting. */
/** Outline width in pose units. Heads are scaled, so they draw their lines thicker by the same factor. */
const LW = 3;
const SW = (c: Coat, w = LW) => `stroke="${c.line}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const HEAD = 'M100 44 C140 44 160 66 162 94 C164 120 136 136 100 136 C64 136 36 120 38 94 C40 66 60 44 100 44 Z';
const isDark = (c: Coat) => c.base === '#353746' || c.base === '#3d3330';

/** Head size against the body, scaled about the neck (100, 132) so it stays attached in every pose. */
export const HEAD_SIZE = { scale: 0.88 };

/** Head drawn around center (100, 92). `size` shrinks it further about the neck for this pose; `outer` is any scale
    the pose applies around it, so the outline stays as thin as the body's. `turn` (0..1) turns the face to the right. */
export function head(c: Coat, eyeKey: string, mood: Mood, uid: string, wear = '', o: { size?: number; outer?: number; turn?: number } = {}): string {
  const k = HEAD_SIZE.scale * (o.size ?? 1);
  const inner = headArt(c, eyeKey, mood, uid, wear, LW / (k * (o.outer ?? 1)), o.turn ?? 0);
  return k === 1 ? inner : `<g transform="translate(100 132) scale(${k}) translate(-100 -132)">${inner}</g>`;
}
function headArt(c: Coat, eyeKey: string, mood: Mood, uid: string, wear: string, lw: number, turn: number): string {
  const e = EYES[eyeKey] ?? EYES.gold;
  const ear = c.point ?? c.base;
  const L = (w = lw) => `stroke="${c.line}" stroke-width="${w.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"`;
  const fx = (14 * turn).toFixed(1); // face features slide toward the way he's looking
  let hp = '';
  if (c.patches) hp += `<path d="M30 36 C70 28 94 46 90 70 C80 88 50 88 30 80 Z" fill="${c.patches[0]}"/><path d="M114 40 C140 32 168 46 170 74 C150 80 122 70 114 40 Z" fill="${c.patches[1]}"/>`;
  if (c.stripe) hp += `<path d="M90 50 L92 62 M100 47 V61 M110 50 L108 62 M40 96 H52 M41 106 L53 104 M160 96 H148 M159 106 L147 104" stroke="${c.stripe}" stroke-width="${(lw * 1.3).toFixed(2)}" stroke-linecap="round"/>`;
  hp += `<path d="M160 80 C166 116 140 140 92 140 C130 130 152 112 150 82 Z" fill="${c.shade}"/>`;
  hp += `<g transform="translate(${fx} 0)">`
    + (c.point ? `<ellipse cx="100" cy="106" rx="32" ry="24" fill="${c.point}"/>` : `<ellipse cx="100" cy="114" rx="${c.white ? 30 : 20}" ry="${c.white ? 22 : 13}" fill="${c.white ? '#fbfaf7' : c.light}"/>`)
    + '</g>';
  const dark = '#1a1d2e';
  const [xL, xR] = [76, 124];
  const closed = (up: boolean) => `<path d="${up ? `M${xL - 10} 96 Q${xL} 86 ${xL + 10} 96 M${xR - 10} 96 Q${xR} 86 ${xR + 10} 96` : `M${xL - 10} 94 Q${xL} 101 ${xL + 10} 94 M${xR - 10} 94 Q${xR} 101 ${xR + 10} 94`}" stroke="${c.line}" stroke-width="${(lw * 1.25).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
  let eyes: string;
  if (mood === 'happy') eyes = closed(true);
  else if (mood === 'sleepy') eyes = closed(false);
  else {
    eyes = '';
    const sx = (i: number) => (i === 0 ? 1 - 0.18 * turn : 1); // the far eye narrows as he turns
    [[xL, e.ring], [xR, e.ring2 ?? e.ring]].forEach(([cx, ring], i) => {
      eyes += `<ellipse cx="${cx}" cy="94" rx="${(12.5 * sx(i)).toFixed(1)}" ry="13.5" fill="${ring}" ${L(lw * 0.85)}/>`;
    });
    eyes += '<g class="look"><g class="pupils">';
    [xL, xR].forEach((cx, i) => {
      eyes += `<ellipse cx="${cx + 1}" cy="95" rx="${(6.2 * sx(i)).toFixed(1)}" ry="10" fill="${dark}"/>`
        + `<circle cx="${cx + 4}" cy="89" r="3.3" fill="#fff"/><circle cx="${cx - 3}" cy="100" r="1.4" fill="#fff" opacity=".8"/>`;
    });
    eyes += '</g></g>';
    // eyelids for blinking: coat-coloured lids clipped to the eyes, with a lash line at the bottom edge
    const lid = c.point ?? c.base;
    eyes += `<defs><clipPath id="ey${uid}"><ellipse cx="${xL}" cy="94" rx="${(13.8 * sx(0)).toFixed(1)}" ry="14.8"/><ellipse cx="${xR}" cy="94" rx="13.8" ry="14.8"/></clipPath></defs>`
      + `<g clip-path="url(#ey${uid})"><g class="lids"><rect x="58" y="72" width="84" height="38" fill="${lid}"/>`
      + `<path d="M${xL - 13} 102 Q${xL} 110 ${xL + 13} 102 M${xR - 13} 102 Q${xR} 110 ${xR + 13} 102" stroke="${c.line}" stroke-width="${(lw * 1.1).toFixed(2)}" fill="none" stroke-linecap="round"/></g></g>`;
  }
  const mouth = mood === 'open'
    ? `<path d="M92 111 Q100 128 108 111 Z" fill="#7a2f3a" ${L(lw * 0.8)}/><path d="M95 119 Q100 124 105 119" fill="#ef8f9a"/>`
    : `<path class="mclosed" d="M93 111 Q96.5 115.5 100 111 Q103.5 115.5 107 111" ${L(lw * 0.8)} fill="none"/>`
      + `<path class="tongue" style="transform:scaleY(0)" d="M96 113 H104 V118 A4 4 0 0 1 96 118 Z" fill="#ef8f9a" ${L(lw * 0.6)}/>`
      + `<g class="mopen" style="transform:scale(0)"><ellipse cx="100" cy="118" rx="10" ry="12" fill="#7a2f3a" ${L(lw * 0.8)}/><ellipse cx="100" cy="124" rx="6" ry="4" fill="#ef8f9a"/></g>`;
  const earL = `<path d="M44 86 C40 62 38 38 42 22 C43 17 48 16 52 19 C64 28 78 40 90 52 Z" fill="${ear}" ${L()}/><path d="M52 72 C50 54 49 40 51 30 C60 37 69 44 77 52 Z" fill="${c.inner}"/>`;
  return `<defs><clipPath id="hc${uid}"><path d="${HEAD}"/></clipPath></defs>`
    + `<g class="r-earL"><g class="earL"><g transform="translate(${(6 * turn).toFixed(1)} 0)">${earL}</g></g></g>`
    + `<g class="r-earR"><g class="earR"><g transform="translate(${(200 + 6 * turn).toFixed(1)} 0) scale(-1 1)">${earL}</g></g></g>`
    + `<path d="${HEAD}" fill="${c.base}"/><g clip-path="url(#hc${uid})">${hp}</g><path d="${HEAD}" fill="none" ${L()}/>`
    + `<g transform="translate(${fx} 0)">`
    + `<g class="blush"><ellipse cx="62" cy="111" rx="8" ry="4.5" fill="#f592a3" opacity=".5"/><ellipse cx="138" cy="111" rx="8" ry="4.5" fill="#f592a3" opacity=".5"/></g>`
    + `<g class="eyes">${eyes}</g>`
    + (mood === 'sleepy' ? '' : `<g class="eyesJoy">${closed(true)}</g>`)
    + `<path d="M96 104.5 H104 Q104 106 100 108.5 Q96 106 96 104.5 Z" fill="${c.nose}" ${L(lw * 0.6)}/><path d="M100 108.5 V111" ${L(lw * 0.7)}/>`
    + mouth
    + `<g class="whisk"><path d="M36 103 L58 106 M38 114 L58 111 M164 103 L142 106 M162 114 L142 111" ${L(lw * 0.55)} opacity=".8"/></g>`
    + '</g>'
    + outfit(c, wear);
}

/** Outfits from Chester's corner, drawn in head coordinates so they follow every pose, the rig and petting. */
export const OUTFITS = ['bell', 'bowtie', 'bandana', 'flower', 'party', 'crown', 'scarf'] as const;
export function outfit(c: Coat, wear: string): string {
  const L = `stroke="${c.line}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  switch (wear) {
    case 'bell': return `<g class="wear wear-bell"><path d="M62 128 Q100 150 138 128" stroke="${c.line}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M62 128 Q100 150 138 128" stroke="#d2493f" stroke-width="7" fill="none" stroke-linecap="round"/>`
      + `<circle cx="100" cy="147" r="8.5" fill="#efc44a" ${L}/><path d="M93 148 H107 M100 148 V155" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    case 'bowtie': return `<g class="wear wear-bowtie"><path d="M100 143 L78 130 C74 137 74 149 78 156 Z" fill="#3f6fb0" ${L}/><path d="M100 143 L122 130 C126 137 126 149 122 156 Z" fill="#3f6fb0" ${L}/>`
      + `<path d="M84 136 L84 150 M116 136 L116 150" stroke="#9fc0ea" stroke-width="3" stroke-linecap="round"/><rect x="93" y="136" width="14" height="14" rx="5" fill="#5584c6" ${L}/></g>`;
    case 'bandana': return `<g class="wear wear-bandana"><path d="M62 126 Q100 144 138 126 L104 166 Q100 170 96 166 Z" fill="#2a7a6f" ${L}/>`
      + `<circle cx="84" cy="139" r="3" fill="#fff"/><circle cx="104" cy="143" r="3" fill="#fff"/><circle cx="118" cy="137" r="3" fill="#fff"/><circle cx="96" cy="155" r="3" fill="#fff"/><circle cx="108" cy="157" r="2.4" fill="#fff"/></g>`;
    case 'flower': return `<g class="wear wear-flower">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="138" cy="42" rx="7" ry="11" fill="#fff" ${L} transform="rotate(${a} 138 52)"/>`).join('')}<circle cx="138" cy="52" r="7" fill="#efc44a" ${L}/></g>`;
    case 'party': return `<g class="wear wear-party" transform="rotate(10 103 46)"><path d="M82 48 L102 -6 L124 48 Q103 54 82 48 Z" fill="#ef8f9a" ${L}/>`
      + `<path d="M90 28 L114 32 M96 12 L108 14" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="102" cy="-8" r="7" fill="#efc44a" ${L}/></g>`;
    case 'crown': return `<g class="wear wear-crown"><path d="M74 50 L72 20 L88 34 L100 12 L112 34 L128 20 L126 50 Q100 56 74 50 Z" fill="#efc44a" ${L}/>`
      + `<circle cx="100" cy="42" r="4.5" fill="#d2493f"/><circle cx="84" cy="44" r="3.2" fill="#3f6fb0"/><circle cx="116" cy="44" r="3.2" fill="#3f6fb0"/></g>`;
    // a cosy knitted scarf in two friends' colours, one end hanging down the chest
    case 'scarf': return `<g class="wear wear-scarf"><path d="M58 124 Q100 150 142 124 L144 136 Q100 164 56 136 Z" fill="#ef8f9a" ${L}/>`
      + `<path d="M70 132 Q75 140 72 146 M86 138 Q90 146 87 152 M114 138 Q110 146 113 152 M130 132 Q125 140 128 146" stroke="#6cc3b5" stroke-width="5" fill="none" stroke-linecap="round"/>`
      + `<path d="M118 144 L126 180 L110 182 L104 148 Z" fill="#ef8f9a" ${L}/><path d="M112 160 L123 158 M114 170 L125 168" stroke="#6cc3b5" stroke-width="5" stroke-linecap="round"/>`
      + `<path d="M110 182 L108 189 M115 182 L114 189 M120 181 L121 188 M125 180 L127 187" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round"/></g>`;
    default: return '';
  }
}

/** Tail drawn as one smooth chain the rig bends every frame (outline under fill, so no seams). Long and thin. */
const rigTail = (c: Coat, d1?: string, d2?: string, amp = 1) => { const curves = d1 && d2 ? curvesOf(d1, d2) : undefined; const d = restTailPath(curves); const f = c.point ?? c.base;
  return `<g class="rtail"${curves ? ` data-tail='${JSON.stringify(curves)}'` : ''} data-amp="${amp}"><path class="rt-o" d="${d}" stroke="${c.line}" stroke-width="${10 + 2 * LW}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path class="rt-f" d="${d}" stroke="${f}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`; };
const pad = '#f3a9b6';
const pawFill = (c: Coat) => (c.white ? '#fbfaf7' : c.point ?? c.base);
const stripeW = LW * 1.4;
const shadow = (cx: number, rx: number, cls = 'shadow') => `<ellipse class="${cls}" cx="${cx}" cy="190" rx="${rx}" ry="6" fill="rgba(29,35,64,.12)"/>`;

/** A limb from the body (x1, y1) to a round paw at (x2, y2), w wide. Outlined down both sides and round the paw
    only: the end that joins the body has no line across it, so arms and legs grow out of the body. */
function openLimb(c: Coat, x1: number, y1: number, x2: number, y2: number, w: number, fill: string): string {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1, dx = (x2 - x1) / len, dy = (y2 - y1) / len, nx = -dy, ny = dx, r = w / 2, k = 0.5523 * r;
  const P = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const A = [x1 + nx * r, y1 + ny * r], B = [x2 + nx * r, y2 + ny * r], C = [x2 - nx * r, y2 - ny * r], D = [x1 - nx * r, y1 - ny * r], T = [x2 + dx * r, y2 + dy * r];
  const edge = `M${P(A[0], A[1])} L${P(B[0], B[1])} C${P(B[0] + dx * k, B[1] + dy * k)} ${P(T[0] + nx * k, T[1] + ny * k)} ${P(T[0], T[1])}`
    + ` C${P(T[0] - nx * k, T[1] - ny * k)} ${P(C[0] + dx * k, C[1] + dy * k)} ${P(C[0], C[1])} L${P(D[0], D[1])}`;
  return `<path d="${edge} Z" fill="${fill}"/><path d="${edge}" fill="none" ${SW(c)}/>`;
}

/** Sitting, facing you: a little chibi (the only pose allowed to be), small head on a pear-shaped body with haunches,
    front paws together and the long tail wrapped round them. `doze` bows the head and closes the eyes. */
const SIT_HEAD = { size: 0.84, lift: -12 };
function sit(c: Coat, eyes: string, mood: Mood, uid: string, raised: boolean, w = '', doze = false): string {
  const BODY = 'M84 118 C74 130 70 144 67 155 C53 160 46 172 49 183 C51 189 58 190 66 190 L134 190 C142 190 149 189 151 183 C154 172 147 160 133 155 C130 144 126 130 116 118 Z';
  let bp = '';
  if (c.stripe) bp += `<path d="M56 166 Q64 166 68 174 M144 166 Q136 166 132 174 M78 132 Q86 134 86 140 M122 132 Q114 134 114 140" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="62" cy="170" rx="18" ry="16" fill="${c.patches[1]}"/><ellipse cx="140" cy="174" rx="16" ry="16" fill="${c.patches[0]}"/>`;
  bp += `<path d="M136 150 C158 166 154 192 126 194 C142 182 142 166 128 152 Z" fill="${c.shade}"/>`;
  bp += `<ellipse cx="100" cy="146" rx="15" ry="22" fill="${c.white ? '#fbfaf7' : c.light}"/>`;
  // haunch lines: the folded back legs either side of the front paws
  const haunch = `<path d="M68 157 C80 160 84 174 81 189 M132 157 C120 160 116 174 119 189" fill="none" ${SW(c, LW * 0.8)} opacity=".75"/>`;
  const leg = (x: number) => { const e = `M${x - 7} 140 V182 C${x - 8.5} 188 ${x - 5} 190.5 ${x} 190.5 C${x + 5} 190.5 ${x + 8.5} 188 ${x + 7} 182 V140`;
    return `<path d="${e} Z" fill="${pawFill(c)}"/><path d="${e}" fill="none" ${SW(c)}/><path d="M${x - 2.5} 186 V189 M${x + 2.5} 186 V189" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/>`; };
  const right = raised
    ? `<g class="pawR raised" style="transform:rotate(-160deg)">${openLimb(c, 116, 144, 116, 182, 16, pawFill(c))}<ellipse cx="116" cy="179" rx="4.5" ry="4" fill="${pad}"/><circle cx="111.5" cy="185.5" r="2" fill="${pad}"/><circle cx="116" cy="187.5" r="2" fill="${pad}"/><circle cx="120.5" cy="185.5" r="2" fill="${pad}"/></g>`
    : `<g class="pawR"><g class="r-legR">${leg(108)}</g></g>`;
  const tail = rigTail(c, 'M140 178 C160 180 162 194 140 195', 'M140 195 C120 196 96 197 70 193', 0.3);
  const k = SIT_HEAD.size;
  const bow = doze ? ' rotate(14 100 132) translate(0 10)' : '';
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<g class="r-shadow">${shadow(100, 56)}</g>`
    + `<g class="r-all"><g class="all">`
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/>${haunch}<g class="pawL"><g class="r-legL">${leg(92)}</g></g></g>`
    + (raised ? '' : right)
    + tail
    + `<g transform="translate(0 ${SIT_HEAD.lift})${bow}"><g class="r-head"><g class="head">${head(c, eyes, doze ? 'sleepy' : mood, uid, w, { size: k })}</g></g></g>`
    + (raised ? right : '')
    + `</g></g>`;
}

/** Walking, side on: a small head on the front of the shoulders, face turned toward where he's going, a long body
    with the rump a touch higher, long legs, and the tail up like a question mark. Legs keep their walk-cycle classes. */
function walk(c: Coat, eyes: string, mood: Mood, uid: string, w = ''): string {
  const leg = (x: number, cls: string, back: boolean, far: boolean) => {
    const t = back ? 12 : 8.5; // half-width at the top: thighs at the back
    // outlined down the sides and round the paw only: no closing line where the leg joins the body
    const edge = `M${x - t} 140 C${x - t} 162 ${x - 6} 174 ${x - 6} 182 Q${x - 7.5} 191 ${x + 1} 191 Q${x + 9.5} 191 ${x + 7} 182 C${x + 7} 174 ${x + t - 2} 160 ${x + t - 2} 140`;
    return `<g class="${cls}"><path d="${edge} Z" fill="${far ? c.shade : pawFill(c)}"/><path d="${edge}" fill="none" ${SW(c)}/><path d="M${x - 2.5} 186 V189 M${x + 3} 186 V189" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/></g>`;
  };
  const BODY = 'M166 126 C173 142 166 160 148 165 C126 170 96 170 80 168 C58 166 44 154 46 136 C48 118 62 106 84 108 C106 110 130 117 148 115 C157 114 163 119 166 126 Z';
  const s = 0.74; // head pose scale
  return `<defs><clipPath id="wb${uid}"><path d="${BODY}"/></clipPath></defs>`
    + shadow(108, 72)
    + `<g class="all">`
    + rigTail(c, 'M52 124 C34 116 28 96 32 78', 'M32 78 C36 60 56 58 58 72', 1)
    + leg(66, 'legBL', true, true) + leg(140, 'legFR', false, true)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/>`
    + `<g clip-path="url(#wb${uid})"><path d="M60 162 C92 172 132 172 160 158 L170 176 L40 176 Z" fill="${c.shade}"/>`
    + `<ellipse cx="160" cy="142" rx="10" ry="15" fill="${c.white ? '#fbfaf7' : c.light}"/>`
    + (c.patches ? `<path d="M70 108 C90 102 110 112 108 132 C96 140 78 136 70 108 Z" fill="${c.patches[0]}"/><path d="M118 116 C134 112 150 118 146 134 C134 138 122 132 118 116 Z" fill="${c.patches[1]}"/>` : '')
    + (c.stripe ? `<path d="M80 110 Q84 122 78 132 M98 111 Q102 123 96 133 M116 114 Q120 126 114 136" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>` : '')
    + `</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + leg(84, 'legBR', true, false) + leg(156, 'legFL', false, false)
    + `<g style="transform:translate(104px,52px) scale(${s});transform-origin:0 0"><g class="r-head"><g class="head">${head(c, eyes, mood, uid, w, { size: 0.82, outer: s, turn: 1 })}</g></g></g></g>`;
}

/** Playing on his back: hugging the yarn ball to his chest with both front paws, chubby back feet up against it
    showing their toe beans, tail curled out behind, looking at the ball with a little blep. */
function ball(c: Coat, eyes: string, mood: Mood, uid: string, w = ''): string {
  const pf = pawFill(c);
  // a short, chubby limb ending in a round paw, open where it joins the body
  const limb = (x1: number, y1: number, x2: number, y2: number, cls: string, beans = false) =>
    `<g class="${cls}">${openLimb(c, x1, y1, x2, y2, 16, pf)}`
    + (beans ? `<ellipse cx="${x2}" cy="${y2 + 1.5}" rx="4.2" ry="3.4" fill="${pad}"/><circle cx="${x2 - 4.6}" cy="${y2 - 3.6}" r="1.8" fill="${pad}"/><circle cx="${x2}" cy="${y2 - 5.4}" r="1.8" fill="${pad}"/><circle cx="${x2 + 4.6}" cy="${y2 - 3.6}" r="1.8" fill="${pad}"/>`
      : `<path d="M${x2 - 2.5} ${y2 - 5} v3 M${x2 + 2.5} ${y2 - 5} v3" stroke="${c.line}" stroke-width="1.4" stroke-linecap="round"/>`)
    + '</g>';
  const BODY = 'M92 132 C100 116 132 118 160 132 C184 144 196 160 188 176 C180 190 150 190 124 180 C100 170 84 150 92 132 Z';
  let bp = `<path d="M100 150 C112 172 150 186 184 178 C176 190 140 192 116 182 C98 172 90 160 100 150 Z" fill="${c.shade}"/>`
    + `<ellipse cx="132" cy="146" rx="30" ry="15" fill="${c.white ? '#fbfaf7' : c.light}" transform="rotate(24 132 146)"/>`;
  if (c.stripe) bp += `<path d="M150 184 Q156 174 164 172 M170 184 Q172 174 180 168" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="168" cy="164" rx="20" ry="14" fill="${c.patches[0]}"/><ellipse cx="110" cy="168" rx="14" ry="10" fill="${c.patches[1]}"/>`;
  const Y = '#ef8f9a', YS = '#d06a7c';
  const yarn = `<g transform="translate(4 10)"><g class="yarn"><circle cx="134" cy="106" r="24" fill="${Y}" ${SW(c)}/>`
    + `<path d="M114 96 C126 104 142 100 156 110 M112 110 C124 106 140 118 152 124 M124 84 C132 94 138 110 134 128 M146 88 C140 98 136 108 122 114" stroke="${YS}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    + `<path d="M156 116 C168 122 170 134 162 140 C156 144 158 152 166 154" stroke="${YS}" stroke-width="3" fill="none" stroke-linecap="round"/></g></g>`;
  const s = 0.72;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + shadow(126, 76)
    + `<g class="all">`
    + rigTail(c, 'M184 170 C204 174 214 158 206 142', 'M206 142 C198 126 206 112 218 116', 1.2)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + yarn
    + limb(180, 160, 166, 124, 'kickA', true) + limb(166, 168, 156, 142, 'kickB', true)
    + limb(104, 142, 117, 126, 'armA') + limb(118, 150, 129, 136, 'armB')
    + `<g style="transform:translate(-30px,26px) rotate(-14deg) scale(${s});transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, mood === 'open' ? 'curious' : mood, uid, w, { size: 0.9, outer: s, turn: 0.4 })}`
    + `<path d="M108 112 H114 V117 A3 3 0 0 1 108 117 Z" fill="#ef8f9a" stroke="${c.line}" stroke-width="2"/></g></g></g>`
    + `</g>`;
}

/** Curled up asleep: one soft oval, head resting on the front paws, tail round the front. Only the back breathes.
    A snot bubble lives on the nose and shows with the "night" anim. */
function sleep(c: Coat, eyes: string, uid: string, w = ''): string {
  const BODY = 'M44 186 C32 150 66 116 120 116 C172 116 202 146 196 180 C194 190 186 192 176 192 L58 192 C50 192 46 190 44 186 Z';
  let bp = `<path d="M198 156 C200 188 178 198 130 196 C176 184 190 164 182 128 Z" fill="${c.shade}"/>`;
  if (c.stripe) bp += `<path d="M122 118 Q128 132 120 142 M148 120 Q154 134 146 146 M172 130 Q176 142 168 150" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="150" cy="132" rx="34" ry="20" fill="${c.patches[1]}"/><ellipse cx="186" cy="172" rx="18" ry="18" fill="${c.patches[0]}"/>`;
  const snot = `<g class="snot"><circle cx="112" cy="114" r="10" fill="rgba(196,228,255,.55)" stroke="#8fc0e6" stroke-width="2"/><circle cx="108" cy="110" r="2.6" fill="#fff"/></g>`;
  const paw = (x: number) => `<ellipse cx="${x}" cy="186" rx="13" ry="6.5" fill="${pawFill(c)}" ${SW(c)}/>`;
  const s = 0.72;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + shadow(120, 88)
    + `<g class="r-all"><g class="all"><g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/>`
    + `<path d="M150 140 C172 150 176 170 162 184" fill="none" ${SW(c, LW * 0.8)} opacity=".6"/></g>`
    + rigTail(c, 'M190 180 C192 198 160 199 130 197', 'M130 197 C110 196 92 195 78 191', 0.35)
    + paw(86) + paw(110)
    + `<g style="transform:translate(-28px,62px) rotate(-12deg) scale(${s});transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, 'sleepy', uid, w, { size: 0.9, outer: s })}${snot}</g></g></g>`
    + `<g class="zz"><text x="150" y="80" font-size="26" font-weight="800" fill="#4a5590" font-family="Nunito,sans-serif">z</text><text x="170" y="58" font-size="19" font-weight="800" fill="#7a86b8" font-family="Nunito,sans-serif">z</text><text x="186" y="40" font-size="13" font-weight="800" fill="#a4add0" font-family="Nunito,sans-serif">z</text></g></g></g>`;
}

/** Draped over the arm of a sofa cushion: body along the top, chin on the edge, one front leg dangling down the
    front, tail hanging off the other end. Eyes closed. A lazy idle for Home. */
function drape(c: Coat, eyes: string, uid: string, w = ''): string {
  const BODY = 'M44 128 C40 112 60 98 96 98 C134 98 170 100 184 112 C194 120 190 132 176 134 L56 134 C48 134 45 132 44 128 Z';
  let bp = `<path d="M60 128 C100 136 150 136 186 124 L190 140 L40 140 Z" fill="${c.shade}"/>`;
  if (c.stripe) bp += `<path d="M96 98 Q100 110 94 120 M122 99 Q126 111 120 121 M148 101 Q152 113 146 123" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="110" cy="106" rx="26" ry="12" fill="${c.patches[1]}"/><ellipse cx="166" cy="114" rx="16" ry="12" fill="${c.patches[0]}"/>`;
  const S = '#e9dcc8', SS = '#d6c4aa', SL = '#a48b6c';
  const cushion = `<g class="cushion"><path d="M22 140 C22 128 32 126 44 126 L180 126 C194 126 204 130 204 142 L204 186 C204 192 198 194 190 194 L36 194 C28 194 22 192 22 186 Z" fill="${S}" stroke="${SL}" stroke-width="${LW}" stroke-linejoin="round"/>`
    + `<path d="M26 150 C80 158 150 158 200 150" stroke="${SS}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  const dangle = (x: number) => { const e = `M${x - 8} 128 C${x - 8} 146 ${x - 6} 160 ${x - 6} 168 Q${x - 7} 177 ${x + 1} 177 Q${x + 9} 177 ${x + 7} 168 C${x + 7} 160 ${x + 7} 146 ${x + 7} 128`;
    return `<g class="dangle"><path d="${e} Z" fill="${pawFill(c)}"/><path d="${e}" fill="none" ${SW(c)}/><path d="M${x - 2.5} 172 V175 M${x + 3} 172 V175" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/></g>`; };
  const tucked = `<ellipse cx="78" cy="131" rx="13" ry="5.5" fill="${pawFill(c)}" ${SW(c)}/>`;
  const s = 0.62;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<ellipse cx="113" cy="196" rx="96" ry="5" fill="rgba(29,35,64,.12)"/>`
    + cushion
    + `<g class="r-all"><g class="all">`
    + rigTail(c, 'M182 124 C196 128 200 140 198 156', 'M198 156 C196 170 200 180 208 182', 0.7)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + dangle(60) + tucked
    + `<g style="transform:translate(-44px,34px) rotate(-6deg) scale(${s});transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, 'sleepy', uid, w, { outer: s })}</g></g></g>`
    + `</g></g>`;
}

/** Bread loaf: one low dome, head at the front, paws tucked under the chest, tail wrapped along the floor.
    knead = the same loaf standing on a pink pillow, paws pressing in turn. */
function loaf(c: Coat, eyes: string, mood: Mood, uid: string, knead = false, w = ''): string {
  const BODY = 'M30 188 C22 154 42 118 96 112 C150 106 200 122 208 158 C212 178 206 188 196 188 Z';
  let bp = `<path d="M210 152 C212 184 194 196 150 192 C188 180 202 160 198 130 Z" fill="${c.shade}"/>`;
  if (c.stripe) bp += `<path d="M132 110 Q138 124 130 134 M156 112 Q162 126 154 138 M180 120 Q184 132 176 142" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="160" cy="130" rx="34" ry="20" fill="${c.patches[1]}"/><ellipse cx="194" cy="170" rx="20" ry="18" fill="${c.patches[0]}"/>`;
  const paw = (x: number, cls = '') => `<g${cls ? ` class="${cls}"` : ''}><path d="M${x - 12} 189 C${x - 13} 175 ${x + 13} 175 ${x + 12} 189 Z" fill="${pawFill(c)}" ${SW(c)}/><path d="M${x - 4} 183 V187 M${x + 4} 183 V187" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/></g>`;
  const leg = (x: number, cls: string) => `<g class="${cls}">${openLimb(c, x, 166, x, 186, 20, pawFill(c))}<path d="M${x - 4} 189 V194 M${x + 4} 189 V194" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/></g>`;
  const s = 0.86;
  const cat = `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + (knead ? leg(68, 'kneadL') + leg(100, 'kneadR') : '')
    + `<g style="transform:translate(-14px,46px) scale(${s});transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, mood, uid, w, { size: 0.82, outer: s })}</g></g></g>`
    + (knead ? '' : paw(70) + paw(98))
    + rigTail(c, 'M200 172 C218 186 204 189 180 188', 'M180 188 C162 188 146 187 132 184', 0.5);
  const defs = `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`;
  if (!knead) return defs + shadow(116, 100) + `<g class="r-all"><g class="all">${cat}</g></g>`;
  const P = '#f6a9bd', PS = '#e88aa3', PL = '#8f3e58';
  return defs + `<ellipse cx="112" cy="200" rx="108" ry="5" fill="rgba(29,35,64,.12)"/>`
    + `<g class="pillow"><path d="M8 184 C0 168 14 162 28 168 C70 158 156 158 198 168 C212 162 226 168 218 184 C226 198 212 204 198 198 C156 206 70 206 28 198 C14 204 0 198 8 184 Z" fill="${P}" stroke="${PL}" stroke-width="${LW}" stroke-linejoin="round"/>`
    + `<path d="M30 192 C80 200 150 200 196 192" stroke="${PS}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + `<ellipse class="dentL" cx="68" cy="174" rx="16" ry="4" fill="${PS}"/><ellipse class="dentR" cx="100" cy="174" rx="16" ry="4" fill="${PS}"/></g>`
    + `<g class="r-all"><g class="all"><g style="transform:translateY(-20px)">${cat}</g></g></g>`;
}

/** Flying, superhero style: body stretched long and flat, head at the front, front paws reaching forward,
    back legs kicked out behind, tail streaming back. Faces right. */
function fly(c: Coat, eyes: string, mood: Mood, uid: string, w = ''): string {
  const BODY = 'M28 120 C28 102 62 96 104 98 C140 100 162 106 164 122 C166 140 138 146 100 146 C58 146 28 138 28 120 Z';
  const limb = (x1: number, y1: number, x2: number, y2: number, cls: string, back = false) =>
    `<g class="${cls}">${openLimb(c, x1, y1, x2, y2, 12, back ? c.shade : pawFill(c))}</g>`;
  let bp = `<path d="M34 130 C70 150 130 152 162 130 C150 146 120 150 96 150 C66 150 44 142 34 130 Z" fill="${c.shade}"/>`
    + `<ellipse cx="108" cy="132" rx="34" ry="9" fill="${c.white ? '#fbfaf7' : c.light}"/>`;
  if (c.stripe) bp += `<path d="M70 98 Q74 110 68 118 M92 98 Q96 110 90 118 M114 99 Q118 111 112 119" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="66" cy="112" rx="22" ry="13" fill="${c.patches[1]}"/><ellipse cx="128" cy="106" rx="16" ry="11" fill="${c.patches[0]}"/>`;
  const f = c.point ?? c.base;
  const T = 'M34 114 C14 106 0 118 -14 108 C-24 100 -28 94 -36 96';
  const s = 0.74;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<g class="all">`
    + `<g class="flytail"><path d="${T}" stroke="${c.line}" stroke-width="${10 + 2 * LW}" fill="none" stroke-linecap="round"/><path d="${T}" stroke="${f}" stroke-width="10" fill="none" stroke-linecap="round"/></g>`
    + limb(60, 138, 22, 150, 'legBL', true) + limb(130, 138, 172, 150, 'legFR', true)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + limb(70, 142, 30, 160, 'legBR') + limb(140, 140, 184, 158, 'legFL')
    + `<g style="transform:translate(66px,22px) rotate(4deg) scale(${s});transform-origin:100px 92px"><g class="head">${head(c, eyes, mood, uid, w, { size: 0.86, outer: s, turn: 0.5 })}</g></g>`
    + `</g>`;
}

/** Running flat out, side on (faces right like walk): a long low body that stretches and gathers, front legs as a
    pair and back legs as a pair (the gallop is CSS: `cRunF`/`cRunB`), head forward and level, tail streaming behind. */
function run(c: Coat, eyes: string, mood: Mood, uid: string, w = ''): string {
  const leg = (x: number, cls: string, back: boolean, far: boolean) => {
    const t = back ? 12 : 8.5;
    const edge = `M${x - t} 132 C${x - t} 156 ${x - 6} 170 ${x - 6} 180 Q${x - 7.5} 189 ${x + 1} 189 Q${x + 9.5} 189 ${x + 7} 180 C${x + 7} 170 ${x + t - 2} 154 ${x + t - 2} 132`;
    return `<g class="${cls}"><path d="${edge} Z" fill="${far ? c.shade : pawFill(c)}"/><path d="${edge}" fill="none" ${SW(c)}/></g>`;
  };
  const BODY = 'M172 122 C178 138 168 152 150 155 C126 158 94 158 72 156 C48 154 34 142 36 126 C38 110 54 104 78 106 C104 108 130 111 152 109 C163 108 169 114 172 122 Z';
  const s = 0.72;
  return `<defs><clipPath id="rb${uid}"><path d="${BODY}"/></clipPath></defs>`
    + shadow(104, 76)
    + `<g class="all">`
    + rigTail(c, 'M42 120 C26 116 12 114 0 116', 'M0 116 C-10 117 -18 114 -24 108', 1.2)
    + leg(68, 'legBL', true, true) + leg(142, 'legFR', false, true)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/>`
    + `<g clip-path="url(#rb${uid})"><path d="M52 150 C90 162 134 162 168 146 L176 172 L30 172 Z" fill="${c.shade}"/>`
    + `<ellipse cx="160" cy="136" rx="10" ry="14" fill="${c.white ? '#fbfaf7' : c.light}"/>`
    + (c.patches ? `<path d="M64 106 C86 100 106 110 104 128 C92 136 72 132 64 106 Z" fill="${c.patches[0]}"/><path d="M118 112 C136 108 152 114 148 130 C136 134 122 128 118 112 Z" fill="${c.patches[1]}"/>` : '')
    + (c.stripe ? `<path d="M76 108 Q80 120 74 130 M96 109 Q100 121 94 131 M116 111 Q120 123 114 133" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>` : '')
    + `</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + leg(84, 'legBR', true, false) + leg(156, 'legFL', false, false)
    + `<g style="transform:translate(116px,58px) scale(${s});transform-origin:0 0"><g class="r-head"><g class="head">${head(c, eyes, mood, uid, w, { size: 0.8, outer: s, turn: 1 })}</g></g></g></g>`;
}

/** Tucked into a ball mid-flip: one round body, the head tucked at the front, paws folded in, the tail wrapped round.
    Spun as a whole by the zoomies (it's airborne, so no shadow). */
function curl(c: Coat, eyes: string, uid: string, w = ''): string {
  const f = c.point ?? c.base;
  const s = 0.6;
  return `<defs><clipPath id="cb${uid}"><circle cx="100" cy="122" r="50"/></clipPath></defs>`
    + `<g class="all">`
    + `<path d="M58 152 C40 128 50 88 84 76" stroke="${c.line}" stroke-width="${10 + 2 * LW}" fill="none" stroke-linecap="round"/><path d="M58 152 C40 128 50 88 84 76" stroke="${f}" stroke-width="10" fill="none" stroke-linecap="round"/>`
    + `<g class="bodyg"><circle cx="100" cy="122" r="50" fill="${c.base}"/>`
    + `<g clip-path="url(#cb${uid})"><path d="M60 150 C90 176 140 170 152 130 L160 180 L50 180 Z" fill="${c.shade}"/>`
    + `<ellipse cx="126" cy="138" rx="20" ry="16" fill="${c.white ? '#fbfaf7' : c.light}"/>`
    + (c.stripe ? `<path d="M70 86 Q78 96 72 108 M88 76 Q96 88 90 100" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>` : '')
    + (c.patches ? `<ellipse cx="78" cy="104" rx="22" ry="18" fill="${c.patches[1]}"/>` : '')
    + `</g><circle cx="100" cy="122" r="50" fill="none" ${SW(c)}/></g>`
    + `<ellipse cx="118" cy="150" rx="11" ry="8" fill="${pawFill(c)}" ${SW(c)}/><ellipse cx="136" cy="140" rx="11" ry="8" fill="${pawFill(c)}" ${SW(c)}/>`
    + `<g style="transform:translate(86px,46px) scale(${s});transform-origin:0 0"><g class="r-head"><g class="head">${head(c, eyes, 'happy', uid, w, { size: 0.9, outer: s, turn: 0.6 })}</g></g></g>`
    + `</g>`;
}

/** Full after a meal, facing you: a round, satisfied belly with one paw patting it, eyes closed, and a little
    contented puff of air (the puff and the pat are CSS: `cPuff`, `cPat`). */
function full(c: Coat, eyes: string, uid: string, w = ''): string {
  const BODY = 'M100 110 C138 110 166 138 166 166 C166 182 156 190 140 190 L60 190 C44 190 34 182 34 166 C34 138 62 110 100 110 Z';
  let bp = '';
  if (c.stripe) bp += `<path d="M46 150 Q56 152 58 162 M154 150 Q144 152 142 162" stroke="${c.stripe}" stroke-width="${stripeW}" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="52" cy="160" rx="20" ry="22" fill="${c.patches[1]}"/><ellipse cx="148" cy="166" rx="18" ry="20" fill="${c.patches[0]}"/>`;
  bp += `<path d="M146 130 C172 152 166 196 128 194 C152 180 156 156 140 136 Z" fill="${c.shade}"/>`;
  bp += `<ellipse cx="102" cy="160" rx="38" ry="30" fill="${c.white ? '#fbfaf7' : c.light}"/>`;
  const foot = (x: number) => `<ellipse cx="${x}" cy="184" rx="17" ry="9" fill="${pawFill(c)}" ${SW(c)}/><path d="M${x - 5} 185 V189 M${x} 186 V190 M${x + 5} 185 V189" stroke="${c.line}" stroke-width="1.6" stroke-linecap="round"/>`;
  const tail = rigTail(c, 'M150 180 C170 182 172 196 150 196', 'M150 196 C130 197 106 198 80 195', 0.3);
  const k = SIT_HEAD.size;
  return `<defs><clipPath id="fb${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<g class="r-shadow">${shadow(100, 68)}</g>`
    + `<g class="r-all"><g class="all">`
    + tail
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#fb${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/>`
    + `<path d="M84 168 Q100 174 116 168" fill="none" ${SW(c, LW * 0.7)} opacity=".45"/></g>`
    + foot(64) + foot(136)
    + `<g class="pawRest">${openLimb(c, 136, 128, 142, 160, 16, pawFill(c))}</g>`
    + `<g class="pawPat">${openLimb(c, 70, 130, 96, 152, 16, pawFill(c))}</g>`
    + `<g transform="translate(0 ${SIT_HEAD.lift + 2})"><g class="r-head"><g class="head">${head(c, eyes, 'sleepy', uid, w, { size: k })}</g></g></g>`
    + `<g class="puff"><g transform="translate(122 106) scale(1.45) translate(-122 -106)"><path d="M118 104 H128 M117 110 H126" stroke="${c.line}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`
    + `<g fill="#fff" ${SW(c, 2.4)}><circle cx="136" cy="102" r="7"/><circle cx="145" cy="96" r="8"/><circle cx="147" cy="108" r="7"/><circle cx="155" cy="102" r="6"/></g>`
    + `<path d="M135 102 C137 97 143 93 148 96 M146 107 C150 109 154 106 155 102" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></g></g>`
    + `</g></g>`;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function chesterSVG(o: { pose?: Pose; coat?: string; eyes?: string; mood?: Mood; raised?: boolean; uid: string; anim?: string; width?: number; label?: string; extra?: string; wear?: string }): string {
  const w = o.wear ?? '';
  const c = COATS[o.coat ?? 'black'] ?? COATS.black;
  const pose = o.pose ?? 'sit';
  const mood = o.mood ?? 'curious';
  const body = pose === 'fly' ? fly(c, o.eyes ?? 'gold', mood, o.uid, w)
    : pose === 'run' ? run(c, o.eyes ?? 'gold', mood, o.uid, w)
    : pose === 'curl' ? curl(c, o.eyes ?? 'gold', o.uid, w)
    : pose === 'full' ? full(c, o.eyes ?? 'gold', o.uid, w)
    : pose === 'walk' ? walk(c, o.eyes ?? 'gold', mood, o.uid, w)
    : pose === 'ball' ? ball(c, o.eyes ?? 'gold', mood, o.uid, w)
    : pose === 'sleep' ? sleep(c, o.eyes ?? 'gold', o.uid, w)
    : pose === 'drape' ? drape(c, o.eyes ?? 'gold', o.uid, w)
    : pose === 'loaf' || pose === 'knead' ? loaf(c, o.eyes ?? 'gold', mood, o.uid, pose === 'knead', w)
    : sit(c, o.eyes ?? 'gold', mood, o.uid, !!o.raised && pose === 'sit', w, pose === 'doze');
  return `<svg class="kc pose-${pose} ${o.anim ?? ''}" viewBox="-14 -34 232 232" width="${o.width ?? 160}" role="img" aria-label="${esc(o.label ?? c.name + ' kitten')}" style="overflow:visible">${body}${o.extra ?? ''}</svg>`;
}
