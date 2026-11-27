/* Push notifications on this phone (plan: docs/plans/2026-11-23-push-notifications.md). The server side is the
   send-push Edge Function; the service worker shows them (public/push-sw.js).

   Off until everything exists: this build needs a VAPID public key (src/sync/config.ts), the person must be signed in,
   and the push SQL must be run (`push_prefs` answers; until then the feature stays hidden, see `pushReady`).
   The browser only lets a page ask from a tap, and a "Block" is hard to undo, so we never ask on first open: only
   after a friend request, after saving a repeating medicine, or from Settings → Notifications. */
import { VAPID_PUBLIC_KEY } from '../sync/config';
import type { PushPrefs, Remote } from '../sync/remote';

/** What this phone can do: `ios-install` = iPhone/iPad Safari tab (push only works from the Home Screen app). */
export type PushSupport = 'yes' | 'ios-install' | 'no';
/** Where this phone stands: `on` it gets notifications, `off` it could, `blocked` the person said no in the browser. */
export type PushState = 'on' | 'off' | 'blocked' | Exclude<PushSupport, 'yes'>;

const FLAG = 'paldex-push';          // 'on' while this phone is meant to get notifications (re-subscribe on start)
const SNOOZE = 'paldex-push-ask';    // when "Not now" was tapped on an ask
export const SNOOZE_DAYS = 30;
export const DEFAULT_PREFS: Omit<PushPrefs, 'tz'> = { friends: true, treats: true, photos: true, meds: true, medHour: 9, quietFrom: 21, quietTo: 8 };

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return 'no';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'yes';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios ? 'ios-install' : 'no';
}

export const myTimeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };
export const defaultPrefs = (): PushPrefs => ({ tz: myTimeZone(), ...DEFAULT_PREFS });

/** "9 AM", "12 PM", "9 PM" for an hour 0–23. */
export const hourText = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
/** "Quiet 9 PM–8 AM". */
export const quietText = (p: Pick<PushPrefs, 'quietFrom' | 'quietTo'>) => `Quiet ${hourText(p.quietFrom)}–${hourText(p.quietTo)}`;

const keyBytes = (b64url: string) => {
  const b = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // the app registers it on start (src/lib/updates.ts); don't hang forever if that failed
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 10_000))]);
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Made with another VAPID key (the key changed on 2026-11-26): such a subscription can't get our pushes. A browser
    that doesn't say which key it used (`options` missing) is left alone. */
const otherKey = (s: PushSubscription, key: Uint8Array) => {
  const k = s.options?.applicationServerKey;
  return !!k && !sameBytes(new Uint8Array(k), key);
};
/** This phone's subscription for our current key: an existing one made with an old key is dropped (here and on the
    server) and replaced by a new one. */
async function subscription(reg: ServiceWorkerRegistration, remote: Remote): Promise<PushSubscription> {
  const key = keyBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && otherKey(sub, key)) {
    const { endpoint } = parts(sub);
    await sub.unsubscribe().catch(() => false);
    await remote.removePushSubscription(endpoint).catch(() => {});
    sub = null;
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
async function currentSub(): Promise<PushSubscription | null> {
  const reg = await registration(); return reg ? reg.pushManager.getSubscription() : null;
}
const parts = (s: PushSubscription) => {
  const j = s.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  return { endpoint: j.endpoint ?? s.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '' };
};

/** This phone's state (no network). */
export async function pushState(): Promise<PushState> {
  const s = pushSupport(); if (s !== 'yes') return s;
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSub().catch(() => null)) && ls.get(FLAG) === 'on' ? 'on' : 'off';
}

/** Whether the server side exists (the push SQL is run). Asked once per signed-in person per session. */
let ready: { user: string; p: Promise<boolean> } | null = null;
export function pushReady(remote: Remote | null, user: string | undefined): Promise<boolean> {
  if (!remote || !user || pushSupport() === 'no') return Promise.resolve(false);
  if (ready?.user !== user) {
    const p = remote.pushPrefs().then(() => true, () => false);
    ready = { user, p };
    p.then((ok) => { if (!ok && ready?.p === p) ready = null; }); // ask again next time (it may be run by then)
  }
  return ready.p;
}
/** Tests: forget what pushReady learned. */
export const resetPushReady = () => { ready = null; };

export type EnableResult = 'on' | 'blocked' | 'error';
/** Turn notifications on for this phone. Call it straight from a tap: the permission prompt must be the first thing
    that happens (iPhone refuses it after an await). */
export async function enablePush(remote: Remote): Promise<EnableResult> {
  let perm: NotificationPermission;
  try { perm = await Notification.requestPermission(); } catch { return 'error'; }
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'error';
  let sub: PushSubscription | null = null;
  try {
    const reg = await registration(); if (!reg) return 'error';
    sub = await subscription(reg, remote);
    await remote.savePushSubscription(parts(sub), navigator.userAgent);
    const prefs = await remote.pushPrefs();
    if (!prefs) await remote.savePushPrefs(defaultPrefs());
    else if (prefs.tz !== myTimeZone()) await remote.savePushPrefs({ ...prefs, tz: myTimeZone() });
    ls.set(FLAG, 'on'); ls.set(SNOOZE, null);
    return 'on';
  } catch {
    await sub?.unsubscribe().catch(() => false);
    return 'error';
  }
}

/** Stop notifications on this phone (Settings, and before signing out so the next person doesn't get them). */
export async function disablePush(remote: Remote | null): Promise<void> {
  ls.set(FLAG, null);
  if (pushSupport() !== 'yes') return;
  const sub = await currentSub().catch(() => null); if (!sub) return;
  const { endpoint } = parts(sub);
  await sub.unsubscribe().catch(() => false);
  await remote?.removePushSubscription(endpoint).catch(() => {});
}

/** On app start, signed in: keep this phone's subscription saved (endpoints rotate; it also refreshes last_seen),
    on the current key (a subscription made with an old key is replaced) and the time zone current (travel). Quiet: never asks, never throws. */
export async function refreshPush(remote: Remote | null): Promise<void> {
  try {
    if (!remote || ls.get(FLAG) !== 'on' || pushSupport() !== 'yes') return;
    if (Notification.permission !== 'granted') { if (Notification.permission === 'denied') ls.set(FLAG, null); return; }
    const reg = await registration(); if (!reg) return;
    const sub = await subscription(reg, remote); // a phone still on the old key moves to the new one here
    await remote.savePushSubscription(parts(sub), navigator.userAgent);
    const prefs = await remote.pushPrefs();
    if (prefs && prefs.tz !== myTimeZone()) await remote.savePushPrefs({ ...prefs, tz: myTimeZone() });
  } catch { /* next start */ }
}

/** "Not now" on an ask: none for 30 days. */
export const snoozeAsk = (now = Date.now()) => ls.set(SNOOZE, String(now));
export const askSnoozed = (now = Date.now()) => { const t = Number(ls.get(SNOOZE)); return t > 0 && now - t < SNOOZE_DAYS * 864e5; };

/** Whether to show an ask now: the server is ready, this phone could but isn't on, the browser hasn't been asked
    (a "Block" can't be undone from a page), and no "Not now" in the last 30 days. */
export async function shouldAsk(remote: Remote | null, user: string | undefined, now = Date.now()): Promise<boolean> {
  if (askSnoozed(now) || pushSupport() !== 'yes' || Notification.permission !== 'default') return false;
  return pushReady(remote, user);
}
