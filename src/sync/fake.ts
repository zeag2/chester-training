import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';
import type { Account, Member, Remote } from './remote';

/** In-memory shared copy with the same rules as the database: only members see or add to a cat. */
export class FakeServer {
  cats = new Map<string, { cat: Cat; inviteCode: string }>();
  members = new Map<string, Member[]>();
  sets = new Map<string, SetRecord>();
  passwords = new Map<string, string>();
  care = new Map<string, CareItem>();
  careTable = true;
  files = new Map<string, Blob>();
  reading: DocReading | null = null;
  online = true;
  private n = 0;
  isMember(catId: string, userId: string) { return (this.members.get(catId) ?? []).some((m) => m.userId === userId); }
  device(): FakeRemote { return new FakeRemote(this); }
  code() { return 'CODE' + ++this.n; }
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
  async myCatIds() { const u = this.user(); return [...this.s.members].filter(([, ms]) => ms.some((m) => m.userId === u.userId)).map(([id]) => id); }
  async getCat(id: string) { const u = this.user(); const c = this.s.cats.get(id); return c && this.s.isMember(id, u.userId) ? structuredClone(c) : null; }
  async createCat(cat: Cat) { const u = this.user(); if (this.s.cats.has(cat.id)) throw new Error('exists'); this.s.cats.set(cat.id, { cat: structuredClone(cat), inviteCode: this.s.code() }); this.s.members.set(cat.id, [{ userId: u.userId, name: '' }]); }
  async updateCat(cat: Cat) { const u = this.user(); if (!this.s.isMember(cat.id, u.userId)) throw new Error('denied'); this.s.cats.get(cat.id)!.cat = structuredClone(cat); }
  async join(code: string, name: string) {
    const u = this.user(); const hit = [...this.s.cats].find(([, c]) => c.inviteCode === code.toUpperCase()); if (!hit) return null;
    const ms = this.s.members.get(hit[0])!; if (!ms.some((m) => m.userId === u.userId)) ms.push({ userId: u.userId, name }); return hit[0];
  }
  async members(catId: string) { const u = this.user(); return this.s.isMember(catId, u.userId) ? structuredClone(this.s.members.get(catId)!).map((m, i) => ({ ...m, email: m.userId.replace(/^u:/, ''), owner: i === 0 })) : []; }
  async removeMember(catId: string, userId: string) {
    const u = this.user(); const ms = this.s.members.get(catId) ?? [];
    if (u.userId !== userId && ms[0]?.userId !== u.userId) throw new Error('not-allowed');
    this.s.members.set(catId, ms.filter((m) => m.userId !== userId));
  }
  async setName(catId: string, name: string) { const u = this.user(); const m = this.s.members.get(catId)?.find((x) => x.userId === u.userId); if (m) m.name = name; }
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
}
