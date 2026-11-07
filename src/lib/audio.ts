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
