import { describe, expect, it, vi } from 'vitest';
import { Store } from '../db/store';
import { FakeServer } from './fake';

// jsdom has no canvas: pretend every photo shrinks to a small 1600 × 1200 JPEG
vi.mock('../lib/photos', async (orig) => ({ ...(await orig<typeof import('../lib/photos')>()), shrinkPhoto: vi.fn(async () => ({ blob: new Blob(['jpg']), width: 1600, height: 1200 })) }));

const cat = (name: string) => ({ name, birthday: '2026-04', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
let n = 0;
const device = async (server: FakeServer, email: string, name: string, pet: string) => {
  const s = new Store('photos' + ++n, server.device()); s.rand = () => 0.5; await s.load();
  await s.saveCat(cat(pet)); await s.signIn(email, 'catnip1', name, true, true); await s.loadFriends(); return s;
};
const befriend = async (a: Store, b: Store) => { await a.addFriend(b.get().friends!.code); await b.loadFriends(); await b.answerFriend(a.get().account!.userId, true); await a.loadFriends(); };

describe('photo feed', () => {
  it('posts a shrunk photo that the household and friends see, newest first, and strangers don’t', async () => {
    const server = new FakeServer();
    const pia = await device(server, 'pia@example.com', 'Pia', 'Mochi');
    const fen = await device(server, 'fen@example.com', 'Fen', 'Tofu');
    const sol = await device(server, 'sol@example.com', 'Sol', 'Bean');
    await befriend(pia, fen);
    const mochi = pia.get().cat!.id;

    await pia.postPhoto(mochi, new Blob(['big photo']), '  Sit!  ');
    await fen.postPhoto(fen.get().cat!.id, new Blob(['x']), '');
    const pf = await pia.photoFeed();
    expect(pf.photos.map((p) => [p.caption, p.width, p.height])).toEqual([['', 1600, 1200], ['Sit!', 1600, 1200]]);
    expect(pf.photos[1].path).toMatch(new RegExp('^' + mochi + '/.+\\.jpg$'));
    expect(pf.urls[pf.photos[1].path]).toBeTruthy();
    expect(server.files.get('pet-photos/' + pf.photos[1].path)).toBeTruthy();

    expect((await fen.photoFeed()).photos).toHaveLength(2);
    expect((await sol.photoFeed()).photos).toHaveLength(0);
    // not for someone else's pet
    await expect(sol.postPhoto(mochi, new Blob(['x']), 'mine')).rejects.toThrow();
    // unfriending hides them at once
    await pia.removeFriend(fen.get().account!.userId);
    expect((await fen.photoFeed()).photos.map((p) => p.catId)).toEqual([fen.get().cat!.id]);
  });
  it('paws once each, hides a friend’s photo only for me, lets the poster edit and the household delete', async () => {
    const server = new FakeServer();
    const pia = await device(server, 'pia@example.com', 'Pia', 'Mochi');
    const fen = await device(server, 'fen@example.com', 'Fen', 'Tofu');
    const sol = await device(server, 'sol@example.com', 'Sol', 'Bean');
    await befriend(pia, fen);
    await pia.postPhoto(pia.get().cat!.id, new Blob(['x']), 'Sit!', 'sit');
    const [ph] = (await fen.photoFeed()).photos;
    expect(ph.skill).toBe('sit');

    await fen.setPaw(ph.id, true); await fen.setPaw(ph.id, true); await pia.setPaw(ph.id, true);
    expect((await fen.photoFeed()).photos[0]).toMatchObject({ paws: 2, pawed: true });
    await fen.setPaw(ph.id, false);
    expect((await pia.photoFeed()).photos[0]).toMatchObject({ paws: 1, pawed: true });
    await expect(sol.setPaw(ph.id, true)).rejects.toThrow(); // can't see it

    await fen.setPhotoHidden(ph.id, true);
    expect((await fen.photoFeed()).photos).toHaveLength(0);
    expect((await pia.photoFeed()).photos).toHaveLength(1); // only for Fen
    await fen.setPhotoHidden(ph.id, false);
    expect((await fen.photoFeed()).photos).toHaveLength(1);

    await fen.editCaption(ph.id, 'mine now'); // not the poster: nothing changes
    await pia.editCaption(ph.id, '  Sit, finally!  ');
    expect((await fen.photoFeed()).photos[0].caption).toBe('Sit, finally!');

    await expect(fen.deletePhoto(ph)).rejects.toThrow('not-allowed');
    await pia.deletePhoto(ph);
    expect((await fen.photoFeed()).photos).toHaveLength(0);
    expect(server.files.has('pet-photos/' + ph.path)).toBe(false);
  });
  it('says photos-missing before the SQL is run', async () => {
    const server = new FakeServer(); server.photosTable = false;
    const pia = await device(server, 'pia@example.com', 'Pia', 'Mochi');
    await expect(pia.photoFeed()).rejects.toThrow('photos-missing');
  });
});
