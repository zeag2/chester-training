/* Synthesized sounds; every function is a safe no-op when audio is unavailable. */
let ctx: AudioContext | null = null;
let muted = false;
export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function make(): AudioContext | null {
  const AC: typeof AudioContext | undefined = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
  return AC ? new AC() : null;
}
function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx || (ctx.state as string) === 'closed') ctx = make();
    if (!ctx) return null;
    // iPhone leaves it 'suspended' or 'interrupted' after switching apps or a call: ask it to start again
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/** Keep sound working across app switches. iPhone pauses the audio engine when the app goes to the background and
    only lets it start again from a tap, so: pause it cleanly when hidden, and on every tap after coming back make sure
    it's running. If iOS left it broken (it won't start), replace it with a fresh one; decoded samples carry over. */
export function keepAlive() {
  const hidden = () => { if (document.visibilityState === 'hidden' && ctx?.state === 'running') void ctx.suspend().catch(() => {}); };
  const tap = () => {
    if (muted) return;
    const c = ctx;
    if (!c) { warm(); return; }
    if (c.state === 'running') return;
    c.resume().catch(() => {});
    // still not running a moment later (stuck 'interrupted'): start over with a new engine, inside this tap
    window.setTimeout(() => {
      if (ctx !== c || c.state === 'running' || document.visibilityState !== 'visible') return;
      try { void c.close().catch(() => {}); } catch { /* already closed */ }
      ctx = make(); void ctx?.resume().catch(() => {});
    }, 250);
  };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', hidden);
  document.addEventListener('pointerdown', tap, { passive: true, capture: true });
  document.addEventListener('touchend', tap, { passive: true, capture: true });
  return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', hidden);
    document.removeEventListener('pointerdown', tap, { capture: true } as EventListenerOptions); document.removeEventListener('touchend', tap, { capture: true } as EventListenerOptions); };
}

/* Sampled sounds from the earshot bank (made in code, measured): clicker = click/double, reward = mallet/flourish.
   Loaded once on first use; until they arrive (or if fetch fails) the synth versions play instead. */
const SAMPLES = { clicker: 'sfx/clicker.wav', reward: 'sfx/reward.wav' } as const;
type SampleName = keyof typeof SAMPLES;
const buffers: Partial<Record<SampleName, AudioBuffer>> = {};
let loading = false;
function load(c: AudioContext) {
  if (loading) return; loading = true;
  const base = (import.meta as any).env?.BASE_URL ?? '/';
  for (const [name, path] of Object.entries(SAMPLES) as [SampleName, string][]) {
    try {
      void fetch(base + path).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => c.decodeAudioData(a)).then((b) => { buffers[name] = b; }).catch(() => { /* synth fallback */ });
    } catch { /* no fetch (tests) */ }
  }
}
function sample(name: SampleName, gain: number, rate = 1): boolean {
  const c = ac(); if (!c) return false; load(c);
  const b = buffers[name]; if (!b) return false;
  const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = gain;
  s.connect(g); g.connect(c.destination); s.start(); return true;
}
/** Call on first user gesture so samples are ready by the first rep. */
export function warm() { const c = ac(); if (c) load(c); }

export function buzz(p: number | number[]) { try { (navigator as any).vibrate?.(p); } catch { /* iPhone: no vibration */ } }

export function click() {
  // tiny pitch variation so 30 reps in a row don't sound machine-identical
  if (sample('clicker', 0.42, 0.97 + Math.random() * 0.06)) return;
  const c = ac(); if (!c) return; const t = c.currentTime;
  [0, 0.045].forEach((off) => { const o = c.createOscillator(); const g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(2400, t + off);
    g.gain.setValueAtTime(0.22, t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.018); o.connect(g); g.connect(c.destination); o.start(t + off); o.stop(t + off + 0.02); });
}

export function chirp(up = true) {
  const c = ac(); if (!c) return; const t = c.currentTime; const o = c.createOscillator(); const g = c.createGain();
  const f0 = (up ? 520 : 760) * (0.9 + Math.random() * 0.25);
  o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(up ? f0 * 1.85 : f0 * 0.58, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.22);
}

