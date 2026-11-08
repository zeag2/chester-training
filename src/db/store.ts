import { useSyncExternalStore } from 'react';
import { ChesterDB } from './db';
import { SKILLS, SKILL_BY_ID } from '../engine/skills';
import { applySet, clampSet, hiddenUnlocks } from '../engine/rules';
import { rewardFor } from '../engine/rewards';
import { localDay } from '../engine/day';
import { bySetOrder, carryFrom, deriveEarned, deriveProgress, mergeWallet } from '../engine/derive';
import type { Cat, Gift, Mood, ProgressEvent, SessionDraft, SetRecord, SkillProgress, Wallet } from '../engine/types';
import type { Account, Member, Remote } from '../sync/remote';
import { newer, type CareData, type CareItem, type CareKind } from '../engine/care';
import type { CareRow } from './db';
import { SUPABASE_KEY, SUPABASE_URL, sharingConfigured } from '../sync/config';
import { SupabaseRemote } from '../sync/supabase';

export type SyncState = 'off' | 'syncing' | 'ok' | 'offline';
export interface Household { inviteCode: string; members: Member[] }

export interface Snapshot {
  ready: boolean;
  cat: Cat | null;
  progress: Record<string, SkillProgress>;
  sets: SetRecord[];
  wallet: Wallet | null;
  draft: SessionDraft | null;
  unlockedHidden: string[];
  /** Shared training: null when signed out or not set up. */
  account: Account | null;
  household: Household | null;
  sync: SyncState;
  /** Chester's care: food profiles and the health log (deleted items left out), newest first. */
  care: CareItem[];
  /** 'missing' = the shared copy has no care table yet (its setup SQL hasn't been run). */
  careSync: 'ok' | 'missing';
}

export interface LogInput { skillId: string; reps: number; good: number; mood: Mood; seconds: number; note?: string; at?: number }
export interface LogResult { set: SetRecord; event: ProgressEvent; reward: { rewarded: boolean; treats: number; gift: Gift | null }; progress: SkillProgress }

