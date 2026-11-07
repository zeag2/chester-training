import { applySet } from './rules';
import type { Cat, Gift, SetRecord, SkillDef, SkillProgress, Wallet } from './types';

/** Sets in the order they happened; ties broken by id so every phone replays them the same way. */
export const bySetOrder = (a: SetRecord, b: SetRecord) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Skill progress, worked out by replaying every set. Sets are the only thing two trainers share. */
export function deriveProgress(sets: SetRecord[], defs: Record<string, SkillDef>): Record<string, SkillProgress> {
  const out: Record<string, SkillProgress> = {};
  const seen: Record<string, SetRecord[]> = {};
  for (const s of [...sets].sort(bySetOrder)) {
    const def = defs[s.skillId]; if (!def) continue;
    const prev = out[s.skillId] ?? { skillId: s.skillId, step: 0, mastered: false };
    const earlier = (seen[s.skillId] ??= []);
    out[s.skillId] = applySet(prev, earlier, s, def).progress;
    earlier.push(s);
  }
  return out;
}

export interface Earned { treats: number; bond: number; toys: string[]; lastGift?: Gift }

/** Treats, bond and toys from the sets' recorded rewards, plus anything carried over from before. */
export function deriveEarned(sets: SetRecord[], carry?: Cat['carry']): Earned {
  const e: Earned = { treats: carry?.treats ?? 0, bond: carry?.bond ?? 0, toys: [...(carry?.toys ?? [])] };
  for (const s of [...sets].sort(bySetOrder)) {
    if (!s.rewarded) continue;
    const g = s.gift;
    e.treats += (s.repTreats ?? 0) + (g?.treats ?? 0);
    e.bond += g?.bond ?? 0;
    if (g?.kind === 'toy') e.toys.push(g.title.replace(/^New toy: /, ''));
    if (g) e.lastGift = g;
  }
  return e;
}

/** Wallet = what the sets earned + this phone's own bits (hints seen, check-ins, nap tokens). */
export function mergeWallet(local: Wallet, earned: Earned): Wallet {
  return { ...local, treats: earned.treats, bond: earned.bond, toys: earned.toys, lastGift: earned.lastGift ?? local.lastGift };
}

/** For data saved before sets kept their gifts: what the old wallet holds beyond what the sets explain. */
export function carryFrom(wallet: Wallet | undefined, sets: SetRecord[]): NonNullable<Cat['carry']> {
  const e = deriveEarned(sets);
  if (!wallet) return { treats: 0, bond: 0, toys: [] };
  const toys = [...wallet.toys]; for (const t of e.toys) { const i = toys.indexOf(t); if (i >= 0) toys.splice(i, 1); }
  return { treats: Math.max(0, wallet.treats - e.treats), bond: Math.max(0, wallet.bond - e.bond), toys };
}
