/* The 20 prop moves, as scenes, ported from the props art kit (artifact STmR6cBuuEYyFGrYTkXtVi,
   paldex-art/props/src/scenes.ts, approved by Josh 2026-11-27). Each scene is markup in Chester's pose space with
   {{CAT|variant|anim}} slots that `fillScene` fills with his own chesterSVG() for this cat's coat, eyes and outfit.
   Chester sits in a nested <svg> viewport (not a transform), so the transform-origins in props.css are plain
   Chester-space numbers, the same as in chester.css. The animations are in props.css (`.sc-<id>`); the triggers and
   timings are in src/engine/props.ts. */
import { donut, post, perch, pickle, bird, butterfly, leaf, heart, spark, C, st, POST_X } from './props';
import { chesterSVG, type Mood, type Pose, type SitLegs } from './art';
import type { PropToy } from '../engine/props';

/** Place Chester with his floor point (100, 190) at (x, y), scaled s. `cls` goes on the animated wrapper. */
export const cat = (variant: string, anim: string, x: number, y: number, s: number, cls = '', style = '') =>
  `<svg x="${(x - 100 * s - 14 * s).toFixed(1)}" y="${(y - 190 * s - 34 * s).toFixed(1)}" width="${(232 * s).toFixed(1)}" height="${(232 * s).toFixed(1)}" viewBox="-14 -34 232 232" overflow="visible"${style ? ` style="${style}"` : ''}><g class="mv ${cls}">{{CAT|${variant}|${anim}}}</g></svg>`;

export interface Scene { id: string; prop: PropToy; name: string; hint: string; uses: string; vb: string; body: string }

const VB = { donut: '-80 -90 360 300', post: '-75 -102 360 300', perch: '-80 -108 360 300', kicker: '-80 -90 360 300' };
const S: Scene[] = [];
const add = (s: Omit<Scene, 'vb'> & { vb?: string }) => S.push({ ...s, vb: s.vb ?? VB[s.prop] });

/* ---------- Donut cushion ---------- */
{
  const d = (k: string) => donut(k);
  let p = d('k');
  add({ id: 'donut-knead', prop: 'donut', name: 'Biscuit baker', hint: 'Tap the donut while he’s sitting on it.', uses: 'sit pose (happy face) with elbow-jointed front legs, paws pressing the frosting in turn',
    body: p.back + p.front
      + `<g class="dents"><ellipse class="dent dL" cx="92.8" cy="175" rx="11" ry="3.2" fill="${C.pinkD}"/><ellipse class="dent dR" cx="107.2" cy="175" rx="11" ry="3.2" fill="${C.pinkD}"/></g>`
      + cat('sit:happy', '', 100, 174, 0.9, 'bis') + `<g class="prr"><text x="4" y="100">prrr</text><text x="-16" y="76">prrr</text></g>` });

  p = d('c');
  add({ id: 'donut-circles', prop: 'donut', name: 'Round and round', hint: 'Pick the donut as his bed, then leave him be.', uses: 'walk pose hopping round three times on the frosting, then curl pose settling in',
    body: p.back + `<ellipse class="squish" cx="100" cy="152" rx="44" ry="9" fill="${C.pinkD}" opacity=".5"/>`
      + cat('walk:happy', '', 100, 152, 0.6, 'turn') + cat('curl', '', 102, 160, 0.66, 'settle') });

  p = d('n');
  add({ id: 'donut-nap', prop: 'donut', name: 'Donut hole', hint: 'Let him nap after a training set.', uses: 'sleep pose + nap anim, curled up on top of the frosting',
    body: p.back + `<ellipse cx="104" cy="158" rx="58" ry="10" fill="${C.pinkD}" opacity=".55"/>` + cat('sleep', 'nap', 100, 158, 0.66) });

  p = d('b');
  add({ id: 'donut-blink', prop: 'donut', name: 'Slow blink', hint: 'Hold a finger on his face for a second.', uses: 'loaf pose + slowblink anim with a heart',
    body: p.back + p.front + cat('loaf:heart', 'slowblink', 92, 170, 0.8) });

  p = d('y');
  add({ id: 'donut-yawn', prop: 'donut', name: 'Wake-up yawn', hint: 'Open the app in the morning while he’s in bed.', uses: 'sit pose + yawn anim, sitting in the hole',
    body: p.back + cat('sit', 'yawn', 100, 168, 0.76) + p.front + spark(178, 70, 1, 'tw t1') + spark(26, 96, 0.8, 'tw t2') });
}

