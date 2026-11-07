import type { Cat, SetRecord } from '../engine/types';

export interface Account { userId: string; email: string }
export interface Member { userId: string; name: string }

/** The shared copy of a cat. The app talks to Supabase through this; tests use an in-memory one. */
export interface Remote {
  account(): Promise<Account | null>;
  onAccountChange(fn: (a: Account | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<Account>;
  signOut(): Promise<void>;

  myCatIds(): Promise<string[]>;
  getCat(id: string): Promise<{ cat: Cat; inviteCode: string } | null>;
  createCat(cat: Cat): Promise<void>;
  updateCat(cat: Cat): Promise<void>;
  /** Join with an invite code; returns the cat id, or null when the code is wrong. */
  join(code: string, name: string): Promise<string | null>;
  members(catId: string): Promise<Member[]>;
  setName(catId: string, name: string): Promise<void>;

  pullSets(catId: string): Promise<SetRecord[]>;
  pushSets(sets: SetRecord[]): Promise<void>;
}
