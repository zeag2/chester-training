/* Tests only: a fake browser for push (Notification permission, the service worker registration and its
   PushManager), so src/lib/push.ts and the screens can be tested in jsdom. */
import { vi } from 'vitest';

export interface FakeSub { endpoint: string; toJSON(): unknown; unsubscribe: ReturnType<typeof vi.fn> }
export interface FakeBrowser {
  permission: NotificationPermission;
  /** What the next permission prompt answers. */
  answer: NotificationPermission;
  sub: FakeSub | null;
  subscribe: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
  restore(): void;
}

let n = 0;
export function fakeSub(endpoint = `https://fcm.googleapis.com/fcm/send/e${++n}`): FakeSub {
  const s: FakeSub = { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'BKey' + n, auth: 'auth' + n } }), unsubscribe: vi.fn(async () => { if (b?.sub === s) b.sub = null; return true; }) };
  return s;
}

let b: FakeBrowser | null = null;
/** Install the fake. `push: false` = a browser without PushManager (e.g. an iPhone Safari tab, with `ua`). */
export function fakeBrowser(opts: { permission?: NotificationPermission; push?: boolean; ua?: string } = {}): FakeBrowser {
  const w = window as unknown as Record<string, unknown>;
  const had = { sw: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'), ua: Object.getOwnPropertyDescriptor(navigator, 'userAgent'), pm: w.PushManager, n: w.Notification };
  const fb: FakeBrowser = {
    permission: opts.permission ?? 'default', answer: 'granted', sub: null,
    subscribe: vi.fn(async () => { fb.sub = fakeSub(); return fb.sub; }),
    requestPermission: vi.fn(async () => { if (fb.permission === 'default') fb.permission = fb.answer; return fb.permission; }),
    restore() {
      if (had.sw) Object.defineProperty(navigator, 'serviceWorker', had.sw); else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
      if (had.ua) Object.defineProperty(navigator, 'userAgent', had.ua); else delete (navigator as unknown as Record<string, unknown>).userAgent;
      if (had.pm === undefined) delete w.PushManager; else w.PushManager = had.pm;
      if (had.n === undefined) delete w.Notification; else w.Notification = had.n;
      b = null;
    },
  };
  b = fb;
  if (opts.ua) Object.defineProperty(navigator, 'userAgent', { value: opts.ua, configurable: true });
  if (opts.push === false) { delete w.PushManager; delete w.Notification; return fb; }
  const reg = { pushManager: { getSubscription: async () => fb.sub, subscribe: fb.subscribe } };
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), addEventListener: () => {} }, configurable: true });
  w.PushManager = function PushManager() {};
  w.Notification = { get permission() { return fb.permission; }, requestPermission: fb.requestPermission };
  return fb;
}
