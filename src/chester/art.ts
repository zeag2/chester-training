/* Chester: original chibi art, navy outlines, two-tone flat shading, glossy eyes.
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
export type Pose = 'sit' | 'walk' | 'ball' | 'sleep' | 'loaf' | 'knead' | 'fly';

const SW = (c: Coat, w = 4) => `stroke="${c.line}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const HEAD = 'M100 34 C150 34 162 66 162 92 C162 124 134 140 100 140 C66 140 38 124 38 92 C38 66 50 34 100 34 Z';

/** Head drawn around center (100, 92). */
export function head(c: Coat, eyeKey: string, mood: Mood, uid: string): string {
  const e = EYES[eyeKey] ?? EYES.gold;
  const ear = c.point ?? c.base;
  let hp = '';
  if (c.stripe) hp += `<path d="M92 40 L94 54 M100 37 V53 M108 40 L106 54 M40 92 H54 M42 102 L55 100 M160 92 H146 M158 102 L145 100" stroke="${c.stripe}" stroke-width="5" stroke-linecap="round"/>`;
  if (c.patches) hp += `<path d="M30 30 C70 20 92 40 90 62 C80 84 50 84 30 76 Z" fill="${c.patches[0]}"/><path d="M114 34 C140 26 168 40 170 70 C150 76 122 66 114 34 Z" fill="${c.patches[1]}"/>`;
  hp += `<path d="M162 72 C168 114 140 148 90 148 C130 136 154 112 150 76 Z" fill="${c.shade}"/>`;
  hp += `<ellipse cx="100" cy="112" rx="${c.white ? 30 : 24}" ry="${c.white ? 24 : 15}" fill="${c.white ? '#fbfaf7' : c.light}"/>`;
  if (c.point) hp += `<ellipse cx="100" cy="104" rx="34" ry="26" fill="${c.point}"/>`;
  hp += `<ellipse cx="72" cy="52" rx="24" ry="10" fill="#ffffff" opacity="${c.base === '#353746' || c.base === '#3d3330' ? 0.12 : 0.4}" transform="rotate(-18 72 52)"/>`;
  let eyes: string;
  const dark = '#1a1d2e';
  if (mood === 'happy') {
    eyes = `<path d="M62 92 Q74 78 86 92 M114 92 Q126 78 138 92" stroke="${c.line}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  } else if (mood === 'sleepy') {
    eyes = `<path d="M62 90 Q74 98 86 90 M114 90 Q126 98 138 90" stroke="${c.line}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes = '';
    for (const [cx, ring] of [[74, e.ring], [126, e.ring2 ?? e.ring]] as const) {
      eyes += `<ellipse cx="${cx}" cy="89" rx="14.5" ry="16" fill="${ring}" stroke="${c.line}" stroke-width="3.2"/>`;
    }
    eyes += '<g class="look"><g class="pupils">';
    for (const cx of [74, 126]) {
      eyes += `<ellipse cx="${cx}" cy="90" rx="11" ry="12.8" fill="${dark}"/><ellipse cx="${cx - 1}" cy="97" rx="7" ry="4" fill="#2e3352"/>`
        + `<circle cx="${cx + 4.5}" cy="83" r="4.8" fill="#fff"/><circle cx="${cx - 4.5}" cy="96" r="2.2" fill="#fff"/><circle cx="${cx + 6}" cy="94" r="1.2" fill="#fff" opacity=".8"/>`;
    }
    eyes += '</g></g>';
  }
  const mouth = mood === 'open'
    ? `<path d="M90 113 Q100 132 110 113 Z" fill="#7a2f3a" stroke="${c.line}" stroke-width="3" stroke-linejoin="round"/><path d="M94 122 Q100 128 106 122" fill="#ef8f9a"/>`
    : `<path class="mclosed" d="M90 113 Q95 120 100 113 Q105 120 110 113" stroke="${c.line}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      + `<path class="tongue" style="transform:scaleY(0)" d="M96 114 H104 V119 A4 4 0 0 1 96 119 Z" fill="#ef8f9a" stroke="${c.line}" stroke-width="2"/>`
      + `<g class="mopen" style="transform:scale(0)"><ellipse cx="100" cy="120" rx="12" ry="15" fill="#7a2f3a" stroke="${c.line}" stroke-width="3"/><ellipse cx="100" cy="128" rx="7" ry="5" fill="#ef8f9a"/></g>`;
  return `<defs><clipPath id="hc${uid}"><path d="${HEAD}"/></clipPath></defs>`
    + `<g class="r-earL"><g class="earL"><path d="M44 70 L40 22 C40 16 46 14 50 18 L84 42 Z" fill="${ear}" ${SW(c)}/><path d="M50 58 L48 30 L72 46 Z" fill="${c.inner}"/></g></g>`
    + `<g class="r-earR"><g class="earR"><path d="M156 70 L160 22 C160 16 154 14 150 18 L116 42 Z" fill="${ear}" ${SW(c)}/><path d="M150 58 L152 30 L128 46 Z" fill="${c.inner}"/></g></g>`
    + `<path d="${HEAD}" fill="${c.base}"/><g clip-path="url(#hc${uid})">${hp}</g><path d="${HEAD}" fill="none" ${SW(c)}/>`
    + `<g class="blush"><ellipse cx="54" cy="110" rx="11" ry="6.5" fill="#f592a3" opacity=".75"/><ellipse cx="146" cy="110" rx="11" ry="6.5" fill="#f592a3" opacity=".75"/></g>`
    + `<g class="eyes">${eyes}</g>`
    + (mood === 'sleepy' ? '' : `<g class="eyesJoy"><path d="M62 92 Q74 78 86 92 M114 92 Q126 78 138 92" stroke="${c.line}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`)
    + `<path d="M95 104 H105 C105 108 102 110 100 111 C98 110 95 108 95 104 Z" fill="${c.nose}" stroke="${c.line}" stroke-width="2" stroke-linejoin="round"/>`
    + mouth
    + `<g class="whisk"><path d="M28 100 L46 104 M28 113 L46 111 M172 100 L154 104 M172 113 L154 111" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round"/></g>`;
}

