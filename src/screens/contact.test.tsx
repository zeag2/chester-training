import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { store } from '../db/store';
import { FakeServer, FakeRemote } from '../sync/fake';
import type { Remote } from '../sync/remote';
import { Contact } from './Contact';
import { Messages } from './Messages';
import { Settings } from './Settings';
import { Privacy } from './Privacy';
import { ToastHost } from '../ui/Toast';
import { APP_VERSION } from '../lib/version';

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
const asSet = (p: object) => (store as unknown as { set: (p: object) => void }).set(p);
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia;

let server: FakeServer; let remote: FakeRemote; let saved: Remote | null;
beforeEach(() => { server = new FakeServer(); remote = server.device(); saved = store.remote; store.remote = remote; });
afterEach(() => { cleanup(); location.hash = ''; vi.restoreAllMocks(); vi.useRealTimers(); store.remote = saved; asSet({ account: null }); });
const signIn = (email: string) => { remote.me = { userId: 'u:' + email, email }; asSet({ account: remote.me }); };

describe('Contact us', () => {
  it('sends signed out with the app version, then says Saved and thank you', async () => {
    render(<Contact />);
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(screen.getByLabelText('Your name (optional)')).toBeTruthy();
    expect(screen.getByLabelText('How to reach you (optional)')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText('Message')).toBeTruthy());
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '  Luna loves the yarn ball!  ' } });
    fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: 'Erin' } });
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.click(send);
    expect(await screen.findByText('Saved. Thank you!')).toBeTruthy();
    expect(server.contact).toHaveLength(1);
    expect(server.contact[0]).toMatchObject({ name: 'Erin', message: 'Luna loves the yarn ball!', appVersion: APP_VERSION, signedIn: false, reach: undefined });
  });

  it('says it is not available yet before the SQL is run, and with no shared copy', async () => {
    server.contactTable = false;
    render(<Contact />);
    expect(await screen.findByText('Not available yet.')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    cleanup(); store.remote = null;
    render(<Contact />);
    expect(await screen.findByText('Not available yet.')).toBeTruthy();
  });

  it('keeps the message when sending fails', async () => {
    render(<Contact />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'The vet card is cut off' } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(false));
    server.online = false;
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('The vet card is cut off');
  });

  it('is linked from Privacy (no email address there) and from Settings → App', async () => {
    render(<Privacy />);
    expect(screen.queryByText(/@/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Contact us' }));
    expect(location.hash).toBe('#/contact');
    cleanup(); location.hash = '';
    await store.load();
    if (!store.get().cat) await store.saveCat(cat('Chester'));
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Contact us/ }));
    expect(location.hash).toBe('#/contact');
  });
});

describe('Messages inbox', () => {
  it('is hidden in Settings unless you are the app owner', async () => {
    await store.load();
    if (!store.get().cat) await store.saveCat(cat('Chester'));
    signIn('megan@example.com');
    render(<Settings />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('button', { name: /^Messages/ })).toBeNull();
    cleanup();
    server.admins.add('u:josh@example.com'); signIn('josh@example.com');
    render(<Settings />);
    fireEvent.click(await screen.findByRole('button', { name: /^Messages/ }));
    expect(location.hash).toBe('#/messages');
  });

  it('lists newest first, marks done with Undo, and deletes after the Undo note goes', async () => {
    await remote.sendContact({ message: 'First one', appVersion: '0.1.0' });
    await remote.sendContact({ message: 'Second one', name: 'Erin', reach: 'erin@example.com', appVersion: '0.1.0' });
    server.admins.add('u:josh@example.com'); signIn('josh@example.com');
    render(<><Messages /><ToastHost /></>);
    const cards = await screen.findAllByRole('article');
    expect(cards.map((c) => c.textContent)).toEqual([expect.stringContaining('Second one'), expect.stringContaining('First one')]);
    expect(screen.getByText('erin@example.com')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);
    expect(await screen.findByText('Saved · marked done')).toBeTruthy();
    await waitFor(() => expect(server.contact.find((m) => m.message === 'Second one')!.done).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(server.contact.find((m) => m.message === 'Second one')!.done).toBe(false));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    expect(screen.queryByText('First one')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('First one')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    await act(async () => { vi.advanceTimersByTime(6100); });
    vi.useRealTimers();
    await waitFor(() => expect(server.contact.map((m) => m.message)).toEqual(['Second one']));
  });

  it('shows nothing to someone who is not the owner', async () => {
    await remote.sendContact({ message: 'Private', appVersion: '0.1.0' });
    signIn('megan@example.com');
    render(<Messages />);
    expect(await screen.findByText(/Only PalDex’s owner/)).toBeTruthy();
    expect(screen.queryByText('Private')).toBeNull();
  });
});
