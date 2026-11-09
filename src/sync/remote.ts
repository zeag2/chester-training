import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';

export interface Account { userId: string; email: string }
/** What friends see of a pet: its look and a few training highlights. Never care, documents or sets. */
export interface PetCard { name: string; coat?: string; eyes?: string; sex?: 'm' | 'f'; birthday?: string; wear?: string; cushion?: string; mastered?: string[]; setsWeek?: number; streak?: number; bond?: number }
export interface Friend { userId: string; name: string }
export interface FriendPet { owner: string; ownerName: string; catId: string; card: PetCard }
/** A free treat a friend gave one of my pets on their local day. */
export interface ReceivedTreat { from: string; fromName: string; day: string }

export interface Member { userId: string; name: string; email?: string; sets?: number; owner?: boolean }

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
  /** Remove someone from a cat (the owner can remove anyone; anyone can remove themselves). */
  removeMember(catId: string, userId: string): Promise<void>;

  pullSets(catId: string): Promise<SetRecord[]>;
  pushSets(sets: SetRecord[]): Promise<void>;

  /** Care items, deleted ones included (so a delete reaches the other phone). */
  pullCare(catId: string): Promise<CareItem[]>;
  pushCare(items: CareItem[]): Promise<void>;

  /** Vet documents in the shared bucket. */
  uploadDoc(path: string, file: Blob, mime: string): Promise<void>;
  docUrl(path: string): Promise<string>;
  removeDoc(path: string): Promise<void>;
  /** Ask the server to read a stored document and suggest log entries. */
  readDoc(path: string): Promise<DocReading>;

  /** Friends. These throw 'friends-missing' until the friends SQL has been run. */
  friendCode(name: string): Promise<string>;
  /** Their name ('' if none), or null when the code is wrong or your own. */
  addFriend(code: string): Promise<string | null>;
  friends(): Promise<Friend[]>;
  friendPets(): Promise<FriendPet[]>;
  removeFriend(userId: string): Promise<void>;
  /** Publish a pet's card for friends to see. */
  publishCard(catId: string, card: PetCard): Promise<void>;

  /** Friends' treats. These throw 'treats-missing' until the friend treats SQL has been run. */
  /** Give a friend's pet today's free treat: true when given, false when it already had one from you that day. */
  giveTreat(catId: string, day: string): Promise<boolean>;
  /** Friends' pets I've given a treat to on that day. */
  treatsGiven(day: string): Promise<string[]>;
  /** Treats my pet got from friends (the last 30 days). */
  treatsFor(catId: string): Promise<ReceivedTreat[]>;
  /** Thank a friend for a treat my pet got (throws 'thanks-missing' until its SQL is run). */
  thankTreat(from: string, catId: string, day: string): Promise<void>;
  /** Thank-yous for treats I gave (last 7 days). */
  myThanks(): Promise<{ catId: string; catName: string; day: string }[]>;
}
