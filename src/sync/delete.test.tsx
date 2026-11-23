import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { Store, store } from '../db/store';
import { FakeServer } from './fake';
import { Settings } from '../screens/Settings';
import { Privacy } from '../screens/Privacy';
import App from '../App';

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
const pass = { skillId: 'clicker', reps: 10, good: 10, mood: 'Happy' as const, seconds: 90 };
let n = 0;
const device = (server: FakeServer) => new Store('del' + ++n, server.device());
const asSet = (p: object) => (store as unknown as { set: (p: object) => void }).set(p);

window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia;
afterEach(() => { cleanup(); location.hash = ''; vi.restoreAllMocks(); });

describe('delete my account', () => {
  it('hands a shared cat to the household, keeps its history, and empties this phone', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load();
    await josh.saveCat(cat('Chester'));
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    await josh.logSet({ ...pass, at: Date.parse('2026-11-08T09:00:00') });
    await josh.sync();
    const megan = device(server); await megan.load();
    await megan.signIn('megan@example.com', 'catnip1', 'Megan', false, true);
    expect(await megan.join(josh.get().household!.inviteCode, 'Megan')).toBe(true);

    const plan = (await josh.accountDeletion())!;
    expect(plan.deleted).toEqual([]);
    expect(plan.kept).toEqual([{ id: josh.get().cat!.id, name: 'Chester', keeper: 'Megan' }]);
    await josh.deleteAccount(plan);

    expect(josh.get().account).toBeNull();
    expect(josh.get().cat).toBeNull();
    expect(await josh.db.cats.count() + await josh.db.sets.count() + await josh.db.care.count()).toBe(0);
    expect(server.passwords.has('josh@example.com')).toBe(false);
    const house = [...server.houses.values()][0];
    expect(house.owner).toBe('u:megan@example.com');
    await megan.sync();
    expect(megan.get().cat?.name).toBe('Chester');
    expect(megan.get().sets.map((s) => s.by)).toEqual([undefined]); // Josh's set stays, without his name
  });

  it('deletes a cat nobody else has, with its files', async () => {
    const server = new FakeServer();
    const uma = device(server); await uma.load();
    await uma.saveCat(cat('Ula'));
    await uma.signIn('uma@example.com', 'catnip1', 'Uma', true, true);
    const id = uma.get().cat!.id;
    server.files.set(`${id}/x/bill.pdf`, new Blob(['x']));
    const plan = (await uma.accountDeletion())!;
    expect(plan.deleted).toEqual([{ id, name: 'Ula' }]);
    expect(plan.files).toEqual([{ bucket: 'pet-docs', path: `${id}/x/bill.pdf` }]);
    await uma.deleteAccount(plan);
    expect(server.cats.size + server.houses.size + server.files.size).toBe(0);
  });

  it('is "coming soon" until its SQL is run, and keeps everything when the delete fails', async () => {
    const server = new FakeServer();
    const s = device(server); await s.load();
    await s.saveCat(cat('Pip'));
    await s.signIn('sam@example.com', 'catnip1', 'Sam', true, true);
    const plan = (await s.accountDeletion())!;
    server.deletionTable = false;
    expect(await s.accountDeletion()).toBeNull();
    await expect(s.deleteAccount(plan)).rejects.toThrow();
    expect(s.get().account).not.toBeNull();
    expect(await s.db.cats.count()).toBe(1);
  });

  it('Settings: confirm by typing DELETE, then back to the start', async () => {
    await store.load();
    if (!store.get().cat) await store.saveCat(cat('Chester'));
    asSet({ account: { userId: 'me', email: 'me@example.com' } });
    vi.spyOn(store, 'accountDeletion').mockResolvedValue({ deleted: [{ id: 'l', name: 'Luna' }], kept: [{ id: 'c', name: 'Chester', keeper: 'Megan' }], files: [] });
    const del = vi.spyOn(store, 'deleteAccount').mockImplementation(async () => { asSet({ account: null }); });
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText(/Chester stays with Megan, with its history/)).toBeTruthy();
    expect(screen.getByText(/and Luna with all its logs, documents and photos/)).toBeTruthy();
    const go = screen.getAllByRole('button', { name: 'Delete my account' }).at(-1)!;
    expect((go as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), { target: { value: 'delete' } });
    expect((go as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(go); });
    expect(del).toHaveBeenCalledOnce();
    await waitFor(() => expect(location.hash).toBe('#/home'));
  });

  it('Settings says "coming soon" when the server can’t delete accounts yet', async () => {
    await store.load();
    if (!store.get().cat) await store.saveCat(cat('Chester'));
    asSet({ account: { userId: 'me', email: 'me@example.com' } });
    vi.spyOn(store, 'accountDeletion').mockResolvedValue(null);
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText(/Coming soon\./)).toBeTruthy();
    expect(screen.queryByLabelText('Type DELETE to confirm')).toBeNull();
    asSet({ account: null });
  });
});

describe('privacy page', () => {
  it('says what is stored and how to delete it, and opens from Settings', async () => {
    render(<Privacy />);
    for (const t of [/Without an account/, /With an account/, /Who can see it/, /Deleting your account/]) expect(screen.getByRole('heading', { name: t })).toBeTruthy();
    expect(screen.getByText(/Open Pet Food Facts/)).toBeTruthy();
    cleanup();
    await store.load();
    if (!store.get().cat) await store.saveCat(cat('Chester'));
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /Privacy/ }));
    expect(location.hash).toBe('#/privacy');
  });

  it('opens at #/privacy even before there is a cat', async () => {
    await store.load();
    location.hash = '#/privacy';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy' })).toBeTruthy();
  });
});
