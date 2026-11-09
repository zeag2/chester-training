/* Chester's corner: where treats get spent. Buys, daily gifts and play time are kept on the pet as an append-only log
   (merged by id across phones, so two phones never lose each other's buys); what he wears and sleeps on is a plain
   choice where the newest pet edit wins. Balance = treats the sets earned + every log entry's treats (buys are negative). */
import type { Earned } from './derive';
import type { CareItem } from './care';
import { daysBetween, localDay } from './day';

export type ShelfKind = 'outfit' | 'toy' | 'cushion';
/** `special`: not for sale; earned another way (shown in the corner once earned, with how to earn it until then). */
export interface ShopItem { id: string; kind: ShelfKind; name: string; price: number; blurb: string; special?: string }

export const SHOP: ShopItem[] = [
  { id: 'bell', kind: 'outfit', name: 'Bell collar', price: 12, blurb: 'Jingles when he hops' },
  { id: 'bowtie', kind: 'outfit', name: 'Bow tie', price: 18, blurb: 'For formal naps' },
  { id: 'bandana', kind: 'outfit', name: 'Bandana', price: 20, blurb: 'Adventure ready' },
  { id: 'flower', kind: 'outfit', name: 'Ear flower', price: 22, blurb: 'A daisy behind one ear' },
  { id: 'party', kind: 'outfit', name: 'Party hat', price: 28, blurb: 'Every day is a party' },
  { id: 'crown', kind: 'outfit', name: 'Little crown', price: 45, blurb: 'He always knew' },
  { id: 'scarf', kind: 'outfit', name: 'Friendship scarf', price: 0, blurb: 'For making a friend', special: 'Make a friend on PalDex to earn it' },
  { id: 'box', kind: 'toy', name: 'Cardboard box', price: 8, blurb: 'The best toy ever made' },
  { id: 'laser', kind: 'toy', name: 'Laser dot', price: 14, blurb: 'Where did it go?' },
  { id: 'tunnel', kind: 'toy', name: 'Crinkle tunnel', price: 24, blurb: 'Zoom in, zoom out' },
  { id: 'mint', kind: 'cushion', name: 'Mint cushion', price: 15, blurb: 'Soft and round' },
  { id: 'heart', kind: 'cushion', name: 'Heart cushion', price: 25, blurb: 'Extra loved' },
  { id: 'cloud', kind: 'cushion', name: 'Cloud bed', price: 40, blurb: 'Fluffiest nap spot' },
];
export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

export type CornerKind = 'buy' | 'gift' | 'play' | 'friend' | 'treat' | 'care' | 'streak';
export interface CornerEvent {
  /** Buys get a random id; the daily gift is `gift-<day>`, play is `play-<day>`, a friend bonus is `friend-<their id>`
      a friend's free treat is `treat-<their id>-<their day>` and a care entry's treats are `care-<care item id>`, so two phones can't both claim one, and a friend
      removed and added again doesn't pay twice. */
  id: string;
  kind: CornerKind;
  day: string;
  at: number;
  item?: string;
  /** Change to the treat balance: negative for a buy. */
  treats: number;
  bond: number;
  by?: string;
}
export interface Corner {
  log: CornerEvent[]; wearing?: string; cushion?: string;
  /** When the outfit or cushion was last changed, so opening a gift on another phone never undoes it. */
  styledAt?: number;
}

/** Union of both logs by id (oldest first); `wearing` and `cushion` come from whichever side changed them last
    (`pick`, the newer pet edit, on a tie). */
