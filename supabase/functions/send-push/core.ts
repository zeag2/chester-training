/* The send-push Edge Function's logic, with the database and the network passed in, so Vitest can run it without
   Deno, Supabase or a real push service (see core.test.ts). `index.ts` wires it to supabase-js and web-push.
   Plan: docs/plans/2026-11-23-push-notifications.md. */
import { dayIn, dueLine, medsDue, type MedEntry } from '../_shared/meds.ts';

export type Kind = 'friends' | 'treats' | 'photos' | 'meds';
/** A row of public.push_outbox. */
export interface OutboxRow { id: number; user_id: string; kind: Kind; title: string; body: string; url: string; tag: string; tries: number }
/** A row of public.push_subscriptions (one phone or browser). */
export interface Subscription { endpoint: string; user_id: string; p256dh: string; auth: string }
/** What the service worker gets (`public/push-sw.js`); Web Push encrypts it end to end. */
export interface Payload { title: string; body: string; url: string; tag: string }

export const MAX_TRIES = 3;
export const BATCH = 200;
export const TTL_SECONDS = 12 * 60 * 60;
export const DAILY_CAP = 20;

export const payloadFor = (r: Pick<OutboxRow, 'title' | 'body' | 'url' | 'tag'>): Payload => ({ title: r.title, body: r.body, url: r.url, tag: r.tag });

/** Web Push `Topic` header for a tag: at most 32 URL-safe characters (RFC 8030 §5.4), so a hash of it. A newer push
    with the same topic replaces one the phone hasn't fetched yet. Empty tag: no topic. */
export async function topicFor(tag: string): Promise<string | undefined> {
  if (!tag) return undefined;
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tag)));
  let s = ''; for (const b of h) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 32);
}

/** What happened when sending to one subscription. */
export type SendOutcome = 'sent' | 'gone' | 'retry' | 'failed';
/** Push service status → outcome: 2xx delivered; 404/410 the phone dropped it (delete it); 408/429/5xx try again
    later; any other 4xx (bad key, too big) won't get better by retrying. */
export function outcomeOf(status: number): SendOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'gone';
  if (status === 408 || status === 429 || status >= 500) return 'retry';
  return 'failed';
}

export interface DrainDeps {
  /** Unsent rows with tries < MAX_TRIES, oldest first. */
  unsent(limit: number): Promise<OutboxRow[]>;
  /** Claim rows (tries + 1) only if no one else has: returns the ids this run got. Two overlapping runs can't both
      send the same row. */
  claim(rows: OutboxRow[]): Promise<number[]>;
  subscriptions(userIds: string[]): Promise<Subscription[]>;
  /** Send one encrypted push; resolves to the push service's HTTP status (throws on a network error). */
  send(sub: Subscription, payload: Payload, topic: string | undefined): Promise<number>;
  markSent(ids: number[]): Promise<void>;
  /** Give up on these rows (no phone left, or a permanent error): tries = MAX_TRIES, so the cron stops calling. */
  giveUp(ids: number[]): Promise<void>;
  deleteSubscriptions(endpoints: string[]): Promise<void>;
  log?(msg: string): void;
}

export interface DrainResult { claimed: number; sent: number; retry: number; dropped: number; gone: number }

/** Send what's waiting. Per row: delivered to at least one of the person's phones → sent; else if any phone had a
    passing problem → left for the next run (its tries were already counted by the claim); else (no phones, or all
    gone or refused for good) → given up. */
export async function drain(d: DrainDeps, limit = BATCH, parallel = 8): Promise<DrainResult> {
  const rows = await d.unsent(limit);
  const res: DrainResult = { claimed: 0, sent: 0, retry: 0, dropped: 0, gone: 0 };
  if (!rows.length) return res;
  const mine = new Set(await d.claim(rows));
  const todo = rows.filter((r) => mine.has(r.id));
  res.claimed = todo.length;
  if (!todo.length) return res;

  const subs = await d.subscriptions([...new Set(todo.map((r) => r.user_id))]);
  const byUser = new Map<string, Subscription[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  const gone = new Set<string>(); const sent: number[] = []; const dead: number[] = [];
  const one = async (r: OutboxRow) => {
    const phones = (byUser.get(r.user_id) ?? []).filter((s) => !gone.has(s.endpoint));
    const payload = payloadFor(r); const topic = await topicFor(r.tag);
    const outs = await Promise.all(phones.map(async (s): Promise<SendOutcome> => {
      let o: SendOutcome;
      try { o = outcomeOf(await d.send(s, payload, topic)); } catch (e) { d.log?.(`push ${r.id}: ${(e as Error).message}`); o = 'retry'; }
      if (o === 'gone') gone.add(s.endpoint);
      if (o === 'failed' || o === 'retry') d.log?.(`push ${r.id} → ${new URL(s.endpoint).host}: ${o}`);
      return o;
    }));
    if (outs.includes('sent')) sent.push(r.id);
    else if (outs.includes('retry')) res.retry++; // the claim already counted this try; at MAX_TRIES it stops
    else dead.push(r.id);
  };
  for (let i = 0; i < todo.length; i += parallel) await Promise.all(todo.slice(i, i + parallel).map(one));

  if (sent.length) await d.markSent(sent);
  if (dead.length) await d.giveUp(dead);
  if (gone.size) await d.deleteSubscriptions([...gone]);
  res.sent = sent.length; res.dropped = dead.length; res.gone = gone.size;
  return res;
}

// ---------------------------------------------------------------------------------------------------------------
// medicine reminders: once a day, at each person's medicine hour
// ---------------------------------------------------------------------------------------------------------------

export interface Prefs { user_id: string; tz: string; meds: boolean; med_hour: number }
/** Someone who allowed notifications but whose prefs row is missing gets the table's defaults. */
export const DEFAULT_PREFS: Omit<Prefs, 'user_id'> = { tz: 'America/New_York', meds: true, med_hour: 9 };

/** The hour (0–23) it is now in a time zone; null for a zone this runtime doesn't know. */
export function hourIn(now: number, tz: string): number | null {
  try {
    const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(now));
    return Number(h) % 24;
  } catch { return null; }
}