/** Tail drawn as one smooth chain the rig bends every frame (outline under fill, so no seams). */
const rigTail = (c: Coat, d1?: string, d2?: string, amp = 1) => { const curves = d1 && d2 ? curvesOf(d1, d2) : undefined; const d = restTailPath(curves); const f = c.point ?? c.base;
  return `<g class="rtail"${curves ? ` data-tail='${JSON.stringify(curves)}'` : ''} data-amp="${amp}"><path class="rt-o" d="${d}" stroke="${c.line}" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path class="rt-f" d="${d}" stroke="${f}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`; };
const pad = '#f3a9b6';
const pawFill = (c: Coat) => (c.white ? '#fbfaf7' : c.point ?? c.base);

function sit(c: Coat, eyes: string, mood: Mood, uid: string, raised: boolean): string {
  const BODY = 'M64 186 C58 160 66 130 100 128 C134 130 142 160 136 186 Z';
  let bp = '';
  if (c.stripe) bp += `<path d="M66 150 Q76 152 78 160 M134 150 Q124 152 122 160 M62 168 Q72 170 74 178" stroke="${c.stripe}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="70" cy="150" rx="22" ry="16" fill="${c.patches[1]}"/><ellipse cx="136" cy="172" rx="20" ry="18" fill="${c.patches[0]}"/>`;
  bp += `<path d="M140 146 C148 176 134 194 108 194 C128 182 134 166 132 142 Z" fill="${c.shade}"/>`;
  const leg = (x: number) => `<rect x="${x - 11}" y="146" width="22" height="42" rx="11" fill="${pawFill(c)}" ${SW(c)}/><path d="M${x - 4} 182 V187 M${x + 4} 182 V187" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round"/>`;
  const right = raised
    ? `<g class="pawR raised" style="transform:rotate(-160deg)"><rect x="117" y="148" width="22" height="58" rx="11" fill="${pawFill(c)}" ${SW(c)}/><ellipse cx="128" cy="189" rx="6.5" ry="5.5" fill="${pad}"/><circle cx="121.5" cy="197.5" r="2.7" fill="${pad}"/><circle cx="128" cy="200" r="2.7" fill="${pad}"/><circle cx="134.5" cy="197.5" r="2.7" fill="${pad}"/></g>`
    : `<g class="pawR"><g class="r-legR">${leg(121)}</g></g>`;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<g class="r-shadow"><ellipse class="shadow" cx="100" cy="190" rx="58" ry="6.5" fill="rgba(29,35,64,.12)"/></g>`
    + `<g class="r-all"><g class="all">${rigTail(c)}`
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}<ellipse cx="100" cy="172" rx="22" ry="27" fill="${c.white ? '#fbfaf7' : c.light}"/></g><path d="${BODY}" fill="none" ${SW(c)}/><g class="pawL"><g class="r-legL">${leg(79)}</g></g></g>`
    + `<g class="r-head"><g class="head">${head(c, eyes, mood, uid)}</g></g>${right}</g></g>`;
}

