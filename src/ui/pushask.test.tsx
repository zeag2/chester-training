// Push notifications in the app: Settings → Notifications and the two asks (after a friend request, after saving a
// repeating medicine). The browser is faked (src/lib/pushtest-env.ts), the server is the in-memory FakeServer.
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { store } from '../db/store';
import { FakeServer } from '../sync/fake';
import { Settings } from '../screens/Settings';
import { InvitePanel } from '../screens/Friends';
import { Care } from '../screens/Care';
import { PushAskHost } from './PushAsk';
import { ToastHost } from './Toast';
import { resetPushReady } from '../lib/push';
import { fakeBrowser, type FakeBrowser } from '../lib/pushtest-env';

const IPHONE_TAB = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1';
let fb: FakeBrowser | null = null;
let server: FakeServer;
const ME = 'u:josh@example.com';
const cat = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };

beforeEach(async () => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia;
  try { localStorage.clear(); } catch { /* */ }
  resetPushReady();
  server = new FakeServer();
  const r = server.device(); await r.signUp('josh@example.com', 'pw123456');
  store.remote = r;
  await store.load();
  if (!store.get().cat) await store.saveCat(cat);
});
afterEach(() => { cleanup(); fb?.restore(); fb = null; location.hash = ''; });
const headings = () => [...document.querySelectorAll('h2')].map((h) => h.textContent);

describe('Settings → Notifications', () => {
  it('hidden until the push SQL is run (the app works as before)', async () => {
    fb = fakeBrowser(); server.pushTable = false;
    render(<Settings />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(headings()).toEqual(['Your cats', 'Household & account', 'App']);
  });

  it('hidden in a browser without push (desktop Firefox without it, an old browser)', async () => {
    fb = fakeBrowser({ push: false, ua: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0' });
    render(<Settings />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(headings()).not.toContain('Notifications');
  });

  it('on: this phone, then which kinds and the medicine hour, saved for me', async () => {
    fb = fakeBrowser();
    render(<><Settings /><ToastHost /></>);
    const phone = await screen.findByRole('switch', { name: 'Notifications on this phone' });
    expect(headings()).toEqual(['Your cats', 'Household & account', 'Notifications', 'App']);
    expect(screen.queryByRole('switch', { name: 'Treats' })).toBeNull(); // kinds only once it's on
    await act(async () => { fireEvent.click(phone); });
    await waitFor(() => expect(phone.getAttribute('aria-checked')).toBe('true'));
    expect(server.pushSubs.size).toBe(1);
    expect(screen.getByText(/Quiet 9 PM–8 AM/)).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Treats' })); });
    await waitFor(() => expect(server.pushPrefs.get(ME)!.treats).toBe(false));
    expect(screen.getByRole('switch', { name: 'Treats' }).getAttribute('aria-checked')).toBe('false');
    const hour = screen.getByLabelText('Medicine reminder at') as HTMLSelectElement;
    expect([...hour.options].map((o) => o.text).slice(0, 2)).toEqual(['6 AM', '7 AM']);
    expect(hour.options[hour.options.length - 1].text).toBe('10 PM');
    await act(async () => { fireEvent.change(hour, { target: { value: '20' } }); });
    await waitFor(() => expect(server.pushPrefs.get(ME)!.medHour).toBe(20));

    // medicine off: no hour to pick
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Medicine' })); });
    expect(screen.queryByLabelText('Medicine reminder at')).toBeNull();

    await act(async () => { fireEvent.click(phone); });
    await waitFor(() => expect(phone.getAttribute('aria-checked')).toBe('false'));
    expect(server.pushSubs.size).toBe(0);
    expect(screen.queryByRole('switch', { name: 'Treats' })).toBeNull();
  });

  it('a change that can’t be saved goes back, with a note', async () => {
    fb = fakeBrowser();
    render(<Settings />);
    const phone = await screen.findByRole('switch', { name: 'Notifications on this phone' });
    await act(async () => { fireEvent.click(phone); });
    await waitFor(() => expect(phone.getAttribute('aria-checked')).toBe('true'));
    server.online = false;
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: 'Friend requests' })); });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t save that/));
    expect(screen.getByRole('switch', { name: 'Friend requests' }).getAttribute('aria-checked')).toBe('true');
  });

  it('iPhone Safari tab: add to the Home Screen first (opens the steps)', async () => {
    fb = fakeBrowser({ push: false, ua: IPHONE_TAB });
    render(<Settings />);
    fireEvent.click(await screen.findByRole('button', { name: /On iPhone, add PalDex to your Home Screen first/ }));
    expect(await screen.findByRole('dialog', { name: 'Add to your home screen' })).toBeTruthy();
  });

  it('blocked in the browser: says where to change it', async () => {
    fb = fakeBrowser({ permission: 'denied' });
    render(<Settings />);
    expect(await screen.findByText(/blocked for PalDex in your phone’s settings/)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Notifications on this phone' })).toBeNull();
  });
});

