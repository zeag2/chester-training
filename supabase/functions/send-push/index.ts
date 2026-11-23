// PalDex: send push notifications. A Supabase Edge Function (Deno), called only by pg_cron (see
// supabase/migrations/20261123000000_push.sql) with the header `x-cron-key`:
//   {"mode":"drain"}  every minute while the outbox has unsent rows: send them with Web Push
//   {"mode":"meds"}   every hour at :05: queue today's medicine reminders for people whose medicine hour it is
// Secrets (Edge Functions → Secrets; never in the repo): PUSH_CRON_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (a mailto: address). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Deploy with JWT verification off (the cron sends its own key, not a sign-in):
//   supabase functions deploy send-push --no-verify-jwt
// The logic lives in core.ts (tested with Vitest); this file only connects it to the database and the network.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { drain, handle, MAX_TRIES, queueMeds, TTL_SECONDS, type OutboxRow, type PetMeds, type Prefs, type Subscription } from './core.ts';
import type { MedEntry } from '../_shared/meds.ts';

const env = (k: string) => Deno.env.get(k) ?? '';
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
/** The rows of a list query (never null). */
const rows = <T>(r: { data: T[] | null; error: { message: string } | null }): T[] => check(r) ?? [];

/** All rows of a query, 1000 at a time (PostgREST's page limit). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const got = check(await page(from, from + 999)) ?? [];
    out.push(...got); if (got.length < 1000) return out;
  }
}

const vapid = () => ({ subject: env('VAPID_SUBJECT'), publicKey: env('VAPID_PUBLIC_KEY'), privateKey: env('VAPID_PRIVATE_KEY') });

async function send(s: Subscription, payload: unknown, topic: string | undefined): Promise<number> {
  // web-push builds the encrypted request (VAPID JWT + aes128gcm); fetch sends it (no Node https needed on Deno)
  const r = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload),
    { vapidDetails: vapid(), TTL: TTL_SECONDS, ...(topic ? { topic } : {}), urgency: 'normal' });
  const res = await fetch(r.endpoint, { method: r.method, headers: r.headers as Record<string, string>, body: r.body, signal: AbortSignal.timeout(10_000) });
  await res.body?.cancel();
  return res.status;
}

const runDrain = () => {
  // without the VAPID secrets nothing can be sent: fail before touching the outbox, so no row loses a try
  const v = vapid();
  if (!v.subject || !v.publicKey || !v.privateKey) throw new Error('not set up (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)');
  return drainNow();
};
const drainNow = () => drain({
  unsent: async (limit) => rows(await sb.from('push_outbox').select('id, user_id, kind, title, body, url, tag, tries')
    .is('sent_at', null).lt('tries', MAX_TRIES).order('created_at').limit(limit)) as OutboxRow[],
  // one conditional update per tries value: a row another run already claimed no longer matches
  claim: async (want) => {
    const got: number[] = [];
    for (const t of new Set(want.map((r) => r.tries))) {
      const ids = want.filter((r) => r.tries === t).map((r) => r.id);
      const done = rows(await sb.from('push_outbox').update({ tries: t + 1 }).in('id', ids).eq('tries', t).is('sent_at', null).select('id')) as { id: number }[];
      got.push(...done.map((r) => r.id));
    }
    return got;
  },
  subscriptions: async (ids) => rows(await sb.from('push_subscriptions').select('endpoint, user_id, p256dh, auth').in('user_id', ids)) as Subscription[],
  send,
  markSent: async (ids) => { check(await sb.from('push_outbox').update({ sent_at: new Date().toISOString() }).in('id', ids)); },
  giveUp: async (ids) => { check(await sb.from('push_outbox').update({ tries: MAX_TRIES }).in('id', ids)); },
  deleteSubscriptions: async (eps) => { check(await sb.from('push_subscriptions').delete().in('endpoint', eps)); },
  log: (m) => console.log(m),
});

const runMeds = () => queueMeds({
  people: async () => {
    const subs = rows(await sb.from('push_subscriptions').select('user_id')) as { user_id: string }[];
    const ids = [...new Set(subs.map((s) => s.user_id))];
    if (!ids.length) return [];
    const prefs = rows(await sb.from('push_prefs').select('user_id, tz, meds, med_hour').in('user_id', ids)) as Prefs[];
    const by = new Map(prefs.map((p) => [p.user_id, p]));
    return ids.map((user_id) => ({ user_id, prefs: by.get(user_id) }));
  },
  petsOf: async (ids) => {
    // households (and pets from before households, still shared per pet)
    const hm = rows(await sb.from('household_members').select('household_id, user_id').in('user_id', ids)) as { household_id: string; user_id: string }[];
    const cm = rows(await sb.from('cat_members').select('cat_id, user_id').in('user_id', ids)) as { cat_id: string; user_id: string }[];
    const hids = [...new Set(hm.map((m) => m.household_id))];
    const cats = [
      ...(hids.length ? rows(await sb.from('cats').select('id, household_id, data').in('household_id', hids)) : []),
      ...(cm.length ? rows(await sb.from('cats').select('id, household_id, data').in('id', [...new Set(cm.map((m) => m.cat_id))]).is('household_id', null)) : []),
    ] as { id: string; household_id: string | null; data: { name?: string } }[];
    const catIds = [...new Set(cats.map((c) => c.id))];
    // every medicine entry (not just recent ones): a yearly vaccine's next-due date comes from last year's entry
    const meds = catIds.length ? await all((a, b) => sb.from('care').select('cat_id, kind, at, deleted, data').eq('kind', 'med').in('cat_id', catIds).order('id').range(a, b)) as (MedEntry & { cat_id: string })[] : [];
    const itemsOf = new Map<string, MedEntry[]>();
    for (const m of meds) itemsOf.set(m.cat_id, [...(itemsOf.get(m.cat_id) ?? []), { ...m, at: Number(m.at) }]);
    const pet = (c: (typeof cats)[number]): PetMeds => ({ catId: c.id, name: c.data?.name?.trim() || 'Your cat', items: itemsOf.get(c.id) ?? [] });
    const out = new Map<string, PetMeds[]>();
    for (const id of ids) {
      const mine = new Set([...hm.filter((m) => m.user_id === id).map((m) => m.household_id)]);
      const direct = new Set(cm.filter((m) => m.user_id === id).map((m) => m.cat_id));
      const seen = new Set<string>();
      out.set(id, cats.filter((c) => (c.household_id ? mine.has(c.household_id) : direct.has(c.id)) && !seen.has(c.id) && seen.add(c.id)).map(pet));
    }
    return out;
  },
  recent: async (ids) => {
    const since = new Date(Date.now() - 864e5).toISOString();
    const queued = rows(await sb.from('push_outbox').select('user_id, tag').in('user_id', ids).gt('created_at', since)) as { user_id: string; tag: string }[];
    const out = new Map<string, { tags: Set<string>; count: number }>();
    for (const r of queued) { const x = out.get(r.user_id) ?? { tags: new Set<string>(), count: 0 }; x.tags.add(r.tag); x.count++; out.set(r.user_id, x); }
    return out;
  },
  enqueue: async (add) => { check(await sb.from('push_outbox').insert(add)); },
});

Deno.serve(async (req) => {
  try {
    return await handle(req, { cronKey: Deno.env.get('PUSH_CRON_KEY'), drain: runDrain, meds: () => runMeds() });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
