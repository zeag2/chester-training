/* The four prop drawings (art layer; docs/design-system.md "Props"), ported from the props art kit (artifact
   STmR6cBuuEYyFGrYTkXtVi, paldex-art/props/src/props.ts, approved by Josh 2026-11-27). Use as drawn: don't
   recolour or redraw them in a screen. The scenes that use them are in propScenes.ts.

   Pal Dex props: donut cushion, scratching post, window perch, catnip kicker.
   Drawn in Chester's own pose space (the floor is y = 190, he stands round x = 100), so a scene just stacks
   prop back layer, Chester, prop front layer. Pastel fills, one #1f2440 outline, flat shade shapes, no gradients
   except the sky. Nothing here depends on his coat. */

export const LN = '#1f2440';
const W = 3;
export const st = (w = W, c = LN) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const C = {
  rose: '#ef8f9a', roseL: '#f7c3ca', pink: '#f6a9bd', pinkL: '#fbd2dd', pinkD: '#e48aa2',
  gold: '#efc44a', goldL: '#f8dd8a', sky: '#9fc0ea', skyL: '#cfe0f5', skyD: '#7fa6d8',
  mint: '#a9dcc9', mintL: '#d3eee3', mintD: '#82c4ab', lav: '#c3b5ea', lavL: '#e3dbf6', lavD: '#a293d6',
  dough: '#f2cf98', doughD: '#dfae6c', doughL: '#f9e4bf', sisal: '#ecd3a2', sisalD: '#c9a46a',
  cream: '#fbf6ec', creamD: '#eadfca', peach: '#f4b896', peachD: '#e0966f', white: '#ffffff',
};
const shadow = (cx: number, rx: number, cy = 191, ry = 6) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(29,35,64,.12)"/>`;