export function sparkle() {
  if (sample('reward', 0.38)) return;
  const c = ac(); if (!c) return; const t = c.currentTime;
  [880, 1175, 1568, 2093].forEach((f, i) => { const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
    const s = t + i * 0.07; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.14, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.32);
    o.connect(g); g.connect(c.destination); o.start(s); o.stop(s + 0.34); });
}

export function purr(sec = 1.4) {
  const c = ac(); if (!c) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate); const d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  const src = c.createBufferSource(); src.buffer = buf; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const amp = c.createGain(); amp.gain.value = 0; const lfo = c.createOscillator(); lfo.frequency.value = 26; const lg = c.createGain(); lg.gain.value = 0.5;
  lfo.connect(lg); lg.connect(amp.gain); const m = c.createGain(); const t = c.currentTime;
  m.gain.setValueAtTime(0, t); m.gain.linearRampToValueAtTime(0.9, t + 0.25); m.gain.setValueAtTime(0.9, t + sec - 0.4); m.gain.linearRampToValueAtTime(0, t + sec);
  src.connect(lp); lp.connect(amp); amp.connect(m); m.connect(c.destination); src.start(); lfo.start(); src.stop(t + sec); lfo.stop(t + sec);
}

/** A kitten meow: a buzzy voice through two moving formants, "mi" → "a" → "ow", with the pitch arching up then down.
    mew = short and high, meow = the full one, mrrp = a rolled trill that goes up. */
export function meow(kind: 'mew' | 'meow' | 'mrrp' = 'meow') {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const len = kind === 'mew' ? 0.32 : kind === 'mrrp' ? 0.38 : 0.62;
  const p = 0.92 + Math.random() * 0.16; // a little different every time
  const f0 = (kind === 'mew' ? 760 : kind === 'mrrp' ? 520 : 600) * p;
  const o = c.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  if (kind === 'mrrp') o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + len);
  else { o.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + len * 0.35); o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t + len); }
  const vib = c.createOscillator(); vib.frequency.value = kind === 'mrrp' ? 28 : 6; const vg = c.createGain(); vg.gain.value = kind === 'mrrp' ? f0 * 0.05 : f0 * 0.015;
  vib.connect(vg); vg.connect(o.frequency);
  const formant = (a: number, b: number, cEnd: number, q: number, gain: number) => {
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(a, t); f.frequency.linearRampToValueAtTime(b, t + len * 0.45); f.frequency.linearRampToValueAtTime(cEnd, t + len);
    const g = c.createGain(); g.gain.value = gain; o.connect(f); f.connect(g); return g;
  };
  const f1 = formant(380, 900, 520, 6, 1.0), f2 = formant(2300, 1500, 950, 8, 0.6);
  const amp = c.createGain(); amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.5, t + 0.04);
  amp.gain.setValueAtTime(0.5, t + len * 0.6); amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
  if (kind === 'mrrp') { const trill = c.createOscillator(); trill.frequency.value = 24; const tg = c.createGain(); tg.gain.value = 0.22; trill.connect(tg); tg.connect(amp.gain); trill.start(t); trill.stop(t + len); }
  f1.connect(amp); f2.connect(amp); amp.connect(c.destination);
  o.start(t); vib.start(t); o.stop(t + len + 0.02); vib.stop(t + len + 0.02);
}

/** A crinkle tunnel rustling: quick bright bursts of crackly noise (shorter and higher than the litter digging). */
export function crinkle(sec = 0.5) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const out = c.createGain(); out.gain.value = 0.22; out.connect(c.destination);
  let at = 0;
  while (at < sec) {
    const dur = 0.02 + Math.random() * 0.04;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() < 0.18 ? Math.random() * 2 - 1 : 0; // crackles
    const s = c.createBufferSource(); s.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500 + Math.random() * 2500;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(1, t + at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    s.connect(hp); hp.connect(g); g.connect(out); s.start(t + at); s.stop(t + at + dur);
    at += dur + 0.01 + Math.random() * 0.05;
  }
}