function walk(c: Coat, eyes: string, mood: Mood, uid: string): string {
  const leg = (x: number, cls: string, back = false) => `<g class="${cls}"><rect x="${x - 10}" y="140" width="20" height="48" rx="10" fill="${back ? c.shade : pawFill(c)}" ${SW(c)}/></g>`;
  return `<ellipse class="shadow" cx="112" cy="190" rx="78" ry="6.5" fill="rgba(29,35,64,.12)"/>`
    + `<g class="all">`
    + rigTail(c, 'M58 132 C34 128 26 104 32 84', 'M32 84 C36 66 50 60 58 66', 1.2)
    + leg(78, 'legBL', true) + leg(140, 'legFR', true)
    + `<g class="bodyg"><ellipse cx="108" cy="142" rx="60" ry="34" fill="${c.base}" ${SW(c)}/>`
    + `<path d="M70 160 C90 176 130 176 150 160 C138 168 92 170 70 160 Z" fill="${c.shade}"/><ellipse cx="132" cy="150" rx="20" ry="16" fill="${c.white ? '#fbfaf7' : c.light}"/>`
    + (c.stripe ? `<path d="M88 112 Q92 124 86 132 M104 110 Q108 122 102 130 M120 112 Q124 122 118 130" stroke="${c.stripe}" stroke-width="5" fill="none" stroke-linecap="round"/>` : '')
    + `</g>` + leg(96, 'legBR') + leg(156, 'legFL')
    + `<g style="transform:translate(78px,-6px) scale(.84);transform-origin:0 0"><g class="r-head"><g class="head">${head(c, eyes, mood, uid)}</g></g></g></g>`;
}

function ball(c: Coat, eyes: string, mood: Mood, uid: string): string {
  const limb = (x1: number, y1: number, x2: number, y2: number, cls: string) =>
    `<g class="${cls}"><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c.line}" stroke-width="24" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${pawFill(c)}" stroke-width="16" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="4" fill="${pad}"/></g>`;
  return `<ellipse class="shadow" cx="112" cy="190" rx="84" ry="7" fill="rgba(29,35,64,.12)"/>`
    + `<g class="all">`
    + rigTail(c, 'M168 168 C196 164 206 136 196 110', 'M196 110 C190 92 176 88 168 96', 1.4)
    + `<g class="bodyg"><ellipse cx="124" cy="150" rx="62" ry="40" fill="${c.base}" ${SW(c)} transform="rotate(-12 124 150)"/>`
    + `<ellipse cx="128" cy="140" rx="38" ry="24" fill="${c.white ? '#fbfaf7' : c.light}" transform="rotate(-12 128 140)"/>`
    + `<path d="M74 176 C110 196 160 190 182 160 C170 186 112 196 74 176 Z" fill="${c.shade}"/></g>`
    + limb(150, 140, 168, 96, 'kickB') + limb(170, 146, 192, 112, 'kickA')
    + `<g class="yarn"><circle cx="132" cy="80" r="24" fill="#ef8f9a" stroke="${c.line}" stroke-width="4"/><path d="M106 70 C120 78 136 74 150 84 M104 84 C118 80 132 92 146 96 M118 54 C126 66 132 84 130 104" stroke="#c45466" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M112 62 C118 56 126 54 132 54" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".6"/></g>`
    + limb(112, 132, 116, 98, 'armA') + limb(134, 128, 148, 100, 'armB')
    + `<g style="transform:translate(-44px,50px) rotate(-16deg) scale(.74);transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, mood === 'curious' ? 'open' : mood, uid)}</g></g></g></g>`;
}

/** Curled donut nap: round body, head tucked low in front on a paw, tail wrapped around the front. Only the back breathes.
    A snot bubble lives on the nose and shows with the "night" anim. */
