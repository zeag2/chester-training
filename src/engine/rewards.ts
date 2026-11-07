import type { Gift, SetRecord } from './types';

export const DAILY_REWARDED_SETS = 3;
export const DAILY_TREAT_CAP = 30;
export const GIFT_MIN_REPS = 3;
export const GIFT_MIN_SECONDS = 60;

const TOYS = ['a crinkle ball', 'a feather wand', 'a toy mouse', 'a catnip fish', 'a jingle ball'];
const SNACKS = ['a salmon snack', 'a chicken bite', 'a tuna flake'];

export function rollGift(rand: () => number): Gift {
  const r = rand();
  if (r < 0.05) return { kind: 'jackpot', title: 'Jackpot!', detail: 'Chester found a stash of treats under the couch', treats: 25, bond: 2 };
  const pick = <T,>(xs: T[]) => xs[Math.floor(((r * 997) % 1) * xs.length)];
  if (r < 0.35) return { kind: 'treats', title: '+5 treats', detail: 'Chester is proud of himself', treats: 5, bond: 0 };
  if (r < 0.6) { const t = pick(TOYS); return { kind: 'toy', title: `New toy: ${t}`, detail: 'Added to Chester’s corner', treats: 0, bond: 0 }; }
  if (r < 0.8) { const s = pick(SNACKS); return { kind: 'snack', title: `A snack: ${s}`, detail: 'Chester’s bowl is happy', treats: 2, bond: 1 }; }
  return { kind: 'bond', title: 'Chester loves you a little more', detail: '+1 bond', treats: 0, bond: 1 };
}

/** Rewards for a set. `setsToday` = sets already logged today (excluding `s`). Returns total treats incl. gift. */
export function rewardFor(s: SetRecord, setsToday: SetRecord[], treatsToday: number, rand: () => number = Math.random): { rewarded: boolean; treats: number; gift: Gift | null } {
  const rewardedSoFar = setsToday.filter((x) => x.rewarded).length;
  if (rewardedSoFar >= DAILY_REWARDED_SETS) return { rewarded: false, treats: 0, gift: null };
  const repTreats = Math.max(0, Math.min(s.good, DAILY_TREAT_CAP - treatsToday));
  const earnsGift = s.reps >= GIFT_MIN_REPS || s.seconds >= GIFT_MIN_SECONDS;
  const gift = earnsGift ? rollGift(rand) : null;
  return { rewarded: true, treats: repTreats + (gift?.treats ?? 0), gift };
}
