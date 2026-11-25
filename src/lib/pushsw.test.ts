// The service worker's push handler (public/push-sw.js), run against a fake service worker global.
import { describe, it, expect, vi } from 'vitest';
import { listenForPushOpen } from './pushopen';

const fs = 'node:fs'; // no Node types in this project: the same trick as layout.test.tsx
const SRC: string = (await import(/* @vite-ignore */ fs)).readFileSync('public/push-sw.js', 'utf8');
const SCOPE = 'https://paldex-4qh.pages.dev/';

function load(wins: { url: string }[] = []) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const windows = wins.map((w) => ({ ...w, postMessage: vi.fn(), focus: vi.fn(async () => w) }));
  const self = {
    registration: { scope: SCOPE, showNotification: vi.fn(async (title: string, opts: Record<string, unknown>) => { shown.push({ title, opts }); }) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null) },
    addEventListener: (t: string, f: (e: unknown) => void) => { handlers[t] = f; },
  };
  new Function('self', SRC)(self);
  const fire = async (type: string, e: Record<string, unknown>) => {
    let wait: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...e, waitUntil: (p: Promise<unknown>) => { wait = p; } });
    await wait;
  };
  return { self, shown, windows, fire };
}
const data = (v: unknown) => ({ json: () => (typeof v === 'string' ? JSON.parse(v) : v), text: () => String(v) });

describe('push-sw.js', () => {
  it('shows the notification from the payload, with our icon, the tag and the screen to open', async () => {
    const sw = load();
    await sw.fire('push', { data: data({ title: 'Erin gave Chester a treat', body: 'Say thanks from the Friends tab.', url: '#/friends', tag: 'treat-1' }) });
    expect(sw.shown).toEqual([{ title: 'Erin gave Chester a treat', opts: {
      body: 'Say thanks from the Friends tab.', icon: SCOPE + 'icon-192.png', badge: SCOPE + 'badge-96.png', data: { url: '#/friends' }, tag: 'treat-1', renotify: true } }]);
  });
  it('always shows something (iPhone drops silent pushes), and never opens another site', async () => {
    const sw = load();
    await sw.fire('push', { data: { json: () => { throw new Error('not json'); }, text: () => 'hello' } });
    await sw.fire('push', { data: data({ title: 'x', url: 'https://evil.example/' }) });
    await sw.fire('push', {});
    expect(sw.shown.map((s) => [s.title, s.opts.body, (s.opts.data as { url: string }).url, s.opts.tag])).toEqual([
      ['PalDex', 'hello', '#/', undefined], ['x', '', '#/', undefined], ['PalDex', '', '#/', undefined]]);
  });
  it('tap with PalDex open: tells that window where to go and brings it forward', async () => {
    const sw = load([{ url: 'https://other.example/' }, { url: SCOPE + '#/health' }]);
    const close = vi.fn();
    await sw.fire('notificationclick', { notification: { close, data: { url: '#/feed' } } });
    expect(close).toHaveBeenCalled();
    expect(sw.windows[0].postMessage).not.toHaveBeenCalled();
    expect(sw.windows[1].postMessage).toHaveBeenCalledWith({ type: 'paldex-open', url: '#/feed' });
    expect(sw.windows[1].focus).toHaveBeenCalled();
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });
  it('tap with PalDex closed: opens it on that screen', async () => {
    const sw = load();
    await sw.fire('notificationclick', { notification: { close: vi.fn(), data: { url: '#/friends' } } });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(SCOPE + '#/friends');
    await sw.fire('notificationclick', { notification: { close: vi.fn(), data: { url: 'javascript:alert(1)' } } });
    expect(sw.self.clients.openWindow).toHaveBeenLastCalledWith(SCOPE + '#/');
  });
});

describe('listenForPushOpen', () => {
  it('moves to the screen the service worker names; ignores anything else', () => {
    let on: (e: Event) => void = () => {};
    listenForPushOpen({ addEventListener: (_t: string, f: EventListenerOrEventListenerObject) => { on = f as (e: Event) => void; } } as Pick<ServiceWorkerContainer, 'addEventListener'>);
    location.hash = '#/';
    on(new MessageEvent('message', { data: { type: 'paldex-open', url: '#/friends' } }));
    expect(location.hash).toBe('#/friends');
    on(new MessageEvent('message', { data: { type: 'paldex-open', url: 'https://evil.example/#/x' } }));
    on(new MessageEvent('message', { data: { type: 'other', url: '#/feed' } }));
    expect(location.hash).toBe('#/friends');
  });
});