function sleep(c: Coat, eyes: string, uid: string): string {
  const BODY = 'M46 188 C34 140 78 100 126 102 C178 104 204 146 192 188 Z';
  let bp = `<path d="M196 150 C200 186 176 198 132 194 C176 182 190 160 182 118 Z" fill="${c.shade}"/>`
    + `<path d="M84 116 C110 102 150 104 172 120" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="${c.base === '#353746' || c.base === '#3d3330' ? 0.1 : 0.35}"/>`;
  if (c.stripe) bp += `<path d="M120 104 Q126 118 118 128 M146 106 Q152 120 144 132 M170 118 Q174 130 166 138" stroke="${c.stripe}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="150" cy="122" rx="34" ry="20" fill="${c.patches[1]}"/><ellipse cx="186" cy="170" rx="18" ry="18" fill="${c.patches[0]}"/>`;
  const snot = `<g class="snot"><circle cx="112" cy="116" r="10" fill="rgba(196,228,255,.55)" stroke="#8fc0e6" stroke-width="2"/><circle cx="108" cy="112" r="2.6" fill="#fff"/></g>`;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<ellipse class="shadow" cx="118" cy="191" rx="90" ry="7" fill="rgba(29,35,64,.12)"/>`
    + `<g class="r-all"><g class="all"><g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/>`
    + `<path d="M156 132 C180 144 182 172 160 184" stroke="${c.line}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/></g>`
    + rigTail(c, 'M188 182 C180 200 132 202 106 196', 'M106 196 C90 194 78 190 72 182', 0.35)
    + `<ellipse cx="104" cy="186" rx="16" ry="7" fill="${pawFill(c)}" ${SW(c, 3.5)}/>`
    + `<g style="transform:translate(-30px,52px) rotate(-10deg) scale(.72);transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, 'sleepy', uid)}${snot}</g></g></g>`
    + `<g class="zz"><text x="150" y="70" font-size="28" font-weight="800" fill="#4a5590" font-family="Nunito,sans-serif">z</text><text x="170" y="46" font-size="20" font-weight="800" fill="#7a86b8" font-family="Nunito,sans-serif">z</text><text x="186" y="28" font-size="14" font-weight="800" fill="#a4add0" font-family="Nunito,sans-serif">z</text></g></g></g>`;
}

/** Bread loaf: one low dome, head tucked into the front, paws peeking under the chin, tail wrapped along the floor.
    knead = the same loaf standing on a pink pillow, paws pressing in turn. */
