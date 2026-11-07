export type ReactionId = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7' | 'r8' | 'r9' | 'r10' | 'r11' | 'r12' | 'r13' | 'r14';

export const REACTIONS: { id: ReactionId; name: string; weight: number; lines: string[]; sound: 'chirp' | 'purr' | 'sparkle' | 'sneeze'; ms: number }[] = [
  { id: 'r1', name: 'Happy hop', weight: 10, lines: ['Mrrp! Again!', 'Boing!', 'Hi hi hi!'], sound: 'chirp', ms: 1100 },
  { id: 'r3', name: 'Purr', weight: 10, lines: ['Prrrrrr...', 'Mmm, right there', 'Prrrp'], sound: 'purr', ms: 1300 },
  { id: 'r4', name: 'Tickle wiggle', weight: 9, lines: ['Hehe, that tickles!', 'Not the tummy!'], sound: 'chirp', ms: 1300 },
  { id: 'r12', name: 'Chin scratch', weight: 9, lines: ['Ooh, the chin spot', 'Yesss, there', 'Prrr...'], sound: 'purr', ms: 2200 },
  { id: 'r13', name: 'Play bite', weight: 7, lines: ['Got you!', 'Nom nom', 'Gotcha!'], sound: 'chirp', ms: 1600 },
  { id: 'r8', name: 'Head bonk', weight: 8, lines: ['*bonk*', 'Head boop!'], sound: 'purr', ms: 1300 },
  { id: 'r2', name: 'Spin', weight: 7, lines: ['Wheee!', 'Spinny!'], sound: 'chirp', ms: 1300 },
  { id: 'r6', name: 'Love hop', weight: 7, lines: ['Love you too', 'Best human'], sound: 'chirp', ms: 1300 },
  { id: 'r9', name: 'Mlem', weight: 7, lines: ['Mlem.', 'Blep.'], sound: 'chirp', ms: 1300 },
  { id: 'r7', name: 'Belly roll', weight: 8, lines: ['Belly up!', 'Roll time!', 'Wiggle wiggle'], sound: 'chirp', ms: 2100 },
  { id: 'r10', name: 'Sneeze', weight: 4, lines: ['Achoo!', 'Pfft!'], sound: 'sneeze', ms: 1300 },
  { id: 'r5', name: 'Zoomies', weight: 3, lines: ['ZOOMIES!!', 'Gotta go fast!'], sound: 'sparkle', ms: 1600 },
  { id: 'r11', name: 'Golden purr', weight: 1, lines: ['Golden purr! So rare!'], sound: 'sparkle', ms: 1400 },
];

/** Session-only reactions (not in the petting pool). */
export const SESSION_REACTIONS: Partial<Record<ReactionId, number>> = { r14: 1300 };

/** Weighted random reaction that never repeats the previous one. */
export function pickReaction(last: ReactionId | null, rand: () => number = Math.random): ReactionId {
  const pool = REACTIONS.filter((r) => r.id !== last);
  const total = pool.reduce((t, r) => t + r.weight, 0);
  let x = rand() * total;
  for (const r of pool) { x -= r.weight; if (x < 0) return r.id; }
  return pool[pool.length - 1].id;
}
