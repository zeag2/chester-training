import type { Cat, SetRecord } from '../engine/types';
import type { CareItem } from '../engine/care';

export interface Account { userId: string; email: string }
export interface Member { userId: string; name: string }

/** The shared copy of a cat. The app talks to Supabase through this; tests use an in-memory one. */
export interface Remote {
  account(): Promise<Account | null>;
  onAccountChange(fn: (a: Account | null) => void): () => void;
  /** Throws 'bad-login' when the email or password doesn't match. */
  signIn(email: string, password: string): Promise<Account>;
  /** Throws 'email-taken' when that email already has an account. */
  signUp(email: string, password: string): Promise<Account>;
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

  /** Care items, deleted ones included (so a delete reaches the other phone). */
  pullCare(catId: string): Promise<CareItem[]>;
  pushCare(items: CareItem[]): Promise<void>;
}