/** Smooth closed path through points (Catmull-Rom to cubic). */
function smooth(p: [number, number][]): string {
  const n = p.length; let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + ' Z';
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------------- Donut cushion ---------------- */
const DONUT_BODY = 'M-6 156 A106 32 0 0 1 206 156 L204 166 A104 30 0 0 1 -4 166 Z';
function frosting(): string {
  const pts: [number, number][] = [];
  const drips = [[0.35, 9], [0.62, 6], [0.9, 11], [1.18, 5], [1.5, 10], [1.85, 7], [2.15, 12], [2.5, 6], [2.8, 9]];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2; // 0 = right, pi/2 = front
    let ry = 25;
    if (Math.sin(a) > 0) for (const [da, h] of drips) ry += h * Math.exp(-((a - da) ** 2) / 0.012);
    const wob = 1 + 0.025 * Math.sin(a * 7);
    pts.push([100 + 96 * Math.cos(a) * wob, 150 + ry * Math.sin(a)]);
  }
  return smooth(pts);
}
const FROST = frosting();
const HOLE = 'M58 148 A42 11 0 1 1 142 148 A42 11 0 1 1 58 148 Z';
function sprinkles(): string {
  seed = 11; const cols = [C.gold, C.sky, C.mint, C.lav, C.white, C.gold, C.sky];
  let s = ''; let k = 0;
  for (let i = 0; i < 40 && k < 18; i++) {
    const a = rnd() * Math.PI * 2, r = 0.55 + rnd() * 0.38;
    const x = 100 + 92 * r * Math.cos(a), y = 150 + 23 * r * Math.sin(a);
    if (((x - 100) / 50) ** 2 + ((y - 148) / 15) ** 2 < 1) continue; // keep off the hole
    const rot = Math.round(rnd() * 180);
    s += `<rect x="${(x - 4.5).toFixed(1)}" y="${(y - 1.6).toFixed(1)}" width="9" height="3.2" rx="1.6" fill="${cols[k % cols.length]}" stroke="${LN}" stroke-width="1.1" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    k++;
  }
  return s;
}
const SPR = sprinkles();
function donutAll(id: string): string {
  return `<defs><clipPath id="db${id}"><path d="${DONUT_BODY}"/></clipPath><clipPath id="fr${id}"><path d="${FROST}"/></clipPath></defs>`
    + `<path d="${DONUT_BODY}" fill="${C.dough}"/>`
    + `<g clip-path="url(#db${id})"><path d="M-10 168 A110 26 0 0 0 210 168 L210 210 L-10 210 Z" fill="${C.doughD}"/><path d="M10 172 Q100 194 190 172" fill="none" stroke="${C.doughL}" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>`
    + `<path d="${DONUT_BODY}" fill="none" ${st()}/>`
    + `<path d="${FROST}" fill="${C.pink}"/>`
    + `<g clip-path="url(#fr${id})"><path d="M10 138 Q100 120 190 138 L190 128 L10 128 Z" fill="${C.pinkL}" opacity=".9"/><ellipse cx="160" cy="166" rx="34" ry="10" fill="${C.pinkD}" opacity=".55"/></g>`
    + `<path d="${FROST}" fill="none" ${st()}/>`
    + SPR
    + `<path d="${HOLE}" fill="${C.doughD}" ${st()}/>`
    + `<path d="M60 150 A42 9 0 0 0 140 150" fill="none" stroke="${C.dough}" stroke-width="4" stroke-linecap="round"/>`;
}
/** Back layer: the whole donut. Front layer: the part of it in front of the hole, so he sinks in. */
export function donut(id: string) {
  const back = shadow(100, 108, 192, 7) + `<g class="prop-donut">${donutAll(id + 'b')}</g>`;
  const front = `<defs><clipPath id="dfc${id}"><path d="M-30 148 L58 148 A42 11 0 0 0 142 148 L230 148 L230 220 L-30 220 Z"/></clipPath></defs>`
    + `<g clip-path="url(#dfc${id})"><g class="prop-donut">${donutAll(id + 'f')}</g></g>`;
  return { back, front };
}

/* ---------------- Scratching post ---------------- */
export const POST_X = 172;
export function post(id: string) {
  const x0 = POST_X - 18, x1 = POST_X + 18, top = -8, bot = 178;
  seed = 3;
  let rope = '';
  for (let y = top - 20; y < bot + 20; y += 8) rope += `M${x0 - 4} ${y + 6} L${x1 + 4} ${y - 4} `;
  const fluffs = [[x0 + 6, 40], [x1 - 6, 70], [x0 + 10, 118], [x1 - 8, 150]].map(([x, y]) => `<path d="M${x} ${y} q3 -4 6 0" fill="none" stroke="${C.sisalD}" stroke-width="1.8" stroke-linecap="round"/>`).join('');
  const base = `<path d="M${POST_X - 52} 178 A52 12 0 0 1 ${POST_X + 52} 178 L${POST_X + 52} 186 A52 12 0 0 1 ${POST_X - 52} 186 Z" fill="${C.mintD}" ${st()}/>`
    + `<ellipse cx="${POST_X}" cy="178" rx="52" ry="12" fill="${C.mint}" ${st()}/>`
    + `<ellipse cx="${POST_X - 14}" cy="175" rx="22" ry="4" fill="${C.mintL}"/>`;
  const pole = `<defs><clipPath id="pp${id}"><rect x="${x0}" y="${top}" width="36" height="${bot - top}"/></clipPath></defs>`
    + `<rect x="${x0}" y="${top}" width="36" height="${bot - top}" fill="${C.sisal}"/>`
    + `<g clip-path="url(#pp${id})"><path d="${rope}" stroke="${C.sisalD}" stroke-width="2.2" fill="none"/><rect x="${x1 - 10}" y="${top}" width="10" height="${bot - top}" fill="${C.sisalD}" opacity=".35"/>${fluffs}`
    + `<g class="marks"><path d="M${x0 + 8} 24 l4 22 M${x0 + 15} 22 l4 24 M${x0 + 22} 24 l4 22" stroke="${C.white}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/></g></g>`
    + `<rect x="${x0}" y="${top}" width="36" height="${bot - top}" fill="none" ${st()}/>`;
  const perch = `<path d="M${POST_X - 46} -14 A46 12 0 0 1 ${POST_X + 46} -14 L${POST_X + 46} -4 A46 12 0 0 1 ${POST_X - 46} -4 Z" fill="${C.lavD}" ${st()}/>`
    + `<ellipse cx="${POST_X}" cy="-14" rx="46" ry="12" fill="${C.lav}" ${st()}/>`
    + `<ellipse cx="${POST_X}" cy="-14" rx="34" ry="7" fill="none" stroke="${C.lavL}" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>`;
  // pom-pom on a string, hanging from the perch's right edge (swings about its top)
  const pomBurst = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const r = i % 2 ? 9 : 12.5; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]; });
  const pom = `<g class="pom"><path d="M${POST_X + 40} -6 C${POST_X + 44} 40 ${POST_X + 40} 90 ${POST_X + 44} 126" fill="none" ${st(2)}/>`
    + `<g transform="translate(${POST_X + 44} 136)"><path d="${smooth(pomBurst)}" fill="${C.rose}" ${st(2.4)}/><circle cx="-3" cy="-3" r="4" fill="${C.roseL}"/></g></g>`;
  const back = shadow(POST_X, 60, 188, 7) + `<g class="prop-post">${base}${pole}${perch}</g>`;
  return { back, pom, front: '' };
}

