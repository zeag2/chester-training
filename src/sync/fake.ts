import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';
import type { Vet } from '../engine/vets';
import type { Account, Member, PetCard, Remote } from './remote';

interface House { id: string; code: string; owner: string; members: Member[] }

/** In-memory shared copy with the same rules as the database: a household's people see and train all its pets. */
export class FakeServer {
  cats = new Map<string, { cat: Cat; householdId: string }>();
  houses = new Map<string, House>();
  sets = new Map<string, SetRecord>();
  passwords = new Map<string, string>();
  care = new Map<string, CareItem>();
  careTable = true;
  /** Whether the vets SQL is run; the household's vet contacts. */
  vetsTable = true;
  vets = new Map<string, Vet>();
  /** Care kinds the server accepts (null: all). Tests set it to mimic the daily-logs SQL not being run. */
  careKinds: string[] | null = null;
  files = new Map<string, Blob>();
  reading: DocReading | null = null;
  online = true;
  friendsTable = true;
  profiles = new Map<string, { code: string; name: string }>();
  friendships = new Set<string>();
  /** Whether the friend requests SQL is run (false: entering a code makes friends straight away, as before). */
  requestsTable = true;
  /** friend requests, keyed `from|to` */
  requests = new Map<string, { declined?: boolean }>();
  cards = new Map<string, PetCard>();
  treatsTable = true;
  /** friend treats, keyed `from|cat|day` */
  treats = new Map<string, { from: string; catId: string; day: string; thanked?: boolean }>();
  private n = 0;
  device(): FakeRemote { return new FakeRemote(this); }
  next(p: string) { return p + ++this.n; }
  houseOf(catId: string) { const c = this.cats.get(catId); return c ? this.houses.get(c.householdId) : undefined; }
  isMember(catId: string, userId: string) { return !!this.houseOf(catId)?.members.some((m) => m.userId === userId); }
  /** members as the app sees them for a pet (kept for tests) */
  get members() { return new Map([...this.cats.keys()].map((id) => [id, this.houseOf(id)!.members])); }
}