const newWallet = (catId: string): Wallet => ({ catId, treats: 0, bond: 0, toys: [], playMoves: [], checkinKeys: [], napTokens: 0, hintsSeen: [] });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export class Store {
  db: ChesterDB;
  remote: Remote | null = null;
  snap: Snapshot = { ready: false, cat: null, progress: {}, sets: [], wallet: null, draft: null, unlockedHidden: [], account: null, household: null, sync: 'off', care: [], careSync: 'ok' };
  private subs = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  rand: () => number = Math.random;
  /** Name typed when creating the account, put on the cat once it is uploaded (set up before the cat exists). */
  get myName(): string { try { return localStorage.getItem('chester-my-name') ?? ''; } catch { return ''; } }
  set myName(v: string) { try { localStorage.setItem('chester-my-name', v); } catch { /* private mode */ } }

  constructor(dbName = 'chester', remote: Remote | null = null) { this.db = new ChesterDB(dbName); this.remote = remote; }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => this.subs.delete(fn); };
  get = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    const next = { ...this.snap, ...patch };
    next.unlockedHidden = hiddenUnlocks(SKILLS, next.progress, next.wallet?.checkinKeys ?? []);
    this.snap = next; this.subs.forEach((f) => f());
  }
  /** One write at a time, so a sync never interleaves with logging a set. */
  private serial<T>(fn: () => Promise<T>): Promise<T> { const p = this.chain.then(fn, fn); this.chain = p.catch(() => {}); return p; }

  /** Progress and treats always come from the sets, so two trainers' phones agree. */
  private async rebuild(cat: Cat | null, patch: Partial<Snapshot> = {}) {
    if (!cat) { this.set({ cat: null, progress: {}, sets: [], wallet: null, draft: null, household: null, care: [], ...patch }); return; }
    const sets = (await this.db.sets.where('catId').equals(cat.id).toArray()).sort(bySetOrder);
    const local = (await this.db.wallet.get(cat.id)) ?? newWallet(cat.id);
    const wallet = mergeWallet(local, deriveEarned(sets, cat.carry));
    const draft = (await this.db.drafts.get(cat.id)) ?? null;
    const care = (await this.db.care.where('catId').equals(cat.id).toArray()).filter((c) => !c.deleted).map(({ dirty: _d, ...c }) => c as CareItem).sort((a, b) => b.at - a.at);
    this.set({ cat, sets, progress: deriveProgress(sets, SKILL_BY_ID), wallet, draft, care, ...patch });
  }

  async load() {
    let cat = (await this.db.cats.toCollection().first()) ?? null;
    if (cat && !cat.carry) {
      // Before shared training, treats lived only in the wallet. Keep whatever the sets can't explain.
      const sets = await this.db.sets.where('catId').equals(cat.id).toArray();
      cat = { ...cat, carry: carryFrom(await this.db.wallet.get(cat.id), sets) };
      await this.db.cats.put(cat);
    }
    const account = this.remote ? await this.remote.account().catch(() => null) : null;
    await this.rebuild(cat, { ready: true, account, sync: account ? 'syncing' : 'off' });
    if (account) void this.sync();
  }

  async saveCat(c: Omit<Cat, 'id' | 'createdAt'> & Partial<Pick<Cat, 'id' | 'createdAt' | 'carry'>>) {
    const cat: Cat = { ...c, id: c.id ?? uid(), createdAt: c.createdAt ?? Date.now(), updatedAt: Date.now(), carry: c.carry ?? { treats: 0, bond: 0, toys: [] } } as Cat;
    await this.db.cats.put(cat);
    if (!(await this.db.wallet.get(cat.id))) await this.db.wallet.put(newWallet(cat.id));
    await this.rebuild(cat);
    if (this.snap.account) void this.sync();
    return cat;
  }

  /** Only this phone's own bits are stored; treats, bond and toys come from the sets. */
  async updateWallet(fn: (w: Wallet) => Wallet) {
    if (!this.snap.wallet) return;
    const w = fn(this.snap.wallet); await this.db.wallet.put(w); this.set({ wallet: w });
  }

  async saveDraft(d: Omit<SessionDraft, 'catId'>) {
    if (!this.snap.cat) return;
    const draft = { ...d, catId: this.snap.cat.id }; await this.db.drafts.put(draft); this.set({ draft });
  }
  async clearDraft() { if (!this.snap.cat) return; await this.db.drafts.delete(this.snap.cat.id); this.set({ draft: null }); }

  logSet(input: LogInput): Promise<LogResult | null> { return this.serial(() => this.logSetNow(input)); }
  private async logSetNow(input: LogInput): Promise<LogResult | null> {
    const cat = this.snap.cat; const def = SKILL_BY_ID[input.skillId];
    if (!cat || !def) return null;
    const { reps, good } = clampSet(input);
    if (reps === 0) return null;
    const at = input.at ?? Date.now(); const day = localDay(at);
    const prev = this.snap.progress[def.id] ?? { skillId: def.id, step: 0, mastered: false };
    const forSkill = this.snap.sets.filter((s) => s.skillId === def.id);
    const today = this.snap.sets.filter((s) => s.day === day);
    const treatsToday = today.reduce((t, s) => t + (s.repTreats ?? 0), 0);
    const base: SetRecord = { id: uid(), catId: cat.id, at, day, skillId: def.id, step: prev.mastered ? def.steps.length : prev.step, reps, good, mood: input.mood, seconds: Math.round(input.seconds), review: prev.mastered, rewarded: false, note: input.note, by: this.snap.account?.userId };
    const { progress, event } = applySet(prev, forSkill, base, def);
    const reward = rewardFor(base, today, treatsToday, this.rand);
    const set: SetRecord = { ...base, rewarded: reward.rewarded, repTreats: reward.rewarded ? reward.treats - (reward.gift?.treats ?? 0) : 0, gift: reward.gift };
    await this.db.transaction('rw', this.db.sets, this.db.drafts, async () => { await this.db.sets.put(set); await this.db.drafts.delete(cat.id); });
    await this.rebuild(cat);
    if (this.snap.account) void this.sync();
    return { set, event, reward, progress };
  }

  // ---- Chester's care ----

  /** Add or edit a care item. Saved on the phone right away, shared on the next sync. */
  saveCare<K extends CareKind>(kind: K, data: CareData[K], opts: { id?: string; at?: number } = {}): Promise<CareItem | null> {
    return this.serial(async () => {
      const cat = this.snap.cat; if (!cat) return null;
      const old = opts.id ? await this.db.care.get(opts.id) : undefined;
      const item: CareRow = { id: opts.id ?? uid(), catId: cat.id, kind, at: opts.at ?? old?.at ?? Date.now(), updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1), data, by: this.snap.account?.userId, dirty: 1 };
      await this.db.care.put(item); await this.rebuild(cat);
      if (this.snap.account) void this.sync();
      const { dirty: _d, ...out } = item; return out as CareItem;
    });
  }
  deleteCare(id: string): Promise<void> {
    return this.serial(async () => {
      const cat = this.snap.cat; const old = await this.db.care.get(id); if (!cat || !old) return;
      await this.db.care.put({ ...old, deleted: true, updatedAt: Math.max(Date.now(), old.updatedAt + 1), dirty: 1 }); await this.rebuild(cat);
      if (this.snap.account) void this.sync();
    });
  }
  /** Newest edit wins on each side; a missing care table never breaks training sync. */
  private async syncCare(r: Remote, catId: string): Promise<'ok' | 'missing'> {
    try {
      const theirs = await r.pullCare(catId);
      const mine = new Map((await this.db.care.where('catId').equals(catId).toArray()).map((c) => [c.id, c]));
      const take: CareRow[] = []; const known = new Map<string, CareItem>();
      for (const t of theirs) { known.set(t.id, t); const m = mine.get(t.id); if (newer(m, t) === t && (!m || t.updatedAt > m.updatedAt)) take.push({ ...t, dirty: 0 }); }
      const send = [...mine.values()].filter((m) => m.dirty && (!known.has(m.id) || m.updatedAt > known.get(m.id)!.updatedAt)).map(({ dirty: _d, ...m }) => m as CareItem);
      await r.pushCare(send);
      await this.db.care.bulkPut([...take, ...send.map((m) => ({ ...m, dirty: 0 }))]);
      return 'ok';
    } catch (e) {
      if (/care|relation|does not exist|schema cache|404/i.test(String((e as Error)?.message ?? e))) return 'missing';
      throw e;
    }
  }

  // ---- shared training ----

  /** Send what this phone has that the shared copy lacks, then take everything the shared copy has. */
  sync(): Promise<void> { return this.serial(() => this.syncNow()); }
  private async syncNow() {
    const r = this.remote; if (!r) return;
    const account = await r.account().catch(() => null);
    if (!account) { this.set({ account: null, household: null, sync: 'off' }); return; }
    this.set({ account, sync: 'syncing' });
    try {
      let cat = this.snap.cat;
      if (!cat) {
        const [id] = await r.myCatIds();
        if (id) cat = await this.adopt(id);
      } else {
        const shared = await r.getCat(cat.id);
        if (!shared) { await r.createCat(cat); if (this.myName) await r.setName(cat.id, this.myName).catch(() => {}); }
        else if ((shared.cat.updatedAt ?? 0) > (cat.updatedAt ?? 0)) { cat = { ...shared.cat, id: cat.id }; await this.db.cats.put(cat); }
        else if ((cat.updatedAt ?? 0) > (shared.cat.updatedAt ?? 0)) { await r.updateCat(cat); }
      }
      if (!cat) { this.set({ sync: 'ok', household: null }); return; }
      const theirs = await r.pullSets(cat.id);
      const known = new Set(theirs.map((s) => s.id));
      const mine = await this.db.sets.where('catId').equals(cat.id).toArray();
      await r.pushSets(mine.filter((s) => !known.has(s.id)).sort(bySetOrder));
      if (theirs.length) await this.db.sets.bulkPut(theirs);
      const shared = await r.getCat(cat.id);
      const careSync = await this.syncCare(r, cat.id);
      let household = shared ? { inviteCode: shared.inviteCode, members: await r.members(cat.id) } : null;
      // keep my name in step both ways: fill it in online if it's missing there, remember it here for offline
      const meRow = household?.members.find((m) => m.userId === account.userId);
      if (meRow && !meRow.name && this.myName) { await r.setName(cat.id, this.myName).catch(() => {}); household = { ...household!, members: await r.members(cat.id) }; }
      else if (meRow?.name && meRow.name !== this.myName) this.myName = meRow.name;
      await this.rebuild(cat, { household, sync: 'ok', careSync });
    } catch {
      this.set({ sync: 'offline' });
    }
  }

  private async adopt(id: string): Promise<Cat | null> {
    const shared = await this.remote!.getCat(id); if (!shared) return null;
    await this.db.cats.put(shared.cat);
    if (!(await this.db.wallet.get(id))) await this.db.wallet.put(newWallet(id));
    return shared.cat;
  }

  /** Create an account or sign in; when sharing, upload this phone's Chester and put our name on it. */
  async signIn(email: string, password: string, name: string, share = true, create = false) {
    const e = email.trim().toLowerCase();
    if (name.trim()) this.myName = name.trim();
    const account = create ? await this.remote!.signUp(e, password) : await this.remote!.signIn(e, password);
    this.set({ account });
    if (!share) return; // about to join someone else's Chester: don't upload this phone's own
    await this.sync();
    if (this.snap.cat && name.trim()) { await this.remote!.setName(this.snap.cat.id, name.trim()).catch(() => {}); await this.sync(); }
  }

  /** Join someone else's Chester. This phone's own cat (if any) is replaced by the shared one. */
  join(code: string, name: string): Promise<boolean> {
    return this.serial(async () => {
      const id = await this.remote!.join(code.trim(), name.trim()); if (!id) return false;
      const old = this.snap.cat;
      if (old && old.id !== id) await this.forget(old.id);
      await this.rebuild(await this.adopt(id));
      return true;
    }).then(async (ok) => { if (ok) await this.sync(); return ok; });
  }

  /** Change the name the other trainer sees, and the one Home greets on this phone. */
  async renameMe(name: string) {
    const n = name.trim().slice(0, 40); if (!n) return;
    this.myName = n;
    const cat = this.snap.cat; const a = this.snap.account;
    if (cat && a && this.remote) { await this.remote.setName(cat.id, n).catch(() => {}); await this.sync(); }
    else this.set({});
  }

  async signOut() { await this.remote?.signOut(); this.set({ account: null, household: null, sync: 'off' }); }

  private async forget(catId: string) {
    await this.db.transaction('rw', [this.db.cats, this.db.sets, this.db.wallet, this.db.drafts, this.db.progress, this.db.care], async () => {
      await this.db.cats.delete(catId); await this.db.sets.where('catId').equals(catId).delete(); await this.db.care.where('catId').equals(catId).delete();
      await this.db.wallet.delete(catId); await this.db.drafts.delete(catId); await this.db.progress.where('catId').equals(catId).delete();
    });
  }
}

export const store = new Store('chester', sharingConfigured() ? new SupabaseRemote(SUPABASE_URL, SUPABASE_KEY) : null);
if (import.meta.env.DEV) (globalThis as Record<string, unknown>).__chesterStore = store;
export function useStore(): Snapshot { return useSyncExternalStore(store.subscribe, store.get, store.get); }
