import { describe, it, expect } from 'vitest';
import { Store } from '../db/store';
import { FakeServer } from './fake';
import { owned } from '../engine/corner';
import { localDay } from '../engine/day';
import { dailyToday } from '../engine/care';

const chester = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };
const pass = { skillId: 'clicker', reps: 10, good: 10, mood: 'Happy' as const, seconds: 90 };
let n = 0;
const device = (server: FakeServer) => { const s = new Store('sync' + ++n, server.device()); s.rand = () => 0.5; return s; };
/** a sends b a friend request by code and b accepts it */
const befriend = async (a: Store, b: Store) => { await a.addFriend(b.get().friends!.code); await b.loadFriends(); await b.answerFriend(a.get().account!.userId, true); await a.loadFriends(); };

describe('training Chester together', () => {
  it('shares his progress both ways, with daily limits and treats counted across both phones', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load();
    await josh.saveCat(chester);
    await josh.logSet({ ...pass, at: Date.parse('2026-11-08T09:00:00') });
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    expect(josh.get().household?.members.map((m) => [m.userId, m.name])).toEqual([['u:josh@example.com', 'Josh']]);
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

  it('adds his Chester when she joins, keeping her own practice cat (it had a set) as a second pet', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const sam = device(server); await sam.load();
    await sam.saveCat({ ...chester, name: 'Practice' }); await sam.logSet(pass);
    await sam.signIn('sam@example.com', 'catnip1', 'Sam', false, true);
    await sam.join(josh.get().household!.inviteCode, 'Sam');
    expect(sam.get().cat?.name).toBe('Chester');
    expect(sam.get().sets).toHaveLength(0);
    expect(sam.get().pets.map((p) => p.name).sort()).toEqual(['Chester', 'Practice']);
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
    expect(josh.get().household?.members.map((m) => [m.userId, m.name])).toEqual([['u:josh@example.com', 'Josh']]);
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

  it('lets whoever set the cat up remove a duplicate account, and nobody else', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('owner@dupe.test', 'catnip1', 'Josh', true, true);
    const code = josh.get().household!.inviteCode;
    const meg1 = device(server); await meg1.load(); await meg1.signIn('meg@dupe.test', 'catnip1', 'Megan', false, true); await meg1.join(code, 'Megan');
    const meg2 = device(server); await meg2.load(); await meg2.signIn('megg@dupe.test', 'catnip1', 'Megan', false, true); await meg2.join(code, 'Megan');
    await josh.sync();
    expect(josh.get().household!.members.map((m) => [m.name, m.email, m.owner])).toEqual([['Josh', 'owner@dupe.test', true], ['Megan', 'meg@dupe.test', false], ['Megan', 'megg@dupe.test', false]]);
    await expect(meg1.removeMember('u:megg@dupe.test')).rejects.toThrow('not-allowed');
    await josh.removeMember('u:megg@dupe.test');
    expect(josh.get().household!.members.map((m) => m.email)).toEqual(['owner@dupe.test', 'meg@dupe.test']);
  });

  it('keeps several pets apart, remembers which one is shown, and shares each separately', async () => {
    const server = new FakeServer();
    const a = new Store('pets1', server.device()); a.rand = () => 0.5; await a.load();
    await a.saveCat(chester); await a.logSet(pass);
    await a.saveCat({ ...chester, name: 'Luna', sex: 'f' }); // a second pet: becomes the one shown
    expect(a.get().cat?.name).toBe('Luna'); expect(a.get().sets).toHaveLength(0);
    expect(a.get().pets.map((p) => p.name)).toEqual(['Chester', 'Luna']);
    await a.logSet(pass); await a.logSet(pass);
    const again = new Store('pets1'); await again.load();
    expect(again.get().cat?.name).toBe('Luna'); expect(again.get().sets).toHaveLength(2);
    await again.switchPet(again.get().pets[0].id);
    expect(again.get().cat?.name).toBe('Chester'); expect(again.get().sets).toHaveLength(1);
    // both pets reach a new phone signed in to the same account
    await a.signIn('two@pets.test', 'catnip1', 'Josh', true, true);
    await a.switchPet(a.get().pets[0].id); await a.sync();
    const phone2 = new Store('pets2', server.device()); await phone2.load();
    await phone2.signIn('two@pets.test', 'catnip1', '', true, false);
    expect(phone2.get().pets.map((p) => p.name).sort()).toEqual(['Chester', 'Luna']);
  });

  it('shares a whole household: a pet added later reaches everyone, and removing someone removes all pets', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@house.test', 'catnip1', 'Josh', true, true);
    const meg = device(server); await meg.load();
    await meg.signIn('meg@house.test', 'catnip1', 'Megan', false, true);
    await meg.join(josh.get().household!.inviteCode, 'Megan');
    // Josh adds a second cat: it goes into the same household, no new invite
    await josh.saveCat({ ...chester, name: 'Luna', sex: 'f' }); await josh.sync();
    expect(josh.get().cat?.householdId).toBe(server.houseOf(josh.get().pets[0].id)!.id);
    await meg.sync();
    expect(meg.get().pets.map((p) => p.name).sort()).toEqual(['Chester', 'Luna']);
    expect(server.houses.size).toBe(1);
    // she logs a set for Luna; Josh sees it
    await meg.switchPet(meg.get().pets.find((p) => p.name === 'Luna')!.id); await meg.logSet(pass); await meg.sync();
    await josh.sync(); expect(josh.get().sets).toHaveLength(1);
    // removed from the household: no access to either pet
    await josh.removeMember('u:meg@house.test');
    expect(await meg.remote!.myCatIds()).toEqual([]);
    expect(josh.get().household!.members.map((m) => m.name)).toEqual(['Josh']);
  });

  it('keeps treats saved up before sets remembered their gifts', async () => {
    const a = new Store('legacy'); await a.load(); await a.saveCat(chester);
    await a.db.wallet.update(a.get().cat!.id, { treats: 40, bond: 3, toys: ['a toy mouse'] });
    await a.db.cats.update(a.get().cat!.id, { carry: undefined });
    const b = new Store('legacy'); await b.load();
    expect(b.get().wallet).toMatchObject({ treats: 40, bond: 3, toys: ['a toy mouse'] });
  });
  it('keeps both phones’ corner buys, shares the daily gift once, and agrees on the treat balance', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    for (let k = 0; k < 3; k++) await josh.logSet({ ...pass });
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const meg = device(server); await meg.load();
    await meg.signIn('meg@example.com', 'catnip1', 'Megan', false, true);
    expect(await meg.join(josh.get().household!.inviteCode, 'Megan')).toBe(true);
    const earned = josh.get().wallet!.treats;
    expect(earned).toBeGreaterThanOrEqual(30);

    // both buy something while out of touch with each other
    expect(await josh.buy('bell')).toBe(true);
    expect(await meg.buy('box')).toBe(true);
    expect(josh.get().cat!.corner!.wearing).toBe('bell');
    const gift = await meg.claimGift();
    expect(gift).toBeGreaterThanOrEqual(2);
    await meg.sync(); await josh.sync(); await meg.sync();
    expect(await josh.claimGift()).toBe(0); // already opened by Megan today
    for (const s of [josh, meg]) {
      expect(s.get().wallet!.treats).toBe(earned - 12 - 8 + gift);
      expect(s.get().cat!.corner!.log.map((e) => e.item ?? e.kind).sort()).toEqual(['bell', 'box', 'gift']);
      expect(s.get().cat!.corner!.wearing).toBe('bell');
    }
    expect(await meg.buy('box')).toBe(false); // already owned
    expect(await josh.play('box')).toBe(true);
    expect(await josh.play('box')).toBe(false); // one bond point a day
    await josh.sync(); await meg.sync();
    expect(meg.get().wallet!.bond).toBe(josh.get().wallet!.bond);
  });
  it('adds friends by code both ways and shows only their pets’ cards', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.logSet({ ...pass });
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    await josh.buy('bell').catch(() => false);
    const erin = device(server); await erin.load();
    await erin.saveCat({ ...chester, name: 'Mochi', coat: 'orange' });
    await erin.signIn('erin@example.com', 'catnip1', 'Erin', true, true);
    await josh.sync(); await erin.sync();

    await josh.loadFriends(); await erin.loadFriends();
    const code = erin.get().friends!.code;
    expect(code).toBeTruthy();
    expect(await josh.addFriend('WRONG')).toBeNull();
    expect(await josh.addFriend(josh.get().friends!.code)).toBeNull(); // not yourself
    const before = josh.get().wallet!.treats, bondBefore = josh.get().wallet!.bond;
    // entering Erin's code sends her a request: not friends yet, no bonus, no cards
    expect(await josh.addFriend(code.toLowerCase())).toEqual({ name: 'Erin', status: 'sent' });
    expect(josh.get().friends!.list).toEqual([]); expect(josh.get().friends!.pets).toEqual([]);
    expect(josh.get().wallet!.treats).toBe(before);
    expect(josh.get().requests).toEqual([{ userId: 'u:erin@example.com', name: 'Erin', incoming: false }]);
    expect(await josh.addFriend(code)).toEqual({ name: 'Erin', status: 'sent' }); // asking twice is still one request
    // Erin sees "Accept Josh?" and accepts
    const erinBefore = erin.get().wallet!.treats;
    await erin.loadFriends();
    expect(erin.get().requests).toEqual([{ userId: 'u:josh@example.com', name: 'Josh', incoming: true }]);
    await erin.answerFriend('u:josh@example.com', true);
    expect(erin.get().requests).toEqual([]);
    expect(erin.get().wallet!.treats).toBe(erinBefore + 15); // her bonus lands when she accepts
    expect(erin.get().friendNews?.names).toEqual(['Josh']);
    await josh.loadFriends(); expect(josh.get().requests).toEqual([]);
    // a bonus for making a friend: treats, bond and the Friendship scarf; Home gets a card
    expect(josh.get().wallet!.treats).toBe(before + 15); expect(josh.get().wallet!.bond).toBe(bondBefore + 1);
    expect(owned(josh.get().cat!.corner).has('scarf')).toBe(true);
    expect(josh.get().friendNews).toEqual({ names: ['Erin'], scarf: true });
    expect(josh.get().friends!.list.map((f) => f.name)).toEqual(['Erin']);
    const mochi = josh.get().friends!.pets;
    expect(mochi.map((p) => [p.ownerName, p.card.name, p.card.coat])).toEqual([['Erin', 'Mochi', 'orange']]);
    expect(mochi[0].card.setsWeek).toBe(0);

    await erin.loadFriends(); // both ways, and her view shows Chester's published card
    expect(erin.get().wallet!.treats).toBe(erinBefore + 15);
    const ch = erin.get().friends!.pets[0];
    expect([ch.ownerName, ch.card.name, ch.card.setsWeek]).toEqual(['Josh', 'Chester', 1]);

    await erin.removeFriend(erin.get().friends!.list[0].userId);
    await josh.loadFriends();
    expect(josh.get().friends!.list).toEqual([]); expect(josh.get().friends!.pets).toEqual([]);
    // friends again: no second bonus for the same friend
    const again = josh.get().wallet!.treats;
    await befriend(josh, erin);
    expect(josh.get().friends!.list.map((f) => f.name)).toEqual(['Erin']);
    expect(josh.get().wallet!.treats).toBe(again);
    expect(await josh.addFriend(code)).toEqual({ name: 'Erin', status: 'already' });
  });
  it('lets a friend give each friend’s pet one free treat a day, counted once in the owner’s corner', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const meg = device(server); await meg.load(); await meg.signIn('meg@example.com', 'catnip1', 'Megan', false, true);
    expect(await meg.join(josh.get().household!.inviteCode, 'Megan')).toBe(true);
    const erin = device(server); await erin.load(); await erin.saveCat({ ...chester, name: 'Mochi', coat: 'orange' });
    await erin.signIn('erin@example.com', 'catnip1', 'Erin', true, true);
    await josh.loadFriends(); await erin.loadFriends();
    await befriend(josh, erin); await erin.loadFriends();
    const chesterId = josh.get().cat!.id, mochiId = erin.get().cat!.id;
    expect(erin.get().friends!.given).toEqual([]);

    // Erin treats Chester once today; not twice, and not her own Mochi
    expect(await erin.giveTreat(chesterId)).toBe('given');
    expect(await erin.giveTreat(chesterId)).toBe('already');
    expect(await erin.giveTreat(mochiId)).toBe('error');
    expect(erin.get().friends!.given).toEqual([chesterId]);
    await erin.loadFriends(); expect(erin.get().friends!.given).toEqual([chesterId]); // remembered by the server

    // Josh's phone turns it into +1 treat and a line on Home; checking again doesn't pay twice
    const before = josh.get().wallet!.treats;
    expect(await josh.collectTreats(true)).toEqual(['Erin']);
    expect(josh.get().wallet!.treats).toBe(before + 1);
    expect(josh.get().treatNews).toMatchObject({ cat: 'Chester', names: ['Erin'], catId: chesterId });
    expect(josh.get().cat!.corner!.log.filter((e) => e.kind === 'treat').map((e) => [e.id, e.treats, e.by])).toEqual([['treat-u:erin@example.com-' + localDay(Date.now()), 1, 'u:erin@example.com']]);
    expect(await josh.collectTreats(true)).toEqual([]);
    expect(josh.get().wallet!.treats).toBe(before + 1);
    // Josh says thanks; Erin's Home shows Chester's thank-you until she dismisses it
    expect(await josh.thankTreats()).toBe(true); expect(josh.get().treatNews?.thanked).toBe(true);
    await erin.loadFriends(); expect(erin.get().thanks.map((t) => t.catName)).toEqual(['Chester']);
    erin.dismissThanks(); await erin.loadFriends(); expect(erin.get().thanks).toEqual([]);
    josh.dismissTreatNews(); expect(josh.get().treatNews).toBeNull();

    // Megan's phone (same household) gets Josh's entry by sync, so the treat is never counted twice
    await josh.sync(); await meg.sync();
    expect(await meg.collectTreats(true)).toEqual([]);
    await meg.sync(); await josh.sync();
    expect(meg.get().wallet!.treats).toBe(josh.get().wallet!.treats);
    expect(josh.get().wallet!.treats).toBe(before + 1);

    // a stranger can't give one
    const kim = device(server); await kim.load(); await kim.signIn('kim@example.com', 'catnip1', 'Kim', false, true);
    expect(await kim.giveTreat(chesterId)).toBe('error');
  });
  it('keeps friends working when the treats SQL hasn’t been run yet', async () => {
    const server = new FakeServer(); server.treatsTable = false;
    const a = device(server); await a.load(); await a.saveCat(chester); await a.signIn('a@example.com', 'catnip1', 'A', true, true);
    const b = device(server); await b.load(); await b.saveCat({ ...chester, name: 'Mochi' }); await b.signIn('b@example.com', 'catnip1', 'B', true, true);
    await a.loadFriends(); await b.loadFriends(); await befriend(a, b);
    expect(a.get().friends!.missing).toBeUndefined();
    expect(a.get().friends!.treats).toBe('missing');
    expect(a.get().friends!.pets.map((p) => p.card.name)).toEqual(['Mochi']);
    expect(await a.giveTreat(b.get().cat!.id)).toBe('missing');
    expect(await b.collectTreats(true)).toEqual([]);
  });
  it('pays treats for new care entries once, on every phone, but not for edits', async () => {
    const server = new FakeServer();
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const meg = device(server); await meg.load(); await meg.signIn('meg@example.com', 'catnip1', 'Megan', false, true);
    await meg.join(josh.get().household!.inviteCode, 'Megan');
    const t0 = josh.get().wallet!.treats;
    const w = await josh.saveCare('weight', { lb: 4.1 });
    expect(josh.get().wallet!.treats).toBe(t0 + 7); // entry + weekly weigh-in
    expect(josh.get().careNews).toMatchObject({ treats: 7, why: 'weighIn' });
    await josh.saveCare('weight', { lb: 4.2 }, { id: w!.id }); // an edit pays nothing
    expect(josh.get().wallet!.treats).toBe(t0 + 7);
    await josh.saveCare('symptom', { what: 'Sneezing' });
    await josh.sync(); await meg.sync();
    await meg.saveCare('groom', { what: 'brush' }); // the day's third entry, from the other phone
    await meg.saveCare('groom', { what: 'nails' }); // over the cap
    await meg.sync(); await josh.sync();
    expect(josh.get().wallet!.treats).toBe(t0 + 7 + 2 + 2);
    expect(meg.get().wallet!.treats).toBe(josh.get().wallet!.treats);
  });
  it('shares one-tap daily logs, and keeps them on the phone (without stalling sync) until their SQL is run', async () => {
    const server = new FakeServer(); server.careKinds = ['food', 'vet', 'symptom', 'weight', 'groom', 'med', 'doc'];
    const josh = device(server); await josh.load(); await josh.saveCat(chester);
    await josh.signIn('josh@example.com', 'catnip1', 'Josh', true, true);
    const meg = device(server); await meg.load(); await meg.signIn('meg@example.com', 'catnip1', 'Megan', false, true);
    await meg.join(josh.get().household!.inviteCode, 'Megan');
    await meg.saveCare('daily', { what: 'fed' }); await meg.saveCare('weight', { lb: 4 });
    await meg.sync(); await josh.sync();
    expect(meg.get().sync).toBe('ok'); expect(meg.dailyShared).toBe(false);
    expect(josh.get().care.map((c) => c.kind)).toEqual(['weight']); // the weigh-in still synced
    server.careKinds = null; // Josh runs the SQL
    await meg.sync(); await josh.sync();
    expect(meg.dailyShared).toBe(true);
    const fed = dailyToday(josh.get().care).fed;
    expect(fed.map((f) => f.by)).toEqual(['u:meg@example.com']);
  });
  it('declines quietly, cancels, accepts by entering their code, and removes', async () => {
    const server = new FakeServer();
    const a = device(server); await a.load(); await a.saveCat(chester); await a.signIn('a@example.com', 'catnip1', 'Ann', true, true);
    const b = device(server); await b.load(); await b.saveCat({ ...chester, name: 'Mochi' }); await b.signIn('b@example.com', 'catnip1', 'Bo', true, true);
    await a.loadFriends(); await b.loadFriends();
    await a.addFriend(b.get().friends!.code); await b.loadFriends();
    await b.answerFriend('u:a@example.com', false); // Not now
    expect(b.get().requests).toEqual([]); expect(b.get().friends!.list).toEqual([]);
    await a.loadFriends(); expect(a.get().requests.map((q) => q.incoming)).toEqual([false]); // still "waiting" for Ann
    await a.addFriend(b.get().friends!.code); await b.loadFriends(); expect(b.get().requests).toEqual([]); // not asked twice
    await a.cancelFriendRequest('u:b@example.com'); expect(a.get().requests).toEqual([]);
    // Bo asks; Ann entering Bo's code accepts straight away
    await b.addFriend(a.get().friends!.code);
    expect(await a.addFriend(b.get().friends!.code)).toEqual({ name: 'Bo', status: 'friends' });
    expect(a.get().friends!.pets.map((p) => p.card.name)).toEqual(['Mochi']);
    expect(a.get().requests).toEqual([]);
    // removing (from the Visit page) ends it both ways
    await a.removeFriend('u:b@example.com'); await b.loadFriends();
    expect(a.get().friends!.list).toEqual([]); expect(b.get().friends!.list).toEqual([]);
  });
  it('makes friends straight away until the friend requests SQL is run', async () => {
    const server = new FakeServer(); server.requestsTable = false;
    const a = device(server); await a.load(); await a.signIn('a@example.com', 'catnip1', 'Ann', true, true);
    const b = device(server); await b.load(); await b.signIn('b@example.com', 'catnip1', 'Bo', true, true);
    await a.loadFriends(); await b.loadFriends();
    expect(await a.addFriend(b.get().friends!.code)).toEqual({ name: 'Bo', status: 'friends' });
    expect(a.get().requests).toEqual([]);
    await b.loadFriends(); expect(b.get().friends!.list.map((f) => f.name)).toEqual(['Ann']);
  });
  it('says friends need setting up until the friends SQL is run', async () => {
    const server = new FakeServer(); server.friendsTable = false;
    const a = device(server); await a.load(); await a.signIn('a@example.com', 'catnip1', 'A', false, true);
    await a.loadFriends();
    expect(a.get().friends?.missing).toBe(true);
  });
});
