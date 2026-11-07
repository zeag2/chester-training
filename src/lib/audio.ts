/* Synthesized sounds; every function is a safe no-op when audio is unavailable. */
let ctx: AudioContext | null = null;
let muted = false;
export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    const AC: typeof AudioContext | undefined = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
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
