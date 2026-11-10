import { useSyncExternalStore } from 'react';
import { ChesterDB } from './db';
import { SKILLS, SKILL_BY_ID } from '../engine/skills';
import { applySet, clampSet, hiddenUnlocks } from '../engine/rules';
import { rewardFor } from '../engine/rewards';
import { localDay } from '../engine/day';
import { bySetOrder, carryFrom, deriveEarned, deriveProgress, mergeWallet } from '../engine/derive';
import type { Cat, Gift, Mood, ProgressEvent, SessionDraft, SetRecord, SkillProgress, Wallet } from '../engine/types';
import type { Account, AddFriendResult, Friend, FriendPet, FriendRequest, Member, PetCard, ReceivedTreat, Remote } from '../sync/remote';
import { streak, weekStats } from '../lib/stats';
import { newer, type CareData, type CareItem, type CareKind, type DocReading } from '../engine/care';
import { shrinkImage } from '../lib/images';
import type { CareRow, VetRow } from './db';
import type { Vet, VetData } from '../engine/vets';
import { SUPABASE_KEY, SUPABASE_URL, sharingConfigured } from '../sync/config';
import { SupabaseRemote } from '../sync/supabase';
import { MOVE_REWARD } from '../engine/play';
import { FRIEND_BONUS, FRIEND_TREAT, CARE_STREAK, PLAY_REWARD, careReward, careStreakDue, type CareReward, ITEM_BY_ID, newTreats, treatId, dailyGiftTreats, giftClaimed, mergeCorner, playedToday, unrewardedFriends, withCorner, type Corner, type CornerEvent } from '../engine/corner';

export type SyncState = 'off' | 'syncing' | 'ok' | 'offline';
export interface Household { inviteCode: string; members: Member[] }
/** Friends: my code, my friends and their pets' cards. `missing` = the friends SQL hasn't been run yet.
    `given`: friends' pets I've given today's treat to; `treats: 'missing'` = the friend treats SQL hasn't been run yet. */
export interface Friends { code: string; list: Friend[]; pets: FriendPet[]; missing?: boolean; given?: string[]; treats?: 'missing' }
export type GiveResult = 'given' | 'already' | 'missing' | 'error';

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
  /** The household's vet contacts (the usual vet, an emergency vet). `vetsSync: 'missing'` = the vets SQL isn't run yet
      (they're kept on this phone meanwhile). */
  vets: Vet[];
  vetsSync: 'ok' | 'missing';
  /** Every pet on this phone, for the switcher. `cat` is the one being shown. */
  pets: (Pick<Cat, 'id' | 'name' | 'coat' | 'eyes' | 'sex'> & { wear?: string })[];
  /** Loaded when the Friends screen opens; null when signed out or not loaded yet. */
  friends: Friends | null;
  /** New friends whose bonus just landed, for a card on Home (`scarf`: it was the first friend). */
  friendNews: { names: string[]; scarf: boolean } | null;
  /** Friends' treats that just landed for a pet, for a line on Home ("Erin gave Chester a treat"). */
  treatNews: { cat: string; names: string[]; catId?: string; items?: { from: string; day: string }[]; thanked?: boolean } | null;
  /** Friend requests: incoming ones ("Accept Erin?") and mine still waiting. Checked on sync and when Friends loads. */
  requests: FriendRequest[];
  /** "Mochi says thank you": thank-yous for treats I gave, not dismissed yet on this phone. */
  thanks: { catId: string; catName: string; day: string }[];
  /** Treats a care entry just earned, for a short note on the Health screen. */
  careNews: (CareReward & { at: number }) | null;
}

export interface LogInput { skillId: string; reps: number; good: number; mood: Mood; seconds: number; note?: string; at?: number }
export interface LogResult { set: SetRecord; event: ProgressEvent; reward: { rewarded: boolean; treats: number; gift: Gift | null }; progress: SkillProgress }

