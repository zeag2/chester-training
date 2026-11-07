export type Mood = 'Happy' | 'Distracted' | 'Stressed';
export type Branch = 'Foundation' | 'Care' | 'Manners' | 'Adventure' | 'Tricks';

export interface SkillDef {
  id: string;
  name: string;
  branch: Branch;
  priority: 1 | 2 | 3 | 4 | 5;
  why: string;
  steps: string[];
  tips: string;
  requires: string[];
  hidden?: { unlockBy: string };
  sources: string[];
}

export interface SetRecord {
  id: string;
  catId: string;
  at: number;
  day: string;
  skillId: string;
  step: number;
  reps: number;
  good: number;
  mood: Mood;
  seconds: number;
  review: boolean;
  rewarded: boolean;
  repTreats?: number;
  note?: string;
  /** The gift this set earned, so treats and toys can be worked out again on any phone. */
  gift?: Gift | null;
  /** Account id of whoever logged it (shared training). */
  by?: string;
}

export interface SkillProgress {
  skillId: string;
  step: number;
  mastered: boolean;
  masteredAt?: number;
}

export type GiftKind = 'treats' | 'toy' | 'snack' | 'bond' | 'jackpot';
export interface Gift {
  kind: GiftKind;
  title: string;
  detail: string;
  treats: number;
  bond: number;
}

export type ProgressEvent = 'none' | 'pass' | 'stepUp' | 'mastered' | 'review';

export interface Cat {
  id: string;
  name: string;
  birthday: string;
  homeDate: string;
  breed: string;
  coat: string;
  eyes: string;
  weightLb?: number;
  rewards: string[];
  outfit: string;
  createdAt: number;
  updatedAt?: number;
  /** Treats, bond and toys earned before sets kept their gifts (set once when upgrading). */
  carry?: { treats: number; bond: number; toys: string[] };
}

export interface Wallet {
  catId: string;
  treats: number;
  bond: number;
  toys: string[];
  playMoves: string[];
  checkinKeys: string[];
  napTokens: number;
  hintsSeen: string[];
  lastGift?: Gift;
}

export interface SessionDraft {
  catId: string;
  skillId: string;
  startedAt: number;
  reps: number;
  good: number;
  seconds: number;
}
