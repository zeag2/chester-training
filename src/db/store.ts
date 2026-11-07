import { useSyncExternalStore } from 'react';
import { ChesterDB, type ProgressRow } from './db';
import { SKILLS, SKILL_BY_ID } from '../engine/skills';
import { applySet, clampSet, hiddenUnlocks } from '../engine/rules';
import { rewardFor } from '../engine/rewards';
import { localDay } from '../engine/day';
import type { Cat, Gift, Mood, ProgressEvent, SessionDraft, SetRecord, SkillProgress, Wallet } from '../engine/types';

export interface Snapshot {
  ready: boolean;
  cat: Cat | null;
  progress: Record<string, SkillProgress>;
  sets: SetRecord[];
  wallet: Wallet | null;
  draft: SessionDraft | null;
  unlockedHidden: string[];
}

export interface LogInput { skillId: string; reps: number; good: number; mood: Mood; seconds: number; note?: string; at?: number }
export interface LogResult { set: SetRecord; event: ProgressEvent; reward: { rewarded: boolean; treats: number; gift: Gift | null }; progress: SkillProgress }

const newWallet = (catId: string): Wallet => ({ catId, treats: 0, bond: 0, toys: [], playMoves: [], checkinKeys: [], napTokens: 0, hintsSeen: [] });
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export class Store {
  db: ChesterDB;
  snap: Snapshot = { ready: false, cat: null, progress: {}, sets: [], wallet: null, draft: null, unlockedHidden: [] };
  private subs = new Set<() => void>();
  rand: () => number = Math.random;

  constructor(dbName = 'chester') { this.db = new ChesterDB(dbName); }

  subscribe = (fn: () => void) => { this.subs.add(fn); return () => this.subs.delete(fn); };
  get = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    const next = { ...this.snap, ...patch };
    next.unlockedHidden = hiddenUnlocks(SKILLS, next.progress, next.wallet?.checkinKeys ?? []);
    this.snap = next; this.subs.forEach((f) => f());
  }

  async load() {
    const cat = (await this.db.cats.toCollection().first()) ?? null;
    if (!cat) { this.set({ ready: true }); return; }
    const rows = await this.db.progress.where('catId').equals(cat.id).toArray();
    const sets = (await this.db.sets.where('catId').equals(cat.id).toArray()).sort((a, b) => a.at - b.at);
    const wallet = (await this.db.wallet.get(cat.id)) ?? newWallet(cat.id);
    const draft = (await this.db.drafts.get(cat.id)) ?? null;
    this.set({ ready: true, cat, progress: Object.fromEntries(rows.map(({ catId: _c, ...p }) => [p.skillId, p])), sets, wallet, draft });
  }

  async saveCat(c: Omit<Cat, 'id' | 'createdAt'> & Partial<Pick<Cat, 'id' | 'createdAt'>>) {
    const cat: Cat = { ...c, id: c.id ?? uid(), createdAt: c.createdAt ?? Date.now() } as Cat;
    await this.db.cats.put(cat);
    const wallet = this.snap.wallet ?? (await this.db.wallet.get(cat.id)) ?? newWallet(cat.id);
    await this.db.wallet.put(wallet);
    this.set({ cat, wallet });
    return cat;
  }

  async updateWallet(fn: (w: Wallet) => Wallet) {
    if (!this.snap.wallet) return;
    const w = fn(this.snap.wallet); await this.db.wallet.put(w); this.set({ wallet: w });
  }

  async saveDraft(d: Omit<SessionDraft, 'catId'>) {
    if (!this.snap.cat) return;
    const draft = { ...d, catId: this.snap.cat.id }; await this.db.drafts.put(draft); this.set({ draft });
  }
  async clearDraft() { if (!this.snap.cat) return; await this.db.drafts.delete(this.snap.cat.id); this.set({ draft: null }); }

  async logSet(input: LogInput): Promise<LogResult | null> {
    const cat = this.snap.cat; const def = SKILL_BY_ID[input.skillId];
    if (!cat || !def) return null;
    const { reps, good } = clampSet(input);
    if (reps === 0) return null;
    const at = input.at ?? Date.now(); const day = localDay(at);
    const prev = this.snap.progress[def.id] ?? { skillId: def.id, step: 0, mastered: false };
    const forSkill = this.snap.sets.filter((s) => s.skillId === def.id);
    const today = this.snap.sets.filter((s) => s.day === day);
    const treatsToday = today.reduce((t, s) => t + (s.repTreats ?? 0), 0);
    const base: SetRecord = { id: uid(), catId: cat.id, at, day, skillId: def.id, step: prev.mastered ? def.steps.length : prev.step, reps, good, mood: input.mood, seconds: Math.round(input.seconds), review: prev.mastered, rewarded: false, note: input.note };
    const { progress, event } = applySet(prev, forSkill, base, def);
    const reward = rewardFor(base, today, treatsToday, this.rand);
    const set: SetRecord = { ...base, rewarded: reward.rewarded, repTreats: reward.rewarded ? reward.treats - (reward.gift?.treats ?? 0) : 0 };
    const w0 = this.snap.wallet ?? newWallet(cat.id);
    const g = reward.gift;
    const wallet: Wallet = { ...w0, treats: w0.treats + reward.treats, bond: w0.bond + (g?.bond ?? 0),
      toys: g?.kind === 'toy' ? [...w0.toys, g.title.replace(/^New toy: /, '')] : w0.toys, lastGift: g ?? w0.lastGift };
    const row: ProgressRow = { ...progress, catId: cat.id };
    await this.db.transaction('rw', this.db.sets, this.db.progress, this.db.wallet, this.db.drafts, async () => {
      await this.db.sets.put(set); await this.db.progress.put(row); await this.db.wallet.put(wallet); await this.db.drafts.delete(cat.id);
    });
    this.set({ sets: [...this.snap.sets, set], progress: { ...this.snap.progress, [def.id]: progress }, wallet, draft: null });
    return { set, event, reward, progress };
  }
}

export const store = new Store();
export function useStore(): Snapshot { return useSyncExternalStore(store.subscribe, store.get, store.get); }
