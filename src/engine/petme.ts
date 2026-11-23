/* "Pet me?" moments: up to 3 a day, 9 AM to 9 PM, the cat on Home walks on and asks for pets. Petting adds a bond
   point (the first time each day, so bond levels keep their pace) and makes rare moves likelier for a while (`RARE` in
   `src/chester/reactions.ts`); ignoring him costs nothing (he curls up). Each moment shows once per phone, and a missed one never stacks up: opening the app
   late shows only the latest one due. */

export const PET_ME = {
  perDay: 3,
  fromHour: 9,
  toHour: 21,
  bond: 1,
  /** How long he waits with his paw up before he curls up. */
  waitMs: 45_000,
  /** How long he stays curled up after being ignored. */
  curlMs: 20_000,
  /** After a pet, rare moves are likelier for this long. */
  luckyMs: 10 * 60_000,
};

/** Today's moment times in minutes after midnight, seeded by pet and day: one at random in each third of the window. */
export function petMeTimes(catId: string, day: string): number[] {
  let h = 2166136261;
  for (const ch of 'petme' + catId + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const from = PET_ME.fromHour * 60, span = ((PET_ME.toHour - PET_ME.fromHour) * 60) / PET_ME.perDay;
  return Array.from({ length: PET_ME.perDay }, (_, i) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ i; h ^= h >>> 13;
    // keep 10 minutes clear at each edge so two moments are never back to back
    return Math.round(from + i * span + 10 + ((h >>> 0) % (span - 20)));
  });
}

/** The moment due now (its index), or null: the latest one whose time has come, inside the window, not yet shown. */
export function duePetMe(catId: string, day: string, nowMin: number, shown: number[]): number | null {
  if (nowMin < PET_ME.fromHour * 60 || nowMin >= PET_ME.toHour * 60) return null;
  const times = petMeTimes(catId, day);
  let i = -1; times.forEach((t, k) => { if (t <= nowMin) i = k; });
  return i < 0 || shown.includes(i) ? null : i;
}

/** The corner log id for today's petting bond point (once per pet per day, shared by the household). */
export const petMeId = (day: string) => 'pet-' + day;

// which moments this phone has shown today (a per-phone convenience: nothing is lost if it's cleared)
const KEY = (catId: string, day: string) => `paldex:petme:${catId}:${day}`;
export function shownPetMe(catId: string, day: string): number[] {
  try { const v = JSON.parse(localStorage.getItem(KEY(catId, day)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function markPetMe(catId: string, day: string, i: number) {
  try { localStorage.setItem(KEY(catId, day), JSON.stringify([...new Set([...shownPetMe(catId, day), i])])); } catch { /* private mode */ }
}