/* ---------------- Window perch ---------------- */
// window glass spans x -6..206, y -64..128; sill top y = 146; perch cushion top y = 136
export const PERCH_FLOOR = 140;
export function perch(id: string, o: { rain?: boolean } = {}) {
  const GL = 'M-6 128 V-4 A106 62 0 0 1 206 -4 V128 Z';
  const FR = 'M-20 136 V-6 A120 74 0 0 1 220 -6 V136 Z';
  const cloud = (x: number, y: number, s: number) => `<path transform="translate(${x} ${y}) scale(${s})" d="M-24 8 C-34 8 -34 -6 -22 -6 C-20 -18 -2 -20 4 -10 C10 -18 26 -14 24 -2 C34 -2 34 8 24 8 Z" fill="#fff" ${st(2 / s)}/>`;
  const sky = `<defs><linearGradient id="sk${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.rain ? '#a9b6cc' : '#a9cdf0'}"/><stop offset="1" stop-color="${o.rain ? '#d6dce8' : '#e6f1fb'}"/></linearGradient><clipPath id="gl${id}"><path d="${GL}"/></clipPath></defs>`;
  const glass = `<path d="${GL}" fill="url(#sk${id})"/>`
    + `<g clip-path="url(#gl${id})">`
    + `<g class="clouds">${cloud(30, 4, 1)}${cloud(150, 40, 0.8)}${cloud(260, 10, 0.9)}</g>`
    + (o.rain ? '' : `<circle cx="168" cy="-26" r="15" fill="${C.goldL}" ${st(2)}/>`)
    + `<path d="M-6 112 C40 100 70 108 110 100 C150 92 180 104 206 98 V130 H-6 Z" fill="${C.mint}" ${st(2)}/>`
    + `<path d="M-6 120 C50 112 90 122 140 114 C170 110 190 116 206 112 V130 H-6 Z" fill="${C.mintD}"/>`
    + `<g class="birdlayer"></g>`
    + (o.rain ? `<g class="rain">${Array.from({ length: 22 }, (_, i) => { seed = 50 + i; const x = -6 + rnd() * 220, y = -70 + rnd() * 190; return `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l-4 12" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`; }).join('')}</g>` : '')
    + `<path d="M8 -30 L28 -48 M14 -16 L44 -44" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>`
    + `</g>`;
  const frame = `<path d="${FR} ${GL}" fill="${C.cream}" fill-rule="evenodd" ${st()}/>`
    + `<path d="M100 -66 V128 M-6 40 H206" stroke="${C.cream}" stroke-width="8"/><path d="M96 -66 V128 M104 -66 V128 M-6 36 H96 M104 36 H206 M-6 44 H96 M104 44 H206" stroke="${LN}" stroke-width="2"/>`;
  const curtain = (flip: boolean) => `<g transform="${flip ? 'translate(200 0) scale(-1 1)' : ''}"><path d="M-40 -84 C-20 -80 6 -82 24 -84 C22 -40 18 0 4 30 C14 70 6 120 -14 168 L-44 168 Z" fill="${C.lav}" ${st()}/>`
    + `<path d="M-26 -78 C-24 -40 -14 0 -8 30 M-10 -80 C-4 -40 2 0 2 28 M-30 60 C-28 100 -30 130 -32 166" fill="none" stroke="${C.lavD}" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M-12 22 C-2 20 10 24 14 32 C8 40 -6 40 -14 36 Z" fill="${C.rose}" ${st(2.4)}/></g>`;
  const rod = `<rect x="-58" y="-92" width="316" height="8" rx="4" fill="${C.peach}" ${st(2.4)}/><circle cx="-58" cy="-88" r="7" fill="${C.peach}" ${st(2.4)}/><circle cx="258" cy="-88" r="7" fill="${C.peach}" ${st(2.4)}/>`;
  const sill = `<rect x="-36" y="134" width="272" height="16" rx="5" fill="${C.cream}" ${st()}/><rect x="-26" y="150" width="252" height="8" rx="3" fill="${C.creamD}" ${st(2.4)}/>`;
  const cushion = `<path d="M6 140 C2 128 12 122 26 124 L176 124 C190 122 200 128 196 140 C200 150 188 152 176 150 L26 150 C12 152 2 150 6 140 Z" fill="${C.sky}" ${st()}/>`
    + `<path d="M20 128 Q100 120 182 128" fill="none" stroke="${C.skyL}" stroke-width="4" stroke-linecap="round"/>`
    + `<path d="M40 137 h4 M70 137 h4 M100 137 h4 M130 137 h4 M160 137 h4" stroke="${C.skyD}" stroke-width="3" stroke-linecap="round"/>`;
  const plant = `<g transform="translate(222 134)"><path d="M-8 -14 C-20 -30 -14 -44 -4 -48 C-2 -34 -2 -24 -4 -14 Z M4 -14 C6 -32 18 -40 26 -38 C22 -26 14 -18 6 -12 Z M-2 -14 C-4 -30 2 -50 8 -56 C14 -44 10 -28 2 -14 Z" fill="${C.mint}" ${st(2.4)}/>`
    + `<path d="M-15 -14 H15 L11 0 H-11 Z" fill="${C.peach}" ${st(2.4)}/><path d="M-16 -16 H16 V-10 H-16 Z" fill="${C.peachD}" ${st(2.4)}/></g>`;
  const beam = o.rain ? '' : `<g class="beam"><path d="M30 -60 L120 -64 L196 128 L56 150 Z" fill="${C.goldL}" opacity=".32"/>`
    + `<g class="motes">${[[80, 10], [110, 50], [96, 90], [130, 20], [140, 100]].map(([x, y], i) => `<circle class="m${i}" cx="${x}" cy="${y}" r="2.2" fill="#fff"/>`).join('')}</g></g>`;
  const back = `<g class="prop-perch">${sky}${glass}${frame}${rod}${curtain(false)}${curtain(true)}${sill}${cushion}${plant}${beam}</g>`;
  const front = '';
  return { back, front, glassClip: `gl${id}` };
}
export const bird = (cls = 'bird') => `<g class="${cls}"><g class="bb"><ellipse cx="0" cy="0" rx="10" ry="8" fill="${C.rose}" ${st(2)}/><path d="M9 -2 L15 0 L9 2 Z" fill="${C.gold}" ${st(1.4)}/><circle cx="4" cy="-2" r="1.4" fill="${LN}"/><path d="M-10 0 L-16 -4 L-15 3 Z" fill="${C.rose}" ${st(1.6)}/>`
  + `<path class="wing" d="M-4 -2 C-8 -12 2 -14 4 -4 Z" fill="${C.roseL}" ${st(1.6)}/></g></g>`;
export const butterfly = () => `<g class="bfly"><g class="bf"><path d="M0 0 C-10 -12 -16 -2 -8 2 C-14 8 -6 12 0 4 C6 12 14 8 8 2 C16 -2 10 -12 0 0 Z" fill="${C.lav}" ${st(1.6)}/><path d="M0 -4 V6" ${st(1.6)}/></g></g>`;

/* ---------------- Catnip kicker (a plush pickle) ---------------- */
export function pickle(x: number, y: number, rot = 0, s = 1, cls = 'pickle') {
  seed = 21;
  const BODY = 'M-58 -4 C-58 -18 -44 -21 -24 -19 C4 -16 34 -21 50 -15 C64 -10 64 8 50 14 C34 20 4 16 -24 19 C-44 21 -58 14 -58 -4 Z';
  let bumps = '';
  for (let i = 0; i < 11; i++) { const bx = -46 + i * 9 + rnd() * 3, by = (i % 2 ? -9 : 7) + rnd() * 3; bumps += `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="2.6" ry="2" fill="${C.mintD}"/>`; }
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><g class="${cls}">`
    + `<path d="M-56 -2 C-64 -12 -74 -10 -72 -2 C-74 6 -64 8 -56 -2 Z M-56 -2 C-62 6 -64 14 -58 16" fill="${C.lav}" ${st(2.2 / s)}/>`
    + `<path d="${BODY}" fill="${C.mint}"/><path d="M-50 10 C-20 18 20 18 54 10 C46 18 20 22 -24 20 C-40 21 -52 18 -50 10 Z" fill="${C.mintD}" opacity=".7"/>${bumps}`
    + `<path d="M-44 -2 C-10 1 20 -3 40 -1" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>`
    + `<path d="${BODY}" fill="none" ${st(W / s)}/>`
    + `<circle cx="38" cy="-5" r="2.4" fill="${LN}"/><circle cx="50" cy="-5" r="2.4" fill="${LN}"/><path d="M41 2 Q44 5 47 2" fill="none" ${st(1.8 / s)}/><ellipse cx="33" cy="2" rx="3.6" ry="2.2" fill="${C.rose}" opacity=".8"/><ellipse cx="55" cy="2" rx="3" ry="2" fill="${C.rose}" opacity=".8"/>`
    + `</g></g>`;
}
export const leaf = (x: number, y: number, s = 1, cls = '') => `<path class="${cls}" transform="translate(${x} ${y}) scale(${s})" d="M0 6 C-8 0 -6 -10 0 -12 C6 -10 8 0 0 6 Z M0 6 V-8" fill="${C.mint}" ${st(1.8 / s)}/>`;
export const heart = (x: number, y: number, s = 1, cls = '', fill = C.rose) => `<path class="${cls}" transform="translate(${x} ${y}) scale(${s})" d="M0 8 C-7 3 -10 0 -10 -4 A4.6 4.6 0 0 1 0 -6 A4.6 4.6 0 0 1 10 -4 C10 0 7 3 0 8 Z" fill="${fill}" ${st(2 / s)}/>`;
export const spark = (x: number, y: number, s = 1, cls = '', fill = '#fff') => `<path class="${cls}" transform="translate(${x} ${y}) scale(${s})" d="M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7 Z" fill="${fill}" ${st(1.6 / s)}/>`;

/* ---------------- Shop icons, 48 px (like the corner's ToyArt) ---------------- */
export const ICONS: Record<string, string> = {
  donut: `<ellipse cx="24" cy="28" rx="20" ry="10" fill="${C.dough}" ${st(2.2)}/><path d="M5 25 C6 18 14 15 24 15 C34 15 42 18 43 25 C40 28 38 26 35 29 C31 27 28 30 24 29 C20 31 16 27 12 29 C9 27 7 28 5 25 Z" fill="${C.pink}" ${st(2.2)}/><ellipse cx="24" cy="23" rx="7" ry="2.6" fill="${C.doughD}" ${st(1.8)}/><path d="M12 21 l3 -1 M33 20 l3 1 M17 27 l2 1 M30 27 l3 -1" stroke="${C.gold}" stroke-width="2.4" stroke-linecap="round"/>`,
  post: `<ellipse cx="24" cy="41" rx="15" ry="4" fill="${C.mint}" ${st(2.2)}/><rect x="18" y="10" width="12" height="31" fill="${C.sisal}" ${st(2.2)}/><path d="M18 18 L30 14 M18 25 L30 21 M18 32 L30 28 M18 39 L30 35" stroke="${C.sisalD}" stroke-width="1.6"/><ellipse cx="24" cy="10" rx="14" ry="4" fill="${C.lav}" ${st(2.2)}/><path d="M36 11 V24" ${st(1.6)}/><circle cx="36" cy="27" r="4" fill="${C.rose}" ${st(1.8)}/>`,
  perch: `<path d="M6 34 V14 A18 11 0 0 1 42 14 V34 Z" fill="${C.skyL}" ${st(2.2)}/><path d="M24 4 V34 M6 20 H42" stroke="${LN}" stroke-width="1.8"/><path d="M4 34 H44 V40 H4 Z" fill="${C.cream}" ${st(2.2)}/><path d="M9 33 Q24 28 39 33" fill="${C.sky}" ${st(1.8)}/><path d="M12 8 L36 6 L40 30 L14 32 Z" fill="${C.goldL}" opacity=".5"/>`,
  kicker: pickle(25, 25, -32, 0.33, 'pk'),
};