describe('the asks', () => {
  it('after sending a friend request: "Get a note when Erin says yes?" → Turn on', async () => {
    fb = fakeBrowser();
    const erin = server.device(); await erin.signUp('erin@example.com', 'pw123456'); const code = await erin.friendCode('Erin');
    await store.loadFriends();
    render(<><InvitePanel /><ToastHost /></>);
    fireEvent.change(screen.getByLabelText('Friend code'), { target: { value: code } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })); });
    const ask = await screen.findByRole('region', { name: 'Notifications' });
    expect(ask.textContent).toContain('Get a note when Erin says yes?');
    expect(ask.textContent).toContain('a treat or post a photo');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn on' })); });
    expect(await screen.findByText('Notifications on for this phone')).toBeTruthy();
    expect(server.pushSubs.size).toBe(1);
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
  });

  it('"Not now" hides it, and no ask comes back for 30 days', async () => {
    fb = fakeBrowser();
    const erin = server.device(); await erin.signUp('erin@example.com', 'pw123456'); const code = await erin.friendCode('Erin');
    await store.loadFriends();
    render(<InvitePanel />);
    fireEvent.change(screen.getByLabelText('Friend code'), { target: { value: code } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })); });
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
    expect(fb.requestPermission).not.toHaveBeenCalled(); // the browser was never asked, so it can still say yes later
    cleanup();
    // a repeating medicine right after: no second ask
    location.hash = '#/health/log/med';
    render(<><Care open="med" /><PushAskHost /></>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Revolution' } });
    fireEvent.change(screen.getByLabelText(/Next due/), { target: { value: '2026-12-24' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });

  it('after saving a medicine that comes round again: "Remind you at 9 AM when it’s due?" in a sheet', async () => {
    fb = fakeBrowser();
    location.hash = '#/health/log/med';
    render(<><Care open="med" /><PushAskHost /><ToastHost /></>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Revolution' } });
    fireEvent.change(screen.getByLabelText(/Next due/), { target: { value: '2026-12-24' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    const sheet = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(sheet.textContent).toContain('Remind you at 9 AM when it’s due?');
    expect(sheet.textContent).toContain('Chester needs Revolution');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Turn on' })); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull());
    expect(server.pushPrefs.get(ME)).toMatchObject({ meds: true, medHour: 9 });
  });

  it('a one-off dose asks nothing; nor does anything for someone signed out or before the SQL', async () => {
    fb = fakeBrowser();
    location.hash = '#/health/log/med';
    render(<><Care open="med" /><PushAskHost /></>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pill pocket test' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    cleanup();
    server.pushTable = false; resetPushReady();
    render(<><Care open="med" /><PushAskHost /></>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Revolution' } });
    fireEvent.change(screen.getByLabelText(/Next due/), { target: { value: '2026-12-24' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });
});
