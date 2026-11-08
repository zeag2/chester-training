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
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    expect(josh.get().household?.members).toEqual([{ userId: 'u:josh@example.com', name: 'Josh' }]);
    const code = josh.get().household!.inviteCode;

    const sam = device(server); await sam.load();
    await sam.signIn('sam@example.com', 'catnip1', 'Sam', false, true);
    await expect(sam.signIn('josh@example.com', 'guess!', 'Sam', false)).rejects.toThrow('bad-login');
    await expect(sam.signIn('josh@example.com', 'guess!', 'Sam', false, true)).rejects.toThrow('email-taken');
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
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
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
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const sam = device(server); await sam.load();
    await sam.saveCat({ ...chester, name: 'Practice' }); await sam.logSet(pass);
    await sam.signIn('sam@example.com', 'catnip1', 'Sam', false, true);
    await sam.join(josh.get().household!.inviteCode, 'Sam');
    expect(sam.get().cat?.name).toBe('Chester');
    expect(sam.get().sets).toHaveLength(0);
    expect(server.cats.size).toBe(1);
    const again = device(server); (again.remote as any).me = { userId: 'u:sam@example.com', email: 'sam@example.com' };
    await again.load(); await again.sync();
    expect(again.get().cat?.name).toBe('Chester');
  });

  it('makes the account first during onboarding, then shares the cat once it exists, and restores it on a new phone', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load();
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    expect(josh.get().cat).toBeNull();
    await josh.saveCat(chester); await josh.logSet(pass); await josh.sync();
    expect(josh.get().household?.members).toEqual([{ userId: 'u:josh@example.com', name: 'Josh' }]);
    const phone2 = device(server); await phone2.load();
    await phone2.signIn('josh@example.com', 'catnip1', '', true, false);
    expect(phone2.get().cat?.name).toBe('Chester');
    expect(phone2.get().sets).toHaveLength(1);
  });

  it('greets each trainer by their own name, fills in a missing name, and lets you change it', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const sam = device(server); await sam.load();
    await sam.signIn('sam@example.com', 'catnip1', '', false, true); // signed up without a name
    await sam.join(josh.get().household!.inviteCode, '');
    const nameOf = (s: Store) => s.get().household!.members.find((m) => m.userId === s.get().account!.userId)!.name;
    expect(nameOf(josh)).toBe('Josh');
    await sam.renameMe('Sam');
    expect(nameOf(sam)).toBe('Sam');
    await josh.sync();
    expect(josh.get().household!.members.map((m) => m.name)).toEqual(['Josh', 'Sam']);
  });

  it('shares care both ways: new items, edits and deletes, newest edit winning', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const sam = device(server); await sam.load();
    await sam.signIn('sam@example.com', 'catnip1', 'Sam', false, true);
    await sam.join(josh.get().household!.inviteCode, 'Sam');
    const food = await josh.saveCare('food', { name: 'Tuna pate', type: 'wet', verdict: 'love', current: true });
    await josh.saveCare('weight', { lb: 3.2 });
    await josh.sync(); await sam.sync();
    expect(sam.get().care.map((c) => c.kind).sort()).toEqual(['food', 'weight']);
    await sam.saveCare('food', { name: 'Tuna pate', type: 'wet', verdict: 'no', current: false }, { id: food!.id });
    await sam.sync(); await josh.sync();
    expect((josh.get().care.find((c) => c.id === food!.id)!.data as { verdict: string }).verdict).toBe('no');
    await josh.deleteCare(food!.id); await josh.sync(); await sam.sync();
    expect(sam.get().care.map((c) => c.kind)).toEqual(['weight']);
  });

  it('keeps training in sync even before the care table is set up', async () => {
    const server = new FakeServer(); server.careTable = false;
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    await josh.saveCare('symptom', { what: 'Sneezing' }); await josh.logSet(pass); await josh.sync();
    expect(josh.get().sync).toBe('ok'); expect(josh.get().careSync).toBe('missing');
    expect(server.sets.size).toBe(1); expect(josh.get().care).toHaveLength(1);
    server.careTable = true; await josh.sync();
    expect(josh.get().careSync).toBe('ok'); expect(server.care.size).toBe(1);
  });

  it('stores a vet document for both trainers, reads it, and removes the file when deleted', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const doc = await josh.addDoc(new File(['%PDF-1.4'], 'kitten_shots-invoice.pdf', { type: 'application/pdf' }));
    expect(doc.data).toMatchObject({ title: 'kitten shots invoice', mime: 'application/pdf' });
    expect(server.files.has(doc.data.path)).toBe(true);
    expect(doc.data.path.startsWith(josh.get().cat!.id + '/')).toBe(true);
    await expect(josh.readDoc(doc.data.path)).rejects.toThrow('reader-missing');
    server.reading = { title: 'Kitten shots', docDate: '2026-11-02', clinic: 'Northside Vet', visitReason: 'Kitten shots', vetNotes: null, weightLb: 3, items: [{ name: 'FVRCP', kind: 'vaccine', date: '2026-11-02', nextDue: '2026-11-30', notes: null }], summary: 'Invoice for kitten shots.' };
    expect((await josh.readDoc(doc.data.path)).items[0].nextDue).toBe('2026-11-30');
    await josh.removeDoc(doc); await josh.sync();
    expect(server.files.size).toBe(0); expect(josh.get().care).toHaveLength(0);
  });

  it('never gives one person’s name to another who signs in on the same phone', async () => {
    const server = new FakeServer();
    const phone = device(server); await phone.load(); await phone.saveCat(chester);
    await phone.signIn('jo@shared.test', 'catnip1', '', true, true); // Josh never typed a name
    const code = phone.get().household!.inviteCode;
    await phone.signOut();
    const sam = device(server); await sam.load();
    await sam.signIn('meg@shared.test', 'catnip1', 'Megan', false, true); await sam.join(code, 'Megan');
    // Josh signs back in on the shared phone: his row must stay unnamed, not become "Megan"
    await phone.signIn('jo@shared.test', 'catnip1', '', true, false);
    const names = phone.get().household!.members.map((m) => [m.userId, m.name]);
    expect(names).toEqual([['u:jo@shared.test', ''], ['u:meg@shared.test', 'Megan']]);
    await phone.renameMe('Josh');
    expect(phone.get().household!.members.map((m) => m.name)).toEqual(['Josh', 'Megan']);
  });

  it('keeps treats saved up before sets remembered their gifts', async () => {
    const a = new Store('legacy'); await a.load(); await a.saveCat(chester);
    await a.db.wallet.update(a.get().cat!.id, { treats: 40, bond: 3, toys: ['a toy mouse'] });
    await a.db.cats.update(a.get().cat!.id, { carry: undefined });
    const b = new Store('legacy'); await b.load();
    expect(b.get().wallet).toMatchObject({ treats: 40, bond: 3, toys: ['a toy mouse'] });
  });
});