export class FakeRemote implements Remote {
  me: Account | null = null;
  constructor(private s: FakeServer) {}
  private up() { if (!this.s.online) throw new Error('offline'); }
  private user() { this.up(); if (!this.me) throw new Error('signed out'); return this.me; }
  async account() { return this.me; }
  onAccountChange() { return () => {}; }
  async signIn(email: string, password: string) {
    this.up(); if (this.s.passwords.get(email) !== password) throw new Error('bad-login');
    this.me = { userId: 'u:' + email, email }; return this.me;
  }
  async signUp(email: string, password: string) {
    this.up(); if (this.s.passwords.has(email)) throw new Error('email-taken');
    this.s.passwords.set(email, password); this.me = { userId: 'u:' + email, email }; return this.me;
  }
  async signOut() { this.me = null; }
  private myHouses() { const u = this.user(); return [...this.s.houses.values()].filter((h) => h.members.some((m) => m.userId === u.userId)); }
  async myCatIds() { const hs = new Set(this.myHouses().map((h) => h.id)); return [...this.s.cats].filter(([, c]) => hs.has(c.householdId)).map(([id]) => id); }
  async getCat(id: string) {
    const u = this.user(); const c = this.s.cats.get(id); if (!c || !this.s.isMember(id, u.userId)) return null;
    return { cat: { ...structuredClone(c.cat), householdId: c.householdId }, inviteCode: this.s.houses.get(c.householdId)!.code };
  }
  async createCat(cat: Cat) {
    const u = this.user(); if (this.s.cats.has(cat.id)) throw new Error('exists');
    let hid = cat.householdId;
    if (hid && !this.s.houses.get(hid)?.members.some((m) => m.userId === u.userId)) throw new Error('denied');
    if (!hid) hid = this.myHouses()[0]?.id;
    if (!hid) { hid = this.s.next('h'); this.s.houses.set(hid, { id: hid, code: this.s.next('CODE'), owner: u.userId, members: [{ userId: u.userId, name: '' }] }); }
    this.s.cats.set(cat.id, { cat: structuredClone({ ...cat, householdId: hid }), householdId: hid });
  }
  async updateCat(cat: Cat) { const u = this.user(); if (!this.s.isMember(cat.id, u.userId)) throw new Error('denied'); this.s.cats.get(cat.id)!.cat = structuredClone(cat); }
  async join(code: string, name: string) {
    const u = this.user(); const h = [...this.s.houses.values()].find((x) => x.code === code.toUpperCase()); if (!h) return null;
    if (!h.members.some((m) => m.userId === u.userId)) h.members.push({ userId: u.userId, name });
    return [...this.s.cats].find(([, c]) => c.householdId === h.id)?.[0] ?? '';
  }
  async members(catId: string) {
    const u = this.user(); const h = this.s.houseOf(catId); if (!h || !this.s.isMember(catId, u.userId)) return [];
    return h.members.map((m) => ({ ...structuredClone(m), email: m.userId.replace(/^u:/, ''), owner: m.userId === h.owner }));
  }
  async removeMember(catId: string, userId: string) {
    const u = this.user(); const h = this.s.houseOf(catId);
    if (!h || (u.userId !== userId && h.owner !== u.userId)) throw new Error('not-allowed');
    h.members = h.members.filter((m) => m.userId !== userId);
  }
  async setName(catId: string, name: string) { const u = this.user(); const m = this.s.houseOf(catId)?.members.find((x) => x.userId === u.userId); if (m) m.name = name; }
  async pullSets(catId: string) { const u = this.user(); if (!this.s.isMember(catId, u.userId)) return []; return [...this.s.sets.values()].filter((s) => s.catId === catId).map((s) => structuredClone(s)); }
  async pushSets(sets: SetRecord[]) {
    const u = this.user();
    for (const s of sets) { if (!this.s.isMember(s.catId, u.userId)) throw new Error('denied'); if (!this.s.sets.has(s.id)) this.s.sets.set(s.id, { ...structuredClone(s), by: u.userId }); }
  }
  async pullCare(catId: string) { const u = this.user(); if (!this.s.careTable) throw new Error('relation "public.care" does not exist'); if (!this.s.isMember(catId, u.userId)) return []; return [...this.s.care.values()].filter((c) => c.catId === catId).map((c) => structuredClone(c)); }
  async pushCare(items: CareItem[]) {
    const u = this.user(); if (!this.s.careTable) throw new Error('relation "public.care" does not exist');
    for (const i of items) { if (this.s.careKinds && !this.s.careKinds.includes(i.kind)) throw new Error('new row for relation "care" violates check constraint "care_kind_check"');
      if (!this.s.isMember(i.catId, u.userId)) throw new Error('denied'); this.s.care.set(i.id, { ...structuredClone(i), by: u.userId }); }
  }
  async pullVets(householdId: string) {
    const u = this.user(); if (!this.s.vetsTable) throw new Error('vets-missing');
    if (!this.s.houses.get(householdId)?.members.some((m) => m.userId === u.userId)) return [];
    return [...this.s.vets.values()].filter((v) => v.householdId === householdId).map((v) => structuredClone(v));
  }
  async pushVets(vets: Vet[]) {
    const u = this.user(); if (!this.s.vetsTable) throw new Error('vets-missing');
    for (const v of vets) { if (!this.s.houses.get(v.householdId)?.members.some((m) => m.userId === u.userId)) throw new Error('denied'); this.s.vets.set(v.id, { ...structuredClone(v), by: u.userId }); }
  }
  async uploadDoc(path: string, file: Blob) { const u = this.user(); if (!this.s.isMember(path.split('/')[0], u.userId)) throw new Error('denied'); this.s.files.set(path, file); }
  async docUrl(path: string) { this.user(); return 'blob:' + path; }
  async removeDoc(path: string) { this.user(); this.s.files.delete(path); }
  async readDoc(path: string) { this.user(); if (!this.s.files.has(path)) throw new Error('missing'); if (!this.s.reading) throw new Error('reader-missing'); return this.s.reading; }

