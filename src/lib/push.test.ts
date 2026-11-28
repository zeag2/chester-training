import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { FakeServer } from '../sync/fake';
import { Store } from '../db/store';
import { askSnoozed, disablePush, enablePush, hourText, pushReady, pushState, pushSupport, quietText, refreshPush, resetPushReady, shouldAsk, snoozeAsk } from './push';
import { fakeBrowser, fakeSub, type FakeBrowser } from './pushtest-env';

let fb: FakeBrowser | null = null;
beforeEach(() => { try { localStorage.clear(); } catch { /* */ } resetPushReady(); });
afterEach(() => { fb?.restore(); fb = null; });

const signedIn = async (server = new FakeServer(), email = 'josh@example.com') => { const r = server.device(); await r.signUp(email, 'pw123456'); return { server, r }; };
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('what this phone can do', () => {
  it('yes with PushManager; an iPhone Safari tab has to be added to the Home Screen first; others no', () => {
    fb = fakeBrowser(); expect(pushSupport()).toBe('yes'); fb.restore();
    fb = fakeBrowser({ push: false, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1' });
    expect(pushSupport()).toBe('ios-install'); fb.restore();
    fb = fakeBrowser({ push: false, ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0' });
    expect(pushSupport()).toBe('no');
  });
  it('state: blocked, off, on', async () => {
    fb = fakeBrowser({ permission: 'denied' }); expect(await pushState()).toBe('blocked'); fb.restore();
    fb = fakeBrowser(); expect(await pushState()).toBe('off');
    const { r } = await signedIn();
    expect(await enablePush(r)).toBe('on');
    expect(await pushState()).toBe('on');
  });
  it('words', () => {
    expect([0, 9, 12, 21].map(hourText)).toEqual(['12 AM', '9 AM', '12 PM', '9 PM']);
    expect(quietText({ quietFrom: 21, quietTo: 8 })).toBe('Quiet 9 PM–8 AM');
  });
});

describe('turning it on and off', () => {
  it('on: asks the browser first, subscribes visibly with our key, saves the phone and default prefs in my time zone', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    expect(await enablePush(r)).toBe('on');
    expect(fb.requestPermission).toHaveBeenCalledTimes(1);
    const opts = fb.subscribe.mock.calls[0][0] as PushSubscriptionOptionsInit;
    expect(opts.userVisibleOnly).toBe(true);
    expect((opts.applicationServerKey as Uint8Array).length).toBe(65); // an uncompressed P-256 public key
    expect([...server.pushSubs.values()]).toEqual([expect.objectContaining({ endpoint: fb.sub!.endpoint, userId: 'u:josh@example.com', p256dh: expect.stringMatching(/^BKey/) })]);
    expect(server.pushPrefs.get('u:josh@example.com')).toEqual({ tz, friends: true, treats: true, photos: true, meds: true, medHour: 9, quietFrom: 21, quietTo: 8 });
  });
  it('keeps prefs someone already chose (only the time zone follows the phone)', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    server.pushPrefs.set('u:josh@example.com', { tz: 'Europe/Paris', friends: false, treats: true, photos: false, meds: true, medHour: 7, quietFrom: 21, quietTo: 8 });
    await enablePush(r);
    expect(server.pushPrefs.get('u:josh@example.com')).toMatchObject({ tz, friends: false, photos: false, medHour: 7 });
  });
  it('"Block" in the browser: blocked, nothing subscribed or saved', async () => {
    fb = fakeBrowser(); fb.answer = 'denied'; const { server, r } = await signedIn();
    expect(await enablePush(r)).toBe('blocked');
    expect(fb.subscribe).not.toHaveBeenCalled();
    expect(server.pushSubs.size).toBe(0);
  });
  it('saving fails (offline): an error, and the phone is unsubscribed again so the two never disagree', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn(); server.online = false;
    expect(await enablePush(r)).toBe('error');
    expect(fb.sub).toBeNull();
    expect(await pushState()).toBe('off');
  });
  it('off: unsubscribes and removes this phone on the server; other phones stay', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    server.pushSubs.set('https://other.example/p', { endpoint: 'https://other.example/p', p256dh: 'k', auth: 'a', userId: 'u:josh@example.com', userAgent: '' });
    await enablePush(r); const s = fb.sub!;
    await disablePush(r);
    expect(s.unsubscribe).toHaveBeenCalled();
    expect([...server.pushSubs.keys()]).toEqual(['https://other.example/p']);
    expect(await pushState()).toBe('off');
  });
  it('signing out turns this phone off first (while still signed in), so the next person doesn’t get them', async () => {
    fb = fakeBrowser(); const server = new FakeServer(); const r = server.device(); await r.signUp('josh@example.com', 'pw123456');
    const s = new Store('push-signout', r); await s.load();
    await enablePush(r); expect(server.pushSubs.size).toBe(1);
    await s.signOut();
    expect(server.pushSubs.size).toBe(0);
    expect(await r.account()).toBeNull();
  });
});