export interface PetMeds { catId: string; name: string; items: MedEntry[] }
export interface MedsDeps {
  /** Everyone with at least one phone subscribed, with their prefs (or none yet). */
  people(): Promise<{ user_id: string; prefs?: Prefs }[]>;
  /** The pets each person lives with (their households, plus older per-pet sharing), with their medicine entries. */
  petsOf(userIds: string[]): Promise<Map<string, PetMeds[]>>;
  /** Tags already queued for each person in the last day, and how many they got (for the dedupe and the daily cap). */
  recent(userIds: string[]): Promise<Map<string, { tags: Set<string>; count: number }>>;
  enqueue(rows: Omit<OutboxRow, 'id' | 'tries'>[]): Promise<void>;
}

/** The notification for one pet's medicine due today, or null when nothing is. */
export function medsNotice(pet: string, items: readonly MedEntry[], now: number, tz: string): { title: string; body: string } | null {
  const due = medsDue(items, now, tz);
  if (!due.length) return null;
  if (due.length === 1) return { title: `${pet}: ${due[0].name} due`.slice(0, 80), body: dueLine(due[0]).slice(0, 160) };
  return { title: `${pet}: ${due.length} medicines due`.slice(0, 80), body: due.map((d) => d.name).join(', ').slice(0, 160) };
}

/** Queue today's medicine notifications for everyone whose medicine hour it is now. Run at :05 every hour. */
export async function queueMeds(d: MedsDeps, now = Date.now()): Promise<{ people: number; queued: number }> {
  const due = (await d.people()).map((p) => ({ user_id: p.user_id, ...DEFAULT_PREFS, ...p.prefs }))
    .filter((p) => p.meds && hourIn(now, p.tz) === p.med_hour);
  if (!due.length) return { people: 0, queued: 0 };
  const ids = due.map((p) => p.user_id);
  const [pets, recent] = await Promise.all([d.petsOf(ids), d.recent(ids)]);
  const rows: Omit<OutboxRow, 'id' | 'tries'>[] = [];
  for (const p of due) {
    const r = recent.get(p.user_id) ?? { tags: new Set<string>(), count: 0 };
    for (const pet of pets.get(p.user_id) ?? []) {
      const n = medsNotice(pet.name, pet.items, now, p.tz); if (!n) continue;
      const tag = `meds-${pet.catId}-${dayIn(now, p.tz)}`.slice(0, 100);
      if (r.tags.has(tag) || r.count >= DAILY_CAP) continue;
      r.tags.add(tag); r.count++;
      rows.push({ user_id: p.user_id, kind: 'meds', title: n.title, body: n.body, url: '#/', tag });
    }
  }
  if (rows.length) await d.enqueue(rows);
  return { people: due.length, queued: rows.length };
}

// ---------------------------------------------------------------------------------------------------------------
// the request: only the cron (or the PM testing by hand) with the shared key
// ---------------------------------------------------------------------------------------------------------------

/** Constant-time string compare, so the key can't be guessed a character at a time. */
export function sameKey(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export interface HandlerDeps { cronKey: string | undefined; drain(): Promise<DrainResult>; meds(): Promise<{ people: number; queued: number }> }
export async function handle(req: Request, d: HandlerDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!d.cronKey || d.cronKey.length < 16) return json({ error: 'not set up (PUSH_CRON_KEY)' }, 503);
  if (!sameKey(req.headers.get('x-cron-key') ?? '', d.cronKey)) return json({ error: 'forbidden' }, 403);
  let mode: unknown;
  try { mode = ((await req.json()) as { mode?: unknown }).mode; } catch { return json({ error: 'bad body' }, 400); }
  if (mode === 'drain') return json(await d.drain());
  if (mode === 'meds') return json(await d.meds());
  return json({ error: 'mode must be "drain" or "meds"' }, 400);
}