function loaf(c: Coat, eyes: string, mood: Mood, uid: string, knead = false): string {
  const BODY = 'M24 188 C14 150 34 112 92 104 C150 96 204 116 212 156 C216 176 210 188 200 188 Z';
  let bp = `<path d="M212 150 C214 184 196 196 150 192 C190 180 204 160 200 128 Z" fill="${c.shade}"/>`
    + `<path d="M118 112 C150 104 184 112 200 132" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity="${c.base === '#353746' || c.base === '#3d3330' ? 0.1 : 0.35}"/>`;
  if (c.stripe) bp += `<path d="M132 104 Q138 118 130 128 M156 104 Q162 118 154 130 M180 112 Q184 124 176 134" stroke="${c.stripe}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="160" cy="124" rx="34" ry="20" fill="${c.patches[1]}"/><ellipse cx="196" cy="168" rx="20" ry="18" fill="${c.patches[0]}"/>`;
  const paw = (x: number, cls = '') => `<g${cls ? ` class="${cls}"` : ''}><path d="M${x - 16} 189 C${x - 17} 170 ${x + 17} 170 ${x + 16} 189 Z" fill="${pawFill(c)}" ${SW(c, 3.5)}/><path d="M${x - 5} 181 V187 M${x + 5} 181 V187" stroke="${c.line}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  const leg = (x: number, cls: string) => `<g class="${cls}"><rect x="${x - 13}" y="164" width="26" height="32" rx="13" fill="${pawFill(c)}" ${SW(c, 3.5)}/><path d="M${x - 5} 188 V194 M${x + 5} 188 V194" stroke="${c.line}" stroke-width="2.2" stroke-linecap="round"/></g>`;
  const cat = `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + (knead ? leg(66, 'kneadL') + leg(104, 'kneadR') : '')
    + `<g style="transform:translate(-18px,40px) scale(.84);transform-origin:100px 92px"><g class="r-head"><g class="head">${head(c, eyes, mood, uid)}</g></g></g>`
    + (knead ? '' : paw(64) + paw(100))
    + rigTail(c, 'M200 172 C218 186 204 188 180 186', 'M180 186 C164 186 154 184 148 176', 0.5);
  const defs = `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`;
  if (!knead) return defs + `<ellipse class="shadow" cx="114" cy="191" rx="102" ry="7" fill="rgba(29,35,64,.12)"/><g class="r-all"><g class="all">${cat}</g></g>`;
  const P = '#f6a9bd', PS = '#e88aa3', PL = '#8f3e58';
  return defs + `<ellipse cx="112" cy="200" rx="108" ry="5" fill="rgba(29,35,64,.12)"/>`
    + `<g class="pillow"><path d="M8 184 C0 168 14 162 28 168 C70 158 156 158 198 168 C212 162 226 168 218 184 C226 198 212 204 198 198 C156 206 70 206 28 198 C14 204 0 198 8 184 Z" fill="${P}" stroke="${PL}" stroke-width="3.5" stroke-linejoin="round"/>`
    + `<path d="M30 192 C80 200 150 200 196 192" stroke="${PS}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    + `<ellipse class="dentL" cx="66" cy="174" rx="18" ry="4" fill="${PS}"/><ellipse class="dentR" cx="104" cy="174" rx="18" ry="4" fill="${PS}"/></g>`
    + `<g class="r-all"><g class="all"><g style="transform:translateY(-20px)">${cat}</g></g></g>`;
}

/** Flying, superhero style: body stretched flat, head at the front at body height, front paws reaching forward,
    back legs kicked out behind, tail streaming back. Faces right. */
function fly(c: Coat, eyes: string, mood: Mood, uid: string): string {
  const BODY = 'M34 118 C34 98 66 92 104 94 C138 96 158 102 160 120 C162 140 136 148 100 148 C62 148 34 140 34 118 Z';
  const limb = (x1: number, y1: number, x2: number, y2: number, cls: string, back = false) =>
    `<g class="${cls}"><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c.line}" stroke-width="22" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${back ? c.shade : pawFill(c)}" stroke-width="14" stroke-linecap="round"/></g>`;
  let bp = `<path d="M40 128 C70 150 130 152 158 128 C150 146 120 152 96 152 C66 152 44 142 40 128 Z" fill="${c.shade}"/>`
    + `<ellipse cx="104" cy="132" rx="36" ry="11" fill="${c.white ? '#fbfaf7' : c.light}"/>`;
  if (c.stripe) bp += `<path d="M76 96 Q80 108 74 116 M96 94 Q100 106 94 114 M116 96 Q120 108 114 116" stroke="${c.stripe}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (c.patches) bp += `<ellipse cx="70" cy="110" rx="22" ry="14" fill="${c.patches[1]}"/><ellipse cx="128" cy="104" rx="16" ry="12" fill="${c.patches[0]}"/>`;
  const f = c.point ?? c.base;
  return `<defs><clipPath id="bc${uid}"><path d="${BODY}"/></clipPath></defs>`
    + `<g class="all">`
    + `<g class="flytail"><path d="M40 112 C20 104 6 116 -8 106 C-18 98 -22 92 -30 94" stroke="${c.line}" stroke-width="20" fill="none" stroke-linecap="round"/><path d="M40 112 C20 104 6 116 -8 106 C-18 98 -22 92 -30 94" stroke="${f}" stroke-width="12" fill="none" stroke-linecap="round"/></g>`
    + limb(60, 138, 22, 150, 'legBL', true) + limb(130, 138, 172, 150, 'legFR', true)
    + `<g class="bodyg"><path d="${BODY}" fill="${c.base}"/><g clip-path="url(#bc${uid})">${bp}</g><path d="${BODY}" fill="none" ${SW(c)}/></g>`
    + limb(70, 142, 30, 160, 'legBR') + limb(140, 140, 184, 158, 'legFL')
    + `<g style="transform:translate(62px,14px) rotate(4deg) scale(.8);transform-origin:100px 92px"><g class="head">${head(c, eyes, mood, uid)}</g></g>`
    + `</g>`;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function chesterSVG(o: { pose?: Pose; coat?: string; eyes?: string; mood?: Mood; raised?: boolean; uid: string; anim?: string; width?: number; label?: string; extra?: string }): string {
  const c = COATS[o.coat ?? 'black'] ?? COATS.black;
  const pose = o.pose ?? 'sit';
  const mood = o.mood ?? 'curious';
  const body = pose === 'fly' ? fly(c, o.eyes ?? 'gold', mood, o.uid)
    : pose === 'walk' ? walk(c, o.eyes ?? 'gold', mood, o.uid)
    : pose === 'ball' ? ball(c, o.eyes ?? 'gold', mood, o.uid)
    : pose === 'sleep' ? sleep(c, o.eyes ?? 'gold', o.uid)
    : pose === 'loaf' || pose === 'knead' ? loaf(c, o.eyes ?? 'gold', mood, o.uid, pose === 'knead')
    : sit(c, o.eyes ?? 'gold', mood, o.uid, !!o.raised);
  return `<svg class="kc pose-${pose} ${o.anim ?? ''}" viewBox="-14 -34 232 232" width="${o.width ?? 160}" role="img" aria-label="${esc(o.label ?? c.name + ' kitten')}" style="overflow:visible">${body}${o.extra ?? ''}</svg>`;
}
