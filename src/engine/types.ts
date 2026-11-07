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
  note?: string;
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