  private fr() { const u = this.user(); if (!this.s.friendsTable) throw new Error('friends-missing'); return u; }
  async friendCode(name: string) {
    const u = this.fr(); const p = this.s.profiles.get(u.userId) ?? { code: this.s.next('F').toUpperCase(), name: '' };
    if (name) p.name = name; this.s.profiles.set(u.userId, p); return p.code;
  }
  async addFriend(code: string) {
    const u = this.fr(); const hit = [...this.s.profiles].find(([, p]) => p.code === code.trim().toUpperCase());
    if (!hit || hit[0] === u.userId) return null;
    const them = hit[0]; const name = hit[1].name;
    if (this.s.friendships.has(u.userId + '|' + them)) return { name, status: 'already' as const };
    if (!this.s.requestsTable || this.s.requests.has(them + '|' + u.userId)) { this.befriend(u.userId, them); return { name, status: 'friends' as const }; }
    if (!this.s.requests.has(u.userId + '|' + them)) this.s.requests.set(u.userId + '|' + them, {});
    return { name, status: 'sent' as const };
  }
  private befriend(a: string, b: string) {
    this.s.friendships.add(a + '|' + b); this.s.friendships.add(b + '|' + a);
    this.s.requests.delete(a + '|' + b); this.s.requests.delete(b + '|' + a);
  }
  async friendRequests() {
    const u = this.fr(); if (!this.s.requestsTable) return [];
    return [...this.s.requests].flatMap(([k, r]) => { const [from, to] = k.split('|');
      if (to === u.userId && !r.declined) return [{ userId: from, name: this.s.profiles.get(from)?.name ?? '', incoming: true }];
      if (from === u.userId) return [{ userId: to, name: this.s.profiles.get(to)?.name ?? '', incoming: false }];
      return []; });
  }
  async answerFriend(userId: string, accept: boolean) {
    const u = this.fr(); const r = this.s.requests.get(userId + '|' + u.userId); if (!r) return;
    if (accept) this.befriend(u.userId, userId); else r.declined = true;
  }
  async cancelFriendRequest(userId: string) { const u = this.fr(); this.s.requests.delete(u.userId + '|' + userId); }
  async friends() { const u = this.fr(); return [...this.s.friendships].filter((f) => f.startsWith(u.userId + '|')).map((f) => { const id = f.split('|')[1]; return { userId: id, name: this.s.profiles.get(id)?.name ?? '' }; }); }
  async friendPets() {
    const u = this.fr(); const mine = new Set(this.myHouses().map((h) => h.id));
    return (await this.friends()).flatMap((f) => [...this.s.cats].filter(([, c]) => !mine.has(c.householdId) && this.s.houses.get(c.householdId)?.members.some((m) => m.userId === f.userId))
      .map(([id, c]) => ({ owner: f.userId, ownerName: f.name, catId: id, card: { ...(this.s.cards.get(id) ?? {}), name: c.cat.name, coat: c.cat.coat, eyes: c.cat.eyes, sex: c.cat.sex, birthday: c.cat.birthday } as PetCard })));
  }
  async removeFriend(userId: string) {
    const u = this.fr(); for (const [a, b] of [[u.userId, userId], [userId, u.userId]]) { this.s.friendships.delete(a + '|' + b); this.s.requests.delete(a + '|' + b); }
  }
  async publishCard(catId: string, card: PetCard) { const u = this.fr(); if (!this.s.isMember(catId, u.userId)) throw new Error('not your pet'); this.s.cards.set(catId, structuredClone(card)); }

  private tr() { const u = this.fr(); if (!this.s.treatsTable) throw new Error('treats-missing'); return u; }
  async giveTreat(catId: string, day: string) {
    const u = this.tr();
    if (!(await this.friendPets()).some((p) => p.catId === catId)) throw new Error('not a friend\'s pet');
    const k = u.userId + '|' + catId + '|' + day; if (this.s.treats.has(k)) return false;
    this.s.treats.set(k, { from: u.userId, catId, day }); return true;
  }
  async treatsGiven(day: string) { const u = this.tr(); return [...this.s.treats.values()].filter((t) => t.from === u.userId && t.day === day).map((t) => t.catId); }
  async treatsFor(catId: string) {
    const u = this.tr(); if (!this.s.isMember(catId, u.userId)) return [];
    return [...this.s.treats.values()].filter((t) => t.catId === catId).map((t) => ({ from: t.from, fromName: this.s.profiles.get(t.from)?.name ?? '', day: t.day }));
  }
  async thankTreat(from: string, catId: string, day: string) { const u = this.tr(); if (!this.s.isMember(catId, u.userId)) throw new Error('not your pet'); const t = this.s.treats.get(from + '|' + catId + '|' + day); if (t) t.thanked = true; }
  async myThanks() { const u = this.tr(); return [...this.s.treats.values()].filter((t) => t.from === u.userId && t.thanked).map((t) => ({ catId: t.catId, catName: this.s.cats.get(t.catId)?.cat.name ?? '', day: t.day })); }
}