const newWallet = (catId: string): Wallet => ({ catId, treats: 0, bond: 0, toys: [], playMoves: [], checkinKeys: [], napTokens: 0, hintsSeen: [] });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export class Store {
  db: ChesterDB;
  remote: Remote | null = null;
  snap: Snapshot = { ready: false, cat: null, progress: {}, sets: [], wallet: null, draft: null, unlockedHidden: [], account: null, household: null, sync: 'off', care: [], careSync: 'ok', vets: [], vetsSync: 'ok', pets: [], friends: null, friendNews: null, treatNews: null, careNews: null, thanks: [], requests: [] };
  private subs = new Set<() => void>();
  private chain: Promise<unknown> = Promise.resolve();
  rand: () => number = Math.random;
  /** Name typed when creating the account, put on the cat once it is uploaded (set up before the cat exists).
      Kept per account, so a second person signing in on this phone never inherits the first one's name. */
  /** Which pet is shown, remembered on this phone. */
  get activeId(): string { try { return localStorage.getItem('paldex-active-pet') ?? ''; } catch { return ''; } }
  set activeId(v: string) { try { localStorage.setItem('paldex-active-pet', v); } catch { /* private mode */ } }
  private async petList() { return (await this.db.cats.toArray()).sort((a, b) => a.createdAt - b.createdAt).map(({ id, name, coat, eyes, sex, corner }) => ({ id, name, coat, eyes, sex, wear: corner?.wearing })); }

  private nameKey(uid = this.snap.account?.userId) { return uid ? 'chester-my-name:' + uid : ''; }
  get myName(): string { try { const k = this.nameKey(); return k ? localStorage.getItem(k) ?? '' : ''; } catch { return ''; } }
  set myName(v: string) { try { const k = this.nameKey(); if (k) localStorage.setItem(k, v); } catch { /* private mode */ } }

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
    const pets = await this.petList();
    if (!cat) { this.set({ cat: null, progress: {}, sets: [], wallet: null, draft: null, household: null, care: [], pets, ...patch }); return; }
    this.activeId = cat.id;
    const sets = (await this.db.sets.where('catId').equals(cat.id).toArray()).sort(bySetOrder);
    const local = (await this.db.wallet.get(cat.id)) ?? newWallet(cat.id);
    const wallet = mergeWallet(local, withCorner(deriveEarned(sets, cat.carry), cat.corner));
    const draft = (await this.db.drafts.get(cat.id)) ?? null;
    const care = (await this.db.care.where('catId').equals(cat.id).toArray()).filter((c) => !c.deleted).map(({ dirty: _d, ...c }) => c as CareItem).sort((a, b) => b.at - a.at);
    const vets = await this.vetsFor(cat);
    this.set({ cat, sets, progress: deriveProgress(sets, SKILL_BY_ID), wallet, draft, care, vets, pets, ...patch });
  }

  async load() {
    const want = this.activeId;
    let cat = (want ? await this.db.cats.get(want) : undefined) ?? (await this.db.cats.orderBy('id').toArray()).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
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
    const cat: Cat = { ...c, id: c.id ?? uid(), createdAt: c.createdAt ?? Date.now(), updatedAt: Date.now(), carry: c.carry ?? { treats: 0, bond: 0, toys: [] },
      householdId: c.householdId ?? (c.id ? undefined : this.snap.cat?.householdId) } as Cat;
    await this.db.cats.put(cat);
    if (!(await this.db.wallet.get(cat.id))) await this.db.wallet.put(newWallet(cat.id));
    await this.rebuild(cat);
    if (this.snap.account) void this.sync();
    return cat;
  }

  /** Show another pet. */
  switchPet(id: string): Promise<void> {
    return this.serial(async () => { const cat = await this.db.cats.get(id); if (!cat) return; await this.rebuild(cat, { household: null }); })
      .then(() => { if (this.snap.account) void this.sync(); });
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

  // ---- Chester's corner ----

  private corner(fn: (c: Corner, cat: Cat) => Corner | null): Promise<boolean> {
    return this.serial(async () => {
      const cat = this.snap.cat; if (!cat) return false;
      const next = fn(cat.corner ?? { log: [] }, cat); if (!next) return false;
      const saved: Cat = { ...cat, corner: next, updatedAt: Math.max(Date.now(), (cat.updatedAt ?? 0) + 1) };
      await this.db.cats.put(saved); await this.rebuild(saved);
      if (this.snap.account) void this.sync();
      return true;
    });
  }
  private event(kind: CornerEvent['kind'], id: string, treats: number, bond: number, item?: string): CornerEvent {
    const at = Date.now();
    return { id, kind, day: localDay(at), at, item, treats, bond, by: this.snap.account?.userId };
  }
  /** Spend treats on an outfit, toy or cushion. Outfits and cushions are put on straight away. */
  buy(itemId: string): Promise<boolean> {
    return this.corner((c) => {
      const item = ITEM_BY_ID[itemId]; const balance = this.snap.wallet?.treats ?? 0;
      if (!item || balance < item.price || c.log.some((e) => e.kind === 'buy' && e.item === itemId)) return null;
      const log = [...c.log, this.event('buy', 'buy-' + uid(), -item.price, 0, itemId)];
      return { ...c, log, ...(item.kind === 'outfit' ? { wearing: itemId, styledAt: Date.now() } : item.kind === 'cushion' ? { cushion: itemId, styledAt: Date.now() } : {}) };
    });
  }
  /** Put on an outfit (or take it off with null). */
  wear(itemId: string | null) { return this.corner((c) => ({ ...c, wearing: itemId ?? undefined, styledAt: Date.now() })); }
  setCushion(itemId: string | null) { return this.corner((c) => ({ ...c, cushion: itemId ?? undefined, styledAt: Date.now() })); }
  /** Today's small gift, once a day per pet (shared, so only one person in the house gets it). */
  claimGift(): Promise<number> {
    let got = 0;
    return this.corner((c, cat) => {
      const day = localDay(Date.now()); if (giftClaimed(c, day)) return null;
      got = dailyGiftTreats(cat.id, day);
      return { ...c, log: [...c.log, this.event('gift', 'gift-' + day, got, 0)] };
    }).then((ok) => (ok ? got : 0));
  }
  /** Playing with a toy: the first play of the day adds a bond point. */
  play(toy: string): Promise<boolean> {
    return this.corner((c) => {
      const day = localDay(Date.now()); if (playedToday(c, day)) return null;
      return { ...c, log: [...c.log, this.event('play', 'play-' + day, PLAY_REWARD.treats, PLAY_REWARD.bond, toy)] };
    });
  }

  /** A play move found for the first time (see PLAY_MOVES): a few treats, once per pet. False if already found. */
  foundMove(toy: string, move: string): Promise<boolean> {
    const id = `move-${toy}-${move}`;
    return this.corner((c) => (c.log.some((e) => e.id === id) ? null : { ...c, log: [...c.log, this.event('move', id, MOVE_REWARD.treats, MOVE_REWARD.bond, toy)] }));
  }

  // ---- your vet ----

  /** The vets of the shown pet's household (and any saved on this phone before it was shared). */
  private async vetsFor(cat: Cat): Promise<Vet[]> {
    const h = cat.householdId ?? '';
    return (await this.db.vets.toArray()).filter((v) => !v.deleted && (v.householdId === h || v.householdId === '')).map(({ dirty: _d, ...v }) => v as Vet);
  }
  /** Add or edit a vet contact. Saved on the phone right away, shared with the household on the next sync. */
  saveVet(data: VetData, id?: string): Promise<Vet | null> {
    return this.serial(async () => {
      const cat = this.snap.cat; if (!cat) return null;
      const old = id ? await this.db.vets.get(id) : undefined;
      const row: VetRow = { id: id ?? uid(), householdId: old?.householdId || cat.householdId || '', updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1), data, by: this.snap.account?.userId, dirty: 1 };
      await this.db.vets.put(row); this.set({ vets: await this.vetsFor(cat) });
      if (this.snap.account) void this.sync();
      const { dirty: _d, ...out } = row; return out as Vet;
    });
  }
  deleteVet(id: string): Promise<void> {
    return this.serial(async () => {
      const cat = this.snap.cat; const old = await this.db.vets.get(id); if (!cat || !old) return;
      await this.db.vets.put({ ...old, deleted: true, updatedAt: Math.max(Date.now(), old.updatedAt + 1), dirty: 1 }); this.set({ vets: await this.vetsFor(cat) });
      if (this.snap.account) void this.sync();
    });
  }
  /** Send this phone's vet edits, take the household's (newest edit wins). Vets saved before sharing join the household. */
  private async syncVets(r: Remote, householdId: string): Promise<'ok' | 'missing'> {
    try {
      const orphans = await this.db.vets.filter((v) => v.householdId === '').toArray();
      if (orphans.length) await this.db.vets.bulkPut(orphans.map((v) => ({ ...v, householdId, dirty: 1 })));
      const theirs = await r.pullVets(householdId);
      const mine = new Map((await this.db.vets.where('householdId').equals(householdId).toArray()).map((v) => [v.id, v]));
      const known = new Map(theirs.map((t) => [t.id, t]));
      const take = theirs.filter((t) => { const m = mine.get(t.id); return !m || t.updatedAt > m.updatedAt; }).map((t) => ({ ...t, dirty: 0 }));
      const send = [...mine.values()].filter((m) => m.dirty && (!known.has(m.id) || m.updatedAt > known.get(m.id)!.updatedAt)).map(({ dirty: _d, ...m }) => m as Vet);
      await r.pushVets(send);
      await this.db.vets.bulkPut([...take, ...send.map((m) => ({ ...m, dirty: 0 }))]);
      return 'ok';
    } catch (e) {
      if (String((e as Error)?.message).includes('vets-missing')) return 'missing';
      throw e;
    }
  }

  // ---- Chester's care ----

  /** Add or edit a care item. Saved on the phone right away, shared on the next sync. `catId`: for another of my pets
      than the one shown (e.g. "Fed" for all cats); those don't earn the shown pet's care treats. */
  saveCare<K extends CareKind>(kind: K, data: CareData[K], opts: { id?: string; at?: number; catId?: string } = {}): Promise<CareItem | null> {
    return this.serial(async () => {
      const cat = this.snap.cat; if (!cat) return null;
      if (opts.catId && opts.catId !== cat.id && !(await this.db.cats.get(opts.catId))) return null;
      const old = opts.id ? await this.db.care.get(opts.id) : undefined;
      const item: CareRow = { id: opts.id ?? uid(), catId: opts.catId ?? cat.id, kind, at: opts.at ?? old?.at ?? Date.now(), updatedAt: Math.max(Date.now(), (old?.updatedAt ?? 0) + 1), data, by: this.snap.account?.userId, dirty: 1 };
      await this.db.care.put(item); await this.rebuild(cat);
      if (this.snap.account) void this.sync();
      const { dirty: _d, ...out } = item; return { item: out as CareItem, isNew: !old };
    }).then(async (r) => { if (r?.isNew) await this.rewardCare(r.item); return r?.item ?? null; });
  }
  /** A new care entry earns a few treats (see CARE_TREATS), once per entry, merged by id across phones. */
  private async rewardCare(item: CareItem): Promise<void> {
    let got: CareReward | null = null;
    const ok = await this.corner((c, cat) => {
      if (cat.id !== item.catId) return null;
      got = careReward(c, item, this.snap.care);
      const streak = careStreakDue(c, this.snap.care);
      const add = [...(got ? [this.event('care', 'care-' + item.id, got.treats, 0, item.kind)] : []), ...(streak && !c.log.some((e) => e.id === streak) ? [this.event('streak', streak, CARE_STREAK.treats, 1)] : [])];
      if (!add.length) return null;
      if (streak && add.some((e) => e.kind === 'streak')) got = { treats: (got?.treats ?? 0) + CARE_STREAK.treats, why: 'streak' };
      return { ...c, log: [...c.log, ...add] };
    });
    if (ok && got) this.set({ careNews: { ...(got as CareReward), at: Date.now() } });
  }
  dismissCareNews() { this.set({ careNews: null }); }
  deleteCare(id: string): Promise<void> {
    return this.serial(async () => {
      const cat = this.snap.cat; const old = await this.db.care.get(id); if (!cat || !old) return;
      await this.db.care.put({ ...old, deleted: true, updatedAt: Math.max(Date.now(), old.updatedAt + 1), dirty: 1 }); await this.rebuild(cat);
      if (this.snap.account) void this.sync();
    });
  }
  /** Store a vet document (photo or PDF) in the shared bucket and add it to the care log. Needs an account. */
  async addDoc(file: File): Promise<CareItem<'doc'>> {
    const cat = this.snap.cat; const r = this.remote;
    if (!cat || !r || !this.snap.account) throw new Error('Sign in (Settings → Train together) to store documents.');
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const blob = pdf ? file : await shrinkImage(file);
    const mime = pdf ? 'application/pdf' : blob.type || 'image/jpeg';
    const ext = pdf ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    if (blob.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB. Try a photo of the page instead.');
    const id = uid(); const path = `${cat.id}/${id}.${ext}`;
    await r.uploadDoc(path, blob, mime);
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'Vet document';
    return (await this.saveCare('doc', { title, path, mime, bytes: blob.size }, { id })) as CareItem<'doc'>;
  }
  readDoc(path: string): Promise<DocReading> { if (!this.remote) throw new Error('Sharing is off'); return this.remote.readDoc(path); }
  docUrl(path: string): Promise<string> { if (!this.remote) throw new Error('Sharing is off'); return this.remote.docUrl(path); }
  async removeDoc(item: CareItem<'doc'>) { await this.deleteCare(item.id); await this.remote?.removeDoc(item.data.path).catch(() => {}); }

  /** Newest edit wins on each side; a missing care table never breaks training sync. */
  /** False once the server refused a one-tap daily log (its SQL not run yet). */
  dailyShared: boolean | null = null;
  private async syncCare(r: Remote, catId: string): Promise<'ok' | 'missing'> {
    try {
      const theirs = await r.pullCare(catId);
      const mine = new Map((await this.db.care.where('catId').equals(catId).toArray()).map((c) => [c.id, c]));
      const take: CareRow[] = []; const known = new Map<string, CareItem>();
      for (const t of theirs) { known.set(t.id, t); const m = mine.get(t.id); if (newer(m, t) === t && (!m || t.updatedAt > m.updatedAt)) take.push({ ...t, dirty: 0 }); }
      const all = [...mine.values()].filter((m) => m.dirty && (!known.has(m.id) || m.updatedAt > known.get(m.id)!.updatedAt)).map(({ dirty: _d, ...m }) => m as CareItem);
      const send = all.filter((m) => m.kind !== 'daily'); const daily = all.filter((m) => m.kind === 'daily');
      await r.pushCare(send);
      // one-tap daily logs need the daily-logs SQL; until it's run they stay on this phone (still dirty) and the rest syncs
      let sent = send;
      if (daily.length) {
        try { await r.pushCare(daily); sent = all; this.dailyShared = true; }
        catch (e) { if (!/check constraint|care_kind_check|violates|23514/i.test(String((e as Error)?.message ?? e))) throw e; this.dailyShared = false; }
      }
      await this.db.care.bulkPut([...take, ...sent.map((m) => ({ ...m, dirty: 0 }))]);
      return 'ok';
    } catch (e) {
      if (/care|relation|does not exist|schema cache|404/i.test(String((e as Error)?.message ?? e))) return 'missing';
      throw e;
    }
  }

  // ---- friends ----

  /** The card friends see for the pet being shown: its look, outfit and a few highlights. */
  cardFor(): PetCard | null {
    const { cat, progress, sets, wallet } = this.snap; if (!cat) return null;
    return { name: cat.name, wear: cat.corner?.wearing, cushion: cat.corner?.cushion,
      mastered: Object.values(progress).filter((p) => p.mastered).map((p) => p.skillId),
      setsWeek: weekStats(sets).sessions, streak: streak(sets), bond: wallet?.bond ?? 0 };
  }
  private published = new Map<string, string>();
  private async publishCard(r: Remote, catId: string) {
    const card = this.cardFor(); if (!card || this.snap.cat?.id !== catId) return;
    const key = JSON.stringify(card); if (this.published.get(catId) === key) return;
    try { await r.publishCard(catId, card); this.published.set(catId, key); } catch { /* friends SQL not run yet, or offline: next sync */ }
  }
  /** Load my friend code, my friends and their pets. */
  async loadFriends(): Promise<void> {
    const r = this.remote; if (!r || !this.snap.account) { this.set({ friends: null }); return; }
    try {
      const code = await r.friendCode(this.myName);
      const [list, pets] = await Promise.all([r.friends(), r.friendPets()]);
      let given: string[] = []; let treats: 'missing' | undefined;
      try { given = await r.treatsGiven(localDay(Date.now())); } catch (e) { if (String((e as Error)?.message).includes('treats-missing')) treats = 'missing'; else throw e; }
      this.set({ friends: { code, list, pets, given, treats } });
      await this.loadRequests(r);
      await this.rewardFriends(list);
      await this.collectTreats(true);
      try { const seen = this.seenThanks(); this.set({ thanks: (await r.myThanks()).filter((t) => !seen.has(t.catId + '|' + t.day)) }); } catch { /* thanks SQL not run yet */ }
    } catch (e) {
      if (String((e as Error)?.message).includes('friends-missing')) this.set({ friends: { code: '', list: [], pets: [], missing: true } });
      else throw e;
    }
  }
  /** A bonus for the pet being shown for each new friend (once per friend, up to a cap; the first unlocks the scarf).
      Both sides get it: whoever adds a code right away, the other person next time their friends are checked. */
  async rewardFriends(list: Friend[]): Promise<string[]> {
    const fresh = unrewardedFriends(this.snap.cat?.corner, list.map((f) => f.userId)); if (!fresh.length) return [];
    let paid: string[] = []; let first = false;
    const ok = await this.corner((c) => {
      paid = unrewardedFriends(c, fresh); if (!paid.length) return null;
      first = !c.log.some((e) => e.kind === 'friend');
      return { ...c, log: [...c.log, ...paid.map((id) => this.event('friend', 'friend-' + id, FRIEND_BONUS.treats, FRIEND_BONUS.bond))] };
    });
    if (!ok) return [];
    const names = paid.map((id) => list.find((f) => f.userId === id)?.name || 'A friend');
    const prev = this.snap.friendNews;
    this.set({ friendNews: { names: [...(prev?.names ?? []), ...names], scarf: (prev?.scarf ?? false) || first } });
    return names;
  }
  dismissFriendNews() { this.set({ friendNews: null }); }

  /** Give a friend's pet today's free treat (once a day per pet, checked by the server). */
  async giveTreat(catId: string): Promise<GiveResult> {
    const r = this.remote; if (!r || !this.snap.account) return 'error';
    let out: GiveResult;
    try { out = (await r.giveTreat(catId, localDay(Date.now()))) ? 'given' : 'already'; }
    catch (e) { if (!String((e as Error)?.message).includes('treats-missing')) return 'error'; out = 'missing'; }
    const f = this.snap.friends;
    if (f) this.set({ friends: out === 'missing' ? { ...f, treats: 'missing' } : { ...f, given: [...new Set([...(f.given ?? []), catId])] } });
    return out;
  }
  private treatsCheckedAt = new Map<string, number>();
  /** Treats friends gave the pet being shown: each becomes +1 treat in its corner log, once (merged by id across the
      household's phones), and a line on Home. Checked on sync at most once a minute per pet, and when Friends loads. */
  async collectTreats(force = false): Promise<string[]> {
    const r = this.remote; const cat = this.snap.cat; if (!r || !this.snap.account || !cat) return [];
    if (!force && Date.now() - (this.treatsCheckedAt.get(cat.id) ?? 0) < 60_000) return [];
    this.treatsCheckedAt.set(cat.id, Date.now());
    let got: ReceivedTreat[];
    try { got = await r.treatsFor(cat.id); } catch { return []; } // treats SQL not run yet, or offline
    if (!newTreats(cat.corner, got).length) return [];
    let fresh: ReceivedTreat[] = [];
    const ok = await this.corner((c, now) => {
      if (now.id !== cat.id) return null;
      fresh = newTreats(c, got); if (!fresh.length) return null;
      return { ...c, log: [...c.log, ...fresh.map((t) => ({ ...this.event('treat', treatId(t.from, t.day), FRIEND_TREAT, 0), by: t.from }))] };
    });
    if (!ok) return [];
    const names = [...new Set(fresh.map((t) => t.fromName || 'A friend'))];
    const keep = this.snap.treatNews?.catId === cat.id ? this.snap.treatNews : null;
    this.set({ treatNews: { cat: cat.name, catId: cat.id, names: [...new Set([...(keep?.names ?? []), ...names])], items: [...(keep?.items ?? []), ...fresh.map((t) => ({ from: t.from, day: t.day }))] } });
    return names;
  }
  dismissTreatNews() { this.set({ treatNews: null }); }
  /** Say thank you for the treats in the Home card (needs the thanks SQL; quietly does nothing until then). */
  async thankTreats(): Promise<boolean> {
    const n = this.snap.treatNews; const r = this.remote; if (!n?.catId || !n.items?.length || !r) return false;
    try { for (const t of n.items) await r.thankTreat(t.from, n.catId, t.day); } catch { return false; }
    this.set({ treatNews: { ...n, thanked: true } }); return true;
  }
  private seenThanks(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem('paldex-thanks-seen') ?? '[]')); } catch { return new Set(); } }
  dismissThanks() { const seen = this.seenThanks(); for (const t of this.snap.thanks) seen.add(t.catId + '|' + t.day); try { localStorage.setItem('paldex-thanks-seen', JSON.stringify([...seen].slice(-200))); } catch { /* private mode */ } this.set({ thanks: [] }); }
  private friendsCheckedAt = 0;
  /** Every so often during sync: has someone added my code? Then their bonus lands here too. */
  private async checkFriends(r: Remote) {
    if (Date.now() - this.friendsCheckedAt < 60_000) return; // checked on every app open (sync runs then), at most once a minute
    this.friendsCheckedAt = Date.now();
    try { await this.rewardFriends(await r.friends()); await this.loadRequests(r); } catch { /* friends not set up yet, or offline */ }
  }
  private async loadRequests(r: Remote) {
    try { this.set({ requests: await r.friendRequests() }); } catch { /* offline: keep what we had */ }
  }
  /** Enter a friend's code: sends them a request ("Accept Josh?"), or makes you friends when they'd already asked you.
      Null when the code is wrong or your own. */
  async addFriend(code: string): Promise<AddFriendResult | null> {
    const res = await this.remote!.addFriend(code.trim()); if (res !== null) await this.loadFriends(); return res;
  }
  /** Accept or decline a friend request (declining is quiet: they aren't told). */
  async answerFriend(userId: string, accept: boolean) {
    this.set({ requests: this.snap.requests.filter((q) => !(q.incoming && q.userId === userId)) });
    await this.remote!.answerFriend(userId, accept); await this.loadFriends();
  }
  async cancelFriendRequest(userId: string) {
    this.set({ requests: this.snap.requests.filter((q) => q.incoming || q.userId !== userId) });
    await this.remote!.cancelFriendRequest(userId); await this.loadFriends();
  }
  async removeFriend(userId: string) { await this.remote!.removeFriend(userId); await this.loadFriends(); }

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
      // bring over every pet this account trains that isn't on this phone yet
      for (const id of await r.myCatIds()) if (!(await this.db.cats.get(id))) { const got = await this.adopt(id); cat ??= got; }
      if (!this.snap.cat) {
        if (cat) this.activeId = cat.id;
      } else {
        cat = this.snap.cat;
        const shared = await r.getCat(cat.id);
        if (!shared) { await r.createCat(cat); if (this.myName) await r.setName(cat.id, this.myName).catch(() => {}); }
        else {
          // the newer pet edit wins, but the corner's buys and gifts from both sides are always kept
          const local = cat; const theirsNewer = (shared.cat.updatedAt ?? 0) > (local.updatedAt ?? 0);
          let next: Cat = theirsNewer ? { ...shared.cat, id: local.id } : shared.cat.householdId && shared.cat.householdId !== local.householdId ? { ...local, householdId: shared.cat.householdId } : local;
          const corner = mergeCorner(next.corner, theirsNewer ? local.corner : shared.cat.corner);
          if (corner) next = { ...next, corner };
          const mineMissing = (corner?.log.length ?? 0) > (shared.cat.corner?.log.length ?? 0);
          if (next !== local) await this.db.cats.put(next);
          if ((!theirsNewer && (local.updatedAt ?? 0) > (shared.cat.updatedAt ?? 0)) || mineMissing) await r.updateCat(next);
          cat = next;
        }
      }
      if (!cat) { this.set({ sync: 'ok', household: null }); return; }
      const theirs = await r.pullSets(cat.id);
      const known = new Set(theirs.map((s) => s.id));
      const mine = await this.db.sets.where('catId').equals(cat.id).toArray();
      await r.pushSets(mine.filter((s) => !known.has(s.id)).sort(bySetOrder));
      if (theirs.length) await this.db.sets.bulkPut(theirs);
      const shared = await r.getCat(cat.id);
      const careSync = await this.syncCare(r, cat.id);
      // care logged here for my other pets (e.g. "Fed" for all cats) goes up now, not when that pet is next shown
      if (careSync === 'ok') {
        const others = new Set((await this.db.care.filter((c) => !!c.dirty && c.catId !== cat.id).toArray()).map((c) => c.catId));
        for (const id of others) await this.syncCare(r, id).catch(() => {});
      }
      let household = shared ? { inviteCode: shared.inviteCode, members: await r.members(cat.id) } : null;
      // keep my name in step both ways: fill it in online if it's missing there, remember it here for offline
      const meRow = household?.members.find((m) => m.userId === account.userId);
      if (meRow && !meRow.name && this.myName && !household!.members.some((m) => m.userId !== account.userId && m.name === this.myName)) { await r.setName(cat.id, this.myName).catch(() => {}); household = { ...household!, members: await r.members(cat.id) }; }
      else if (meRow?.name && meRow.name !== this.myName) this.myName = meRow.name;
      const vetsSync = shared?.cat.householdId ? await this.syncVets(r, shared.cat.householdId).catch(() => 'ok' as const) : 'ok';
      await this.rebuild((await this.db.cats.get(cat.id)) ?? cat, { household, sync: 'ok', careSync, vetsSync });
      void this.publishCard(r, cat.id);
      void this.checkFriends(r);
      void this.collectTreats();
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
    const account = create ? await this.remote!.signUp(e, password) : await this.remote!.signIn(e, password);
    this.set({ account });
    if (name.trim()) this.myName = name.trim();
    if (!share) return; // about to join someone else's Chester: don't upload this phone's own
    await this.sync();
    if (this.snap.cat && name.trim()) { await this.remote!.setName(this.snap.cat.id, name.trim()).catch(() => {}); await this.sync(); }
  }

  /** Join someone else's Chester. This phone's own cat (if any) is replaced by the shared one. */
  join(code: string, name: string): Promise<boolean> {
    return this.serial(async () => {
      const id = await this.remote!.join(code.trim(), name.trim()); if (id === null) return false;
      if (id === '') return true; // a household with no pets yet: its pets arrive as they're added
      // joining adds the pet; an untouched practice pet made during setup is tidied away
      const old = this.snap.cat;
      if (old && old.id !== id && !(await this.db.sets.where('catId').equals(old.id).count()) && !(await this.db.care.where('catId').equals(old.id).count())) await this.forget(old.id);
      await this.rebuild(await this.adopt(id));
      return true;
    }).then(async (ok) => { if (ok) await this.sync(); return ok; });
  }

  /** Remove someone from this pet (owner only), or leave it yourself. */
  async removeMember(userId: string) {
    const cat = this.snap.cat; if (!cat || !this.remote) return;
    await this.remote.removeMember(cat.id, userId);
    if (userId === this.snap.account?.userId) { await this.forget(cat.id); const next = (await this.db.cats.toArray())[0] ?? null; await this.rebuild(next); return; }
    await this.sync();
  }

  /** Change the name the other trainer sees, and the one Home greets on this phone. */
  async renameMe(name: string) {
    const n = name.trim().slice(0, 40); if (!n) return;
    this.myName = n;
    const cat = this.snap.cat; const a = this.snap.account;
    if (cat && a && this.remote) { await this.remote.setName(cat.id, n).catch(() => {}); await this.sync(); }
    else this.set({});
  }

  async signOut() { await this.remote?.signOut(); this.set({ account: null, household: null, sync: 'off', friends: null, friendNews: null, treatNews: null, requests: [] }); this.friendsCheckedAt = 0; this.treatsCheckedAt.clear(); }

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