/* ---------- Scratching post ---------- */
{
  const fluff = (n: number) => Array.from({ length: n }, (_, i) => `<path class="fl f${i}" d="M${POST_X + 8} ${30 + i * 10} q3 -5 7 -1 q3 4 7 0" fill="none" stroke="${C.sisalD}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  let p = post('s');
  add({ id: 'post-stretch', prop: 'post', name: 'Big stretch', hint: 'Tap the post once.', uses: 'new stand-up pose, whole body stretching up the post',
    body: p.back + p.pom + cat('scratch', '', 100, 190, 1, 'str') });

  p = post('x');
  add({ id: 'post-scratch', prop: 'post', name: 'Scratch scratch', hint: 'Tap the post a few times quickly.', uses: 'new stand-up pose: both front paws on the post, raking down in turn, sisal fluff flying',
    body: `<g class="wob">${p.back}</g>`
      + `<g class="fresh"><path class="m1" d="M162 66 l3 26" /><path class="m2" d="M169 64 l3 28"/><path class="m3" d="M176 66 l3 26"/></g>`
      + p.pom + cat('scratch', '', 100, 190, 1, 'rake') + `<g class="fluffs">${fluff(4)}</g>` });

  p = post('p');
  add({ id: 'post-pom', prop: 'post', name: 'Pom-pom bat', hint: 'Flick the pom-pom.', uses: 'sit pose with an elbow-jointed paw swatting, sitting on the post’s base',
    body: p.back + p.pom + cat('sit:swat', 'play', 178, 180, 0.76, 'bat') });

  p = post('t');
  {
    const jumper = cat('sit:flex', '', 30, 190, 0.78, 'jx').replace(/<g class="mv jx">(\{\{CAT\|[^}]*\}\})<\/g>/, '<g class="mv jx"><g class="jy"><g class="jb">$1</g></g></g>');
  add({ id: 'post-top', prop: 'post', vb: '-120 -176 450 375', name: 'Top of the tower', hint: 'Leave him alone with the post for a while.', uses: 'sit pose: crouch, spring up in an arc, land with a squash on the perch, then loaf pose + slowblink',
    body: p.back + p.pom + `<g class="landing"><ellipse cx="170" cy="-14" rx="38" ry="9" fill="${C.lavD}" opacity=".5"/></g>` + jumper + cat('loaf:heart', 'slowblink', 168, -20, 0.6, 'top') });
  }

  p = post('w');
  add({ id: 'post-strut', prop: 'post', name: 'Proud strut', hint: 'Tap him right after a scratch.', uses: 'walk pose, tail high, a lap past his post',
    body: p.back + p.pom + cat('walk:happy', '', 40, 192, 0.74, 'strut') + spark(120, 20, 1, 'tw t1', C.gold) + spark(206, 60, 0.8, 'tw t2', C.gold) });
}

/* ---------- Window perch ---------- */
{
  const F = 140; // cushion top
  const withBird = (p: { back: string }, b: string) => p.back.replace('<g class="birdlayer"></g>', `<g class="birdlayer">${b}</g>`);
  let p = perch('l');
  add({ id: 'perch-loaf', prop: 'perch', name: 'Sunbeam loaf', hint: 'Visit on a sunny morning.', uses: 'loaf pose + slowblink, in a shimmering sunbeam',
    body: p.back + cat('loaf:heart', 'slowblink', 92, F + 2, 0.68) + p.front });

  p = perch('t');
  add({ id: 'perch-birdtv', prop: 'perch', name: 'Bird TV', hint: 'Leave him on the perch when a bird flies past.', uses: 'sit pose, eyes and head following the bird, tail tip twitching',
    body: withBird(p, bird('fly')) + cat('sit', '', 100, F, 0.68, 'watch') + p.front });

  p = perch('c');
  add({ id: 'perch-chatter', prop: 'perch', name: 'Ek-ek-ek', hint: 'Tap the bird on the ledge.', uses: 'sit pose, head chattering fast, a speech bubble',
    body: withBird(p, `<g transform="translate(44 92)">${bird('perched')}</g>`) + cat('sit', '', 132, F, 0.68, 'chat') + p.front
      + `<g class="bub"><path d="M138 -6 C138 -24 226 -24 226 -6 C226 10 190 10 172 8 L158 18 L160 6 C146 4 138 2 138 -6 Z" fill="#fff" ${st(2.4)}/><text x="182" y="-1" text-anchor="middle">ek ek ek</text></g>` });

  p = perch('p');
  add({ id: 'perch-paw', prop: 'perch', name: 'Paw on the glass', hint: 'Hold your finger on the glass.', uses: 'sit pose with a raised paw, a paw print fogging the glass',
    body: withBird(p, `<g transform="translate(150 56)">${butterfly()}</g>`) + `<g class="print">${pawPrint(130, 84)}</g>` + cat('sit:raised', '', 100, F, 0.68, 'press') + p.front });

  p = perch('r', { rain: true });
  add({ id: 'perch-rain', prop: 'perch', name: 'Rainy day doze', hint: 'Check on him on a rainy day.', uses: 'sleep pose + nap anim, rain on the glass',
    body: p.back + cat('sleep', 'nap', 100, F, 0.68) });
}

/* ---------- Catnip kicker ---------- */
{
  const floor = `<path d="M-80 192 H280" stroke="var(--floor)" stroke-width="3" stroke-linecap="round"/>`;
  add({ id: 'kicker-sniff', prop: 'kicker', name: 'Sniff test', hint: 'Drop the kicker near him.', uses: 'crouch pose creeping in, a sniff, then a puff of catnip',
    body: floor + pickle(196, 178, -4, 0.8, 'pk') + cat('crouch', '', 56, 192, 0.8, 'sniff')
      + `<g class="puff">${leaf(176, 140, 1, 'lf l0')}${leaf(204, 132, 0.8, 'lf l1')}${spark(190, 118, 0.9, 'lf l2', C.goldL)}${leaf(222, 146, 0.9, 'lf l3')}</g>` });

  add({ id: 'kicker-kicks', prop: 'kicker', name: 'Bunny kicks', hint: 'Wiggle the kicker by his belly.', uses: 'ball pose hugging the kicker, back legs kicking',
    body: floor + cat('ball:pickle', '', 82, 190, 0.92, 'kick') + `<g class="dash"><path d="M150 112 q8 -4 12 2 M156 130 q8 -2 12 4 M148 96 q6 -6 12 -2" fill="none" ${st(2.4)}/></g>` });

  add({ id: 'kicker-roll', prop: 'kicker', name: 'Roly-poly', hint: 'Let him keep the kicker for a bit.', uses: 'ball pose hugging the kicker, rolling side to side',
    body: floor + cat('ball:pickle', '', 82, 190, 0.92, 'roll') + spark(30, 90, 1, 'tw t1', C.goldL) + spark(196, 70, 0.8, 'tw t2', C.goldL) });

  add({ id: 'kicker-zoomies', prop: 'kicker', name: 'Catnip zoomies', hint: 'Toss the kicker across the room.', uses: 'run pose + zoom anim, the kicker left spinning',
    body: floor + `<g class="spin">${pickle(100, 176, 0, 0.7, 'pk')}</g>` + cat('run:happy', 'zoom', 100, 192, 0.7) });

  add({ id: 'kicker-bliss', prop: 'kicker', name: 'Blissed out', hint: 'After the zoomies, leave him be.', uses: 'sploot pose, happy face, leaves and hearts drifting up',
    body: floor + pickle(196, 180, 6, 0.62, 'pk') + cat('sploot:happy', '', 92, 192, 0.86, 'bliss')
      + `<g class="drift">${heart(60, 80, 0.9, 'dr d0')}${leaf(110, 70, 1, 'dr d1')}${heart(150, 90, 0.7, 'dr d2', C.lav)}${leaf(36, 110, 0.8, 'dr d3')}</g>` });
}

function pawPrint(x: number, y: number) {
  return `<g transform="translate(${x} ${y})" fill="#fff" opacity=".9"><ellipse cx="0" cy="6" rx="7" ry="6"/><circle cx="-8" cy="-3" r="3"/><circle cx="-3" cy="-8" r="3"/><circle cx="3" cy="-8" r="3"/><circle cx="8" cy="-3" r="3"/></g>`;
}

export const SCENES = S;

/* ---------- Resting: what each stage shows between moves (the same pieces, Chester just sitting by his prop) ---------- */
const REST: Record<PropToy, string> = (() => {
  const d = donut('r'), p = post('r'), w = perch('r');
  const floor = `<path d="M-80 192 H280" stroke="var(--floor)" stroke-width="3" stroke-linecap="round"/>`;
  return {
    donut: d.back + cat('sit', '', 100, 168, 0.76, 'rest') + d.front,
    post: p.back + p.pom + cat('sit', '', 60, 190, 0.8, 'rest'),
    perch: w.back + cat('sit', '', 100, 140, 0.68, 'rest') + w.front,
    kicker: floor + pickle(196, 178, -4, 0.8, 'pk') + cat('sit', '', 60, 192, 0.8, 'rest'),
  };
})();
export const restScene = (prop: PropToy): Scene => ({ id: `${prop}-rest`, prop, name: 'Resting', hint: '', uses: 'sit pose by the prop', vb: VB[prop], body: REST[prop] });
export const sceneById = (id: string): Scene | undefined => S.find((s) => s.id === id);

/* ---------- Filling the {{CAT|variant|anim}} slots with his own drawing ---------- */
const HEART = `<g class="heart"><path transform="translate(150 40)" d="M0 8 C-7 3 -10 0 -10 -4 A4.6 4.6 0 0 1 0 -6 A4.6 4.6 0 0 1 10 -4 C10 0 7 3 0 8 Z" fill="${C.rose}" ${st(2)}/></g>`;
/** The drawing each slot variant asks for (from the kit's poses.ts). */
export const VARIANTS: Record<string, { pose: Pose; mood?: Mood; raised?: boolean; legs?: SitLegs; extra?: string; pickle?: boolean }> = {
  'walk:happy': { pose: 'walk', mood: 'happy' }, curl: { pose: 'curl' }, sleep: { pose: 'sleep' },
  'loaf:heart': { pose: 'loaf', extra: HEART }, sit: { pose: 'sit' }, 'sit:raised': { pose: 'sit', raised: true },
  'sit:happy': { pose: 'sit', mood: 'happy', legs: 'flex' }, 'sit:flex': { pose: 'sit', legs: 'flex' }, 'sit:swat': { pose: 'sit', legs: 'swat' },
  scratch: { pose: 'scratch', mood: 'happy' }, crouch: { pose: 'crouch' }, 'ball:pickle': { pose: 'ball', mood: 'happy', pickle: true },
  'run:happy': { pose: 'run', mood: 'happy' }, 'sploot:happy': { pose: 'sploot', mood: 'happy' },
};
const YARN = /<g transform="translate\(4 10\)"><g class="yarn">[\s\S]*?<\/g><\/g>/;
let uidN = 0;
export interface SceneCat { coat?: string; eyes?: string; wear?: string; name?: string }
/** One Chester drawing for a slot, placed in its nested viewport (x, y and height fill the slot's viewBox). */
export function slotSVG(variant: string, anim: string, c: SceneCat): string {
  const v = VARIANTS[variant];
  if (!v) throw new Error(`prop scene: no variant ${variant}`);
  let s = chesterSVG({ pose: v.pose, mood: v.mood, raised: v.raised, legs: v.legs, extra: v.extra, coat: c.coat, eyes: c.eyes, wear: c.wear, anim, width: 232, label: c.name ?? 'Chester', uid: `ps${++uidN}` });
  s = s.replace('<svg class="kc', '<svg x="-14" y="-34" height="232" class="kc');
  if (v.pickle) s = s.replace(YARN, `<g class="pickleH">${pickle(140, 118, -38, 0.56, 'pkb')}</g>`);
  return s;
}
/** A whole scene as an SVG string for this cat: `<svg class="scene sc-<id>">`, animated by props.css. */
export function fillScene(scene: Scene, c: SceneCat): string {
  const body = scene.body.replace(/\{\{CAT\|([^|}]+)\|([^}]*)\}\}/g, (_, v: string, a: string) => slotSVG(v, a, c));
  const label = scene.name === 'Resting' ? `${c.name ?? 'Chester'} by his ${scene.prop === 'post' ? 'tower' : scene.prop === 'perch' ? 'window' : scene.prop}` : `${c.name ?? 'Chester'}: ${scene.name}`;
  return `<svg class="scene sc-${scene.id}" viewBox="${scene.vb}" role="img" aria-label="${label.replace(/[&<>"]/g, '')}">${body}</svg>`;
}
