import { describe, it, expect } from 'vitest';
import { Store } from '../db/store';
import { FakeServer } from './fake';

const chester = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };
const pass = { skillId: 'clicker', reps: 10, good: 10, mood: 'Happy' as const, seconds: 90 };
let n = 0;
const device = (server: FakeServer) => { const s = new Store('sync' + ++n, server.device()); s.rand = () => 0.5; return s; };

describe('training Chester together', () => {
  it('shares his progress both ways, with daily limits and treats counted across both phones', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load();
    await josh.saveCat(chester);
    await josh.logSet({ ...pass, at: Date.parse('2026-11-08T09:00:00') });
    await josh.verifyCode('josh@example.com', '123456', 'Josh');
    expect(josh.get().household?.members).toEqual([{ userId: 'u:josh@example.com', name: 'Josh' }]);
    const code = josh.get().household!.inviteCode;

    const sam = device(server); await sam.load();
    await sam.verifyCode('sam@example.com', '123456', 'Sam', false);
    expect(await sam.join('nope', 'Sam')).toBe(false);
    expect(await sam.join(code, 'Sam')).toBe(true);
    expect(sam.get().cat?.name).toBe('Chester');
    expect(sam.get().sets).toHaveLength(1);

    // her pass right after his = two in a row → Chester steps up on both phones
    const r = await sam.logSet({ ...pass, at: Date.parse('2026-11-08T10:00:00') });
    expect(r?.event).toBe('stepUp');
    await sam.sync(); await josh.sync();
    expect(josh.get().progress.clicker.step).toBe(1);
    expect(josh.get().sets.map((s) => s.by)).toEqual(['u:josh@example.com', 'u:sam@example.com']);
    expect(josh.get().wallet!.treats).toBe(sam.get().wallet!.treats);
    expect(josh.get().household?.members.map((m) => m.name)).toEqual(['Josh', 'Sam']);

    // third rewarded set of the day is hers; his fourth earns nothing
    await sam.logSet({ ...pass, at: Date.parse('2026-11-08T11:00:00') });
    await sam.sync(); await josh.sync();
    const fourth = await josh.logSet({ ...pass, at: Date.parse('2026-11-08T12:00:00') });
    expect(fourth?.reward.rewarded).toBe(false);
  });

  it('keeps training offline and catches up later without losing or doubling sets', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.verifyCode('josh@example.com', '123456', 'Josh');
    server.online = false;
    await josh.logSet(pass); await josh.logSet(pass);
    expect(josh.get().sync).toBe('offline');
    expect(josh.get().progress.clicker.step).toBe(1);
    server.online = true;
    await josh.sync(); await josh.sync();
    expect(server.sets.size).toBe(2);
    expect(josh.get().sync).toBe('ok');
  });

  it('replaces her own practice Chester when she joins his', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.verifyCode('josh@example.com', '123456', 'Josh');
    const sam = device(server); await sam.load();
    await sam.saveCat({ ...chester, name: 'Practice' }); await sam.logSet(pass);
    await sam.verifyCode('sam@example.com', '123456', 'Sam', false);
    await sam.join(josh.get().household!.inviteCode, 'Sam');
    expect(sam.get().cat?.name).toBe('Chester');
    expect(sam.get().sets).toHaveLength(0);
    expect(server.cats.size).toBe(1);
    const again = device(server); (again.remote as any).me = { userId: 'u:sam@example.com', email: 'sam@example.com' };
    await again.load(); await again.sync();
    expect(again.get().cat?.name).toBe('Chester');
  });

  it('keeps treats saved up before sets remembered their gifts', async () => {
    const a = new Store('legacy'); await a.load(); await a.saveCat(chester);
    await a.db.wallet.update(a.get().cat!.id, { treats: 40, bond: 3, toys: ['a toy mouse'] });
    await a.db.cats.update(a.get().cat!.id, { carry: undefined });
    const b = new Store('legacy'); await b.load();
    expect(b.get().wallet).toMatchObject({ treats: 40, bond: 3, toys: ['a toy mouse'] });
  });
});
