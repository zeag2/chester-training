import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';
import type { Vet } from '../engine/vets';

export interface Account { userId: string; email: string }
/** What friends see of a pet: its look and a few training highlights. Never care, documents or sets. */
export interface PetCard { name: string; coat?: string; eyes?: string; sex?: 'm' | 'f'; birthday?: string; wear?: string; cushion?: string; mastered?: string[]; setsWeek?: number; streak?: number; bond?: number }
export interface Friend { userId: string; name: string }
/** A friend request: `incoming` = they asked me ("Accept Erin?"), otherwise I asked them and it's waiting. */
export interface FriendRequest { userId: string; name: string; incoming: boolean }
/** What entering a code did: `sent` a request, made you `friends` (they'd already asked you), or you were `already` friends. */
export interface AddFriendResult { name: string; status: 'sent' | 'friends' | 'already' }
export interface FriendPet { owner: string; ownerName: string; catId: string; card: PetCard }
/** A free treat a friend gave one of my pets on their local day. */
export interface ReceivedTreat { from: string; fromName: string; day: string }

/** A photo in the feed (the pet's household and its friends see it). `at` is an ISO time. */
export interface Photo { id: string; catId: string; path: string; caption: string; width?: number; height?: number; skill?: string; by: string; at: string; paws: number; pawed: boolean }
export interface NewPhoto { catId: string; path: string; caption: string; width: number; height: number; skill?: string }

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
  /** Email a password-reset link that opens `redirectTo`. */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  /** Sign in with the tokens from a reset link. Throws 'link-expired' when they're no good. */
  startRecovery(accessToken: string, refreshToken: string): Promise<Account>;
  /** Change the signed-in account's password. */
  setPassword(password: string): Promise<void>;

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

  /** The household's vet contacts, deleted ones included. Throws 'vets-missing' until the vets SQL is run. */
  pullVets(householdId: string): Promise<Vet[]>;
  pushVets(vets: Vet[]): Promise<void>;

  /** Vet documents in the shared bucket. */
  uploadDoc(path: string, file: Blob, mime: string): Promise<void>;
  docUrl(path: string): Promise<string>;
  removeDoc(path: string): Promise<void>;
  /** Ask the server to read a stored document and suggest log entries. */
  readDoc(path: string): Promise<DocReading>;

  /** Friends. These throw 'friends-missing' until the friends SQL has been run. */
  friendCode(name: string): Promise<string>;
  /** Send a friend request by code (accepts theirs if they'd already asked). Null when the code is wrong or your own.
      Before the friend requests SQL is run this falls back to the old instant friendship (status 'friends'). */
  addFriend(code: string): Promise<AddFriendResult | null>;
  /** Requests waiting on me and mine waiting on them ([] before the friend requests SQL is run). */
  friendRequests(): Promise<FriendRequest[]>;
  /** Accept (friends both ways) or decline a request someone sent me. */
  answerFriend(userId: string, accept: boolean): Promise<void>;
  /** Take back a request I sent. */
  cancelFriendRequest(userId: string): Promise<void>;
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

  /** Photo feed. These throw 'photos-missing' until its SQL is run. */
  /** Upload the (already shrunk) file, then add the row; removes the file again when the row can't be added. */
  postPhoto(p: NewPhoto, file: Blob): Promise<void>;
  /** Newest first, a page at a time: pass the last photo's `at` for the next page. */
  photoFeed(before?: string): Promise<Photo[]>;
  /** Signed links for showing photos (one call per page). */
  photoUrls(paths: string[]): Promise<Record<string, string>>;
  /** Give or take back my paw on a photo I can see. */
  setPaw(photoId: string, on: boolean): Promise<void>;
  /** Hide a friend's photo from my feed (or show it again). */
  setHidden(photoId: string, hidden: boolean): Promise<void>;
  /** The poster changes the caption. */
  editCaption(photoId: string, caption: string): Promise<void>;
  /** The poster or the pet's household deletes the photo, then its file. Throws 'not-allowed' when nothing was deleted. */
  deletePhoto(photo: Pick<Photo, 'id' | 'path'>): Promise<void>;
}