export function mergeCorner(pick: Corner | undefined, other: Corner | undefined): Corner | undefined {
  if (!pick && !other) return undefined;
  const style = (other?.styledAt ?? 0) > (pick?.styledAt ?? 0) ? other! : pick ?? other!;
  const byId = new Map<string, CornerEvent>();
  for (const e of [...(other?.log ?? []), ...(pick?.log ?? [])]) if (!byId.has(e.id)) byId.set(e.id, e);
  const log = [...byId.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return { log, wearing: style.wearing, cushion: style.cushion, styledAt: style.styledAt };
}

/** What the sets earned plus the corner's log. */
export function withCorner(e: Earned, c: Corner | undefined): Earned {
  if (!c?.log.length) return e;
  let treats = e.treats, bond = e.bond;
  for (const x of c.log) { treats += x.treats; bond += x.bond; }
  return { ...e, treats, bond };
}

/** What the pet owns: bought items, the scarf once it has a friend, and outfits its bond level has given it. */
export function owned(c: Corner | undefined, bond = 0): Set<string> {
  const log = c?.log ?? [];
  const out = new Set(log.filter((e) => e.kind === 'buy' && e.item).map((e) => e.item!));
  for (const l of BOND_LEVELS) if (l.gift && bond >= l.at) out.add(l.gift);
  if (log.some((e) => e.kind === 'friend')) out.add('scarf');
  return out;
}

/** Making a friend: treats and a bond point for the pet, once per friend, for the first few friends. */
export const FRIEND_BONUS = { treats: 15, bond: 1, max: 10 };
/** Which of these friends haven't paid their bonus to this pet yet (respecting the cap). */
export function unrewardedFriends(c: Corner | undefined, friendIds: string[]): string[] {
  const log = c?.log ?? []; const paid = new Set(log.filter((e) => e.kind === 'friend').map((e) => e.id));
  const room = Math.max(0, FRIEND_BONUS.max - paid.size);
  return friendIds.filter((id) => !paid.has('friend-' + id)).slice(0, room);
}

/** A friend's free treat (once a day per friend per pet, enforced by the server). */
export const FRIEND_TREAT = 1;
export const treatId = (from: string, day: string) => `treat-${from}-${day}`;
/** Received treats that aren't in this pet's log yet. */
export function newTreats<T extends { from: string; day: string }>(c: Corner | undefined, got: T[]): T[] {
  const have = new Set((c?.log ?? []).filter((e) => e.kind === 'treat').map((e) => e.id)); const seen = new Set<string>();
  return got.filter((t) => { const id = treatId(t.from, t.day); if (have.has(id) || seen.has(id)) return false; seen.add(id); return true; });
}

/** Treats for looking after the pet: a little for every new care entry (a few a day), more for the routines that
    matter. Logging is self-reported, so the daily cap keeps it from being a tap-to-win game. */
export const CARE_TREATS = { perEntry: 2, perDay: 3, weighIn: 5, weighInEveryDays: 7, medOnTime: 3, vetVisit: 5 };
export interface CareReward { treats: number; why: 'entry' | 'weighIn' | 'medOnTime' | 'vetVisit' | 'streak' }
/** What a newly saved care entry earns (null: nothing, e.g. today's cap is reached or it was already paid).
    `history` is the pet's other care entries. Bonuses only count for things that just happened (not old entries
    filled in from a document). */
export function careReward(c: Corner | undefined, item: CareItem, history: CareItem[], now = Date.now()): CareReward | null {
  const log = c?.log ?? []; const today = localDay(now);
  if (item.deleted || log.some((e) => e.id === 'care-' + item.id)) return null;
  if (log.filter((e) => e.kind === 'care' && e.day === today).length >= CARE_TREATS.perDay) return null;
  const ago = daysBetween(localDay(item.at), today); const recent = (days: number) => ago >= 0 && ago <= days; // not future appointments
  const base = CARE_TREATS.perEntry;
  if (item.kind === 'weight' && recent(1)) {
    const lastBonus = log.filter((e) => e.kind === 'care' && e.item === 'weight' && e.treats > base).sort((a, b) => b.at - a.at)[0];
    if (!lastBonus || daysBetween(lastBonus.day, today) >= CARE_TREATS.weighInEveryDays) return { treats: base + CARE_TREATS.weighIn, why: 'weighIn' };
  }
  if (item.kind === 'vet' && recent(7)) return { treats: base + CARE_TREATS.vetVisit, why: 'vetVisit' };
  if (item.kind === 'med' && recent(1)) {
    const name = (item.data as { name: string }).name.trim().toLowerCase();
    const prev = (history.filter((h) => h.kind === 'med') as CareItem<'med'>[]).filter((h) => !h.deleted && h.id !== item.id && h.at < item.at && h.data.name.trim().toLowerCase() === name).sort((a, b) => b.at - a.at)[0];
    if (prev?.data.nextDue && localDay(item.at) <= prev.data.nextDue) return { treats: base + CARE_TREATS.medOnTime, why: 'medOnTime' };
  }
  return { treats: base, why: 'entry' };
}

/** Care logged on 7 days in a row earns a bonus, once per 7 days (`streak-<day>`). Missing a day just starts the count
    again; nothing is ever taken away or shown as broken. */
export const CARE_STREAK = { days: 7, treats: 10 };
export function careStreakDue(c: Corner | undefined, care: CareItem[], now = Date.now()): string | null {
  const today = localDay(now); const logged = new Set(care.filter((i) => !i.deleted).map((i) => localDay(i.at)));
  for (let k = 0; k < CARE_STREAK.days; k++) if (!logged.has(localDay(now - k * 864e5))) return null;
  const last = (c?.log ?? []).filter((e) => e.kind === 'streak').sort((a, b) => b.at - a.at)[0];
  if (last && daysBetween(last.day, today) < CARE_STREAK.days) return null;
  return 'streak-' + today;
}
/** The first play of the day: a bond point and a couple of treats. */
export const PLAY_REWARD = { treats: 2, bond: 1 };

export function canBuy(item: ShopItem, balance: number, c: Corner | undefined, bond = 0): boolean { return !item.special && !owned(c, bond).has(item.id) && balance >= item.price; }

/** The daily gift's size, the same on every phone for a given pet and day: 2 to 6 treats. */
export function dailyGiftTreats(catId: string, day: string): number {
  let h = 2166136261;
  for (const ch of catId + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 2 + ((h >>> 0) % 5);
}
export const giftClaimed = (c: Corner | undefined, day: string) => !!c?.log.some((e) => e.id === 'gift-' + day);
export const playedToday = (c: Corner | undefined, day: string) => !!c?.log.some((e) => e.id === 'play-' + day);

/** `gift`: an outfit that becomes his for free on reaching that level (or he can buy it sooner). */
export const BOND_LEVELS: { at: number; name: string; gift?: string }[] = [
  { at: 0, name: 'Getting to know you' },
  { at: 3, name: 'Buddies', gift: 'bell' },
  { at: 8, name: 'Pals', gift: 'bowtie' },
  { at: 15, name: 'Best friends', gift: 'flower' },
  { at: 25, name: 'Partners in crime', gift: 'party' },
  { at: 40, name: 'Soulmates', gift: 'crown' },
];
/** The bond level that gives this item for free, if any. */
export const bondGiftLevel = (itemId: string) => BOND_LEVELS.find((l) => l.gift === itemId);
/** Level (1-based), its name, and how far along to the next one (0 to 1; 1 at the top level). */
export function bondLevel(bond: number): { level: number; name: string; next: number | null; frac: number } {
  let i = 0; while (i + 1 < BOND_LEVELS.length && bond >= BOND_LEVELS[i + 1].at) i++;
  const cur = BOND_LEVELS[i], nxt = BOND_LEVELS[i + 1];
  return { level: i + 1, name: cur.name, next: nxt ? nxt.at : null, frac: nxt ? (bond - cur.at) / (nxt.at - cur.at) : 1 };
}