/** Somebody digging in a litter box, off to the right: uneven bursts of gritty noise. */
export function litter(sec = 1.8) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const pan = typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null; if (pan) pan.pan.value = 0.85;
  const out = c.createGain(); out.gain.value = 0.32; (pan ? out.connect(pan) : null); (pan ?? out).connect(c.destination);
  let at = 0;
  while (at < sec) {
    const dur = 0.05 + Math.random() * 0.09;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.35); // grit
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200 + Math.random() * 2400; bp.Q.value = 0.9;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(0.9, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t + at); s.stop(t + at + dur);
    at += dur + (Math.random() < 0.25 ? 0.25 + Math.random() * 0.2 : 0.02 + Math.random() * 0.06); // pauses between digs
  }
}

/** The rainbow-dash tune: an original bouncy 8-bit piece (square-wave lead, triangle bass) that runs the length of
    the dash (~5.4 s): a rising phrase, the same phrase answered higher, a little bridge, and a fanfare to land on. */
/** The dash tune, fitted to `totalMs` (the whole dash): 64 eighth-note steps. */
export function jingle(totalMs = 7600) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + 0.02; const step = totalMs / 1000 / 64;
  const N = (n: string) => { const i = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(n.slice(0, -1)); return 440 * 2 ** ((i - 9) / 12 + (Number(n.slice(-1)) - 4)); };
  const A = ['E5', 'G5', 'C6', 'G5', 'D5', 'G5', 'B5', 'G5', 'C5', 'E5', 'A5', 'E5', 'F5', 'A5', 'C6', 'A5'];
  const A2 = ['E5', 'G5', 'C6', 'E6', 'D6', 'B5', 'G5', 'B5', 'C6', 'A5', 'E5', 'A5', 'F5', 'A5', 'D6', 'F6'];
  const BR = ['E6', '-', 'D6', 'C6', 'D6', '-', 'G5', '-'];
  const END = ['C6', 'E6', 'G6', '-', 'E6', 'C6', '-', '-'];
  // the phrase, its answer, the phrase again a little higher at the end, a bridge, and the landing fanfare
  const A3 = ['E5', 'G5', 'C6', 'G5', 'D5', 'G5', 'B5', 'D6', 'C6', 'E6', 'A5', 'E6', 'F5', 'A5', 'C6', 'D6'];
  const lead = [...A, ...A2, ...A3, ...BR, ...END];
  const bassBar = (n: string, m: string) => [n, '-', m, '-'];
  const bass = [
    ...bassBar('C3', 'G3'), ...bassBar('G2', 'D3'), ...bassBar('A2', 'E3'), ...bassBar('F2', 'C3'),
    ...bassBar('C3', 'G3'), ...bassBar('G2', 'D3'), ...bassBar('A2', 'E3'), ...bassBar('F2', 'C3'),
    ...bassBar('C3', 'G3'), ...bassBar('G2', 'D3'), ...bassBar('A2', 'E3'), ...bassBar('F2', 'C3'),
    ...bassBar('F2', 'C3'), ...bassBar('G2', 'D3'), 'C3', '-', 'G2', '-', 'C3', '-', '-', '-',
  ];
  const tone = (type: OscillatorType, f: number, at: number, len: number, vol: number) => {
    const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + len + 0.02);
  };
  const hold = (arr: string[], i: number) => { let k = 1; while (arr[i + k] === '-') k++; return k; };
  lead.forEach((n, i) => { if (n !== '-') tone('square', N(n), t0 + i * step, step * (hold(lead, i) > 1 ? hold(lead, i) * 0.95 : 0.9), 0.065); });
  bass.forEach((n, i) => { if (n !== '-') tone('triangle', N(n), t0 + i * step, step * Math.min(2, hold(bass, i)) * 0.95, 0.16); });
  // a soft tick on every beat keeps it driving
  for (let i = 0; i < lead.length; i += 2) {
    const at = t0 + i * step; const len = 0.03; const b = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate); const d = b.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
    const src = c.createBufferSource(); src.buffer = b; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain(); g.gain.value = 0.05; src.connect(hp); hp.connect(g); g.connect(c.destination); src.start(at);
  }
}
