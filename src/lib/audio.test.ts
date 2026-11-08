import { describe, it, expect, vi, afterEach } from 'vitest';

/** A stand-in for iPhone's audio engine: it can get stuck 'interrupted' after an app switch. */
class FakeCtx {
  static made: FakeCtx[] = [];
  static stuck = false;
  state: string = 'running'; currentTime = 0; destination = {}; sampleRate = 44100;
  constructor() { FakeCtx.made.push(this); }
  resume = vi.fn(async () => { if (!FakeCtx.stuck) this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  decodeAudioData = vi.fn();
}
const setVisible = (v: 'visible' | 'hidden') => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v }); document.dispatchEvent(new Event('visibilitychange')); };

describe('sound after switching apps', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); FakeCtx.made = []; FakeCtx.stuck = false; vi.resetModules(); });
  it('pauses when the app goes to the background and starts again on the next tap', async () => {
    vi.stubGlobal('AudioContext', FakeCtx); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const audio = await import('./audio');
    const stop = audio.keepAlive();
    audio.warm(); const c = FakeCtx.made[0];
    setVisible('hidden'); expect(c.suspend).toHaveBeenCalled();
    c.state = 'interrupted'; // what iOS reports on return
    setVisible('visible');
    document.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(c.resume).toHaveBeenCalled(); expect(c.state).toBe('running');
    stop();
  });
  it('replaces an engine iOS left stuck', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeCtx); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const audio = await import('./audio');
    const stop = audio.keepAlive();
    audio.warm(); const c = FakeCtx.made[0];
    FakeCtx.stuck = true; c.state = 'interrupted'; setVisible('visible');
    document.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(300);
    expect(c.close).toHaveBeenCalled(); expect(FakeCtx.made).toHaveLength(2);
    stop();
  });
});