describe('on app start', () => {
  it('re-saves the phone (a rotated endpoint) and the time zone; quiet when it was never turned on', async () => {
    fb = fakeBrowser({ permission: 'granted' }); const { server, r } = await signedIn();
    await refreshPush(r); expect(server.pushSubs.size).toBe(0); // never turned on here: nothing
    await enablePush(r);
    server.pushPrefs.set('u:josh@example.com', { ...server.pushPrefs.get('u:josh@example.com')!, tz: 'Asia/Tokyo' }); // travelled
    fb.sub = fakeSub('https://fcm.googleapis.com/fcm/send/rotated');
    await refreshPush(r);
    expect(server.pushSubs.has('https://fcm.googleapis.com/fcm/send/rotated')).toBe(true);
    expect(server.pushPrefs.get('u:josh@example.com')!.tz).toBe(tz);
  });
  it('the subscription went away (browser data cleared): subscribes again', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    await enablePush(r); fb.sub = null; server.pushSubs.clear();
    await refreshPush(r);
    expect(fb.subscribe).toHaveBeenCalledTimes(2);
    expect(server.pushSubs.size).toBe(1);
  });
  it('a phone subscribed with the old key: unsubscribed, subscribed again with the new key, saved; the old one removed', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    await enablePush(r);
    const newKey = new Uint8Array(fb.subscribe.mock.calls[0][0].applicationServerKey as Uint8Array);
    const oldKey = newKey.slice(); oldKey[1] ^= 0xff;
    server.pushSubs.clear();
    const old = fakeSub('https://fcm.googleapis.com/fcm/send/old-key', oldKey); fb.sub = old;
    await r.savePushSubscription({ endpoint: old.endpoint, p256dh: 'x', auth: 'y' }, 'test');
    await refreshPush(r);
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(fb.subscribe).toHaveBeenCalledTimes(2);
    expect(new Uint8Array(fb.subscribe.mock.calls[1][0].applicationServerKey as Uint8Array)).toEqual(newKey);
    expect(server.pushSubs.has(old.endpoint)).toBe(false);
    expect(server.pushSubs.has(fb.sub!.endpoint)).toBe(true);
    expect(server.pushSubs.size).toBe(1);
    // next start: already on the new key, nothing changes
    await refreshPush(r);
    expect(fb.subscribe).toHaveBeenCalledTimes(2);
  });
  it('turning it on with an old-key subscription still in the browser: a fresh one with the new key', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    const oldKey = new Uint8Array(65).fill(4);
    const old = fakeSub('https://fcm.googleapis.com/fcm/send/old-on', oldKey); fb.sub = old;
    expect(await enablePush(r)).toBe('on');
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(fb.subscribe).toHaveBeenCalledTimes(1);
    expect([...server.pushSubs.keys()]).toEqual([fb.sub!.endpoint]);
  });
  it('a browser that doesn\'t say which key it used: the subscription is kept', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    await enablePush(r);
    const kept = fakeSub('https://fcm.googleapis.com/fcm/send/unknown-key', null); fb.sub = kept;
    await refreshPush(r);
    expect(kept.unsubscribe).not.toHaveBeenCalled();
    expect(fb.subscribe).toHaveBeenCalledTimes(1);
    expect(server.pushSubs.has(kept.endpoint)).toBe(true);
  });
  it('blocked since: forgets it was on, never throws', async () => {
    fb = fakeBrowser(); const { r } = await signedIn(); await enablePush(r);
    fb.permission = 'denied';
    await expect(refreshPush(r)).resolves.toBeUndefined();
    fb.permission = 'granted';
    expect(await pushState()).toBe('off');
  });
});

describe('when to ask', () => {
  it('only once the push SQL is run, never after "Not now" (30 days), never once the browser has an answer', async () => {
    fb = fakeBrowser(); const { server, r } = await signedIn();
    server.pushTable = false;
    expect(await pushReady(r, 'u:josh@example.com')).toBe(false);
    expect(await shouldAsk(r, 'u:josh@example.com')).toBe(false);
    server.pushTable = true; // Josh runs the SQL: asked again, not stuck on the old answer
    expect(await shouldAsk(r, 'u:josh@example.com')).toBe(true);
    expect(await shouldAsk(r, undefined)).toBe(false); // signed out
    const now = Date.now(); snoozeAsk(now);
    expect(askSnoozed(now + 29 * 864e5)).toBe(true);
    expect(await shouldAsk(r, 'u:josh@example.com', now + 29 * 864e5)).toBe(false);
    expect(await shouldAsk(r, 'u:josh@example.com', now + 31 * 864e5)).toBe(true);
    fb.permission = 'denied';
    expect(await shouldAsk(r, 'u:josh@example.com', now + 31 * 864e5)).toBe(false);
  });
  it('no push in this browser: never asks, never calls the server', async () => {
    fb = fakeBrowser({ push: false, ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0' }); const { server, r } = await signedIn(); server.online = false;
    expect(await shouldAsk(r, 'u:josh@example.com')).toBe(false);
  });
});
