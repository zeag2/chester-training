import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';
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
  files = new Map<string, Blob>();
  reading: DocReading | null = null;
  online = true;
  friendsTable = true;
  profiles = new Map<string, { code: string; name: string }>();
  friendships = new Set<string>();
  cards = new Map<string, PetCard>();
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
    for (const i of items) { if (!this.s.isMember(i.catId, u.userId)) throw new Error('denied'); this.s.care.set(i.id, { ...structuredClone(i), by: u.userId }); }
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
    this.s.friendships.add(u.userId + '|' + hit[0]); this.s.friendships.add(hit[0] + '|' + u.userId); return hit[1].name;
  }
  async friends() { const u = this.fr(); return [...this.s.friendships].filter((f) => f.startsWith(u.userId + '|')).map((f) => { const id = f.split('|')[1]; return { userId: id, name: this.s.profiles.get(id)?.name ?? '' }; }); }
  async friendPets() {
    const u = this.fr(); const mine = new Set(this.myHouses().map((h) => h.id));
    return (await this.friends()).flatMap((f) => [...this.s.cats].filter(([, c]) => !mine.has(c.householdId) && this.s.houses.get(c.householdId)?.members.some((m) => m.userId === f.userId))
      .map(([id, c]) => ({ owner: f.userId, ownerName: f.name, catId: id, card: { ...(this.s.cards.get(id) ?? {}), name: c.cat.name, coat: c.cat.coat, eyes: c.cat.eyes, sex: c.cat.sex, birthday: c.cat.birthday } as PetCard })));
  }
  async removeFriend(userId: string) { const u = this.fr(); this.s.friendships.delete(u.userId + '|' + userId); this.s.friendships.delete(userId + '|' + u.userId); }
  async publishCard(catId: string, card: PetCard) { const u = this.fr(); if (!this.s.isMember(catId, u.userId)) throw new Error('not your pet'); this.s.cards.set(catId, structuredClone(card)); }
}
