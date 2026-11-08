/* Chester's corner: where treats get spent. Buys, daily gifts and play time are kept on the pet as an append-only log
   (merged by id across phones, so two phones never lose each other's buys); what he wears and sleeps on is a plain
   choice where the newest pet edit wins. Balance = treats the sets earned + every log entry's treats (buys are negative). */
import type { Earned } from './derive';

export type ShelfKind = 'outfit' | 'toy' | 'cushion';
export interface ShopItem { id: string; kind: ShelfKind; name: string; price: number; blurb: string }

export const SHOP: ShopItem[] = [
  { id: 'bell', kind: 'outfit', name: 'Bell collar', price: 12, blurb: 'Jingles when he hops' },
  { id: 'bowtie', kind: 'outfit', name: 'Bow tie', price: 18, blurb: 'For formal naps' },
  { id: 'bandana', kind: 'outfit', name: 'Bandana', price: 20, blurb: 'Adventure ready' },
  { id: 'flower', kind: 'outfit', name: 'Ear flower', price: 22, blurb: 'A daisy behind one ear' },
  { id: 'party', kind: 'outfit', name: 'Party hat', price: 28, blurb: 'Every day is a party' },
  { id: 'crown', kind: 'outfit', name: 'Little crown', price: 45, blurb: 'He always knew' },
  { id: 'box', kind: 'toy', name: 'Cardboard box', price: 8, blurb: 'The best toy ever made' },
  { id: 'laser', kind: 'toy', name: 'Laser dot', price: 14, blurb: 'Where did it go?' },
  { id: 'tunnel', kind: 'toy', name: 'Crinkle tunnel', price: 24, blurb: 'Zoom in, zoom out' },
  { id: 'mint', kind: 'cushion', name: 'Mint cushion', price: 15, blurb: 'Soft and round' },
  { id: 'heart', kind: 'cushion', name: 'Heart cushion', price: 25, blurb: 'Extra loved' },
  { id: 'cloud', kind: 'cushion', name: 'Cloud bed', price: 40, blurb: 'Fluffiest nap spot' },
];
export const ITEM_BY_ID: Record<string, ShopItem> = Object.fromEntries(SHOP.map((i) => [i.id, i]));

export type CornerKind = 'buy' | 'gift' | 'play';
export interface CornerEvent {
  /** Buys get a random id; the daily gift is `gift-<day>` and play is `play-<day>`, so two phones can't both claim one. */
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

export function owned(c: Corner | undefined): Set<string> { return new Set((c?.log ?? []).filter((e) => e.kind === 'buy' && e.item).map((e) => e.item!)); }

export function canBuy(item: ShopItem, balance: number, c: Corner | undefined): boolean { return !owned(c).has(item.id) && balance >= item.price; }

/** The daily gift's size, the same on every phone for a given pet and day: 2 to 6 treats. */
export function dailyGiftTreats(catId: string, day: string): number {
  let h = 2166136261;
  for (const ch of catId + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return 2 + ((h >>> 0) % 5);
}
export const giftClaimed = (c: Corner | undefined, day: string) => !!c?.log.some((e) => e.id === 'gift-' + day);
export const playedToday = (c: Corner | undefined, day: string) => !!c?.log.some((e) => e.id === 'play-' + day);

export const BOND_LEVELS = [
  { at: 0, name: 'Getting to know you' },
  { at: 3, name: 'Buddies' },
  { at: 8, name: 'Pals' },
  { at: 15, name: 'Best friends' },
  { at: 25, name: 'Partners in crime' },
  { at: 40, name: 'Soulmates' },
];
/** Level (1-based), its name, and how far along to the next one (0 to 1; 1 at the top level). */
export function bondLevel(bond: number): { level: number; name: string; next: number | null; frac: number } {
  let i = 0; while (i + 1 < BOND_LEVELS.length && bond >= BOND_LEVELS[i + 1].at) i++;
  const cur = BOND_LEVELS[i], nxt = BOND_LEVELS[i + 1];
  return { level: i + 1, name: cur.name, next: nxt ? nxt.at : null, frac: nxt ? (bond - cur.at) / (nxt.at - cur.at) : 1 };
}
