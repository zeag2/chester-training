import { describe, it, expect, vi } from 'vitest';
import { drain, handle, hourIn, keyLoader, medsNotice, outcomeOf, payloadFor, queueMeds, sameKey, topicFor, MAX_TRIES,
  type DrainDeps, type MedsDeps, type OutboxRow, type Subscription } from './core.ts';
import type { MedEntry } from '../_shared/meds.ts';

const row = (id: number, user_id: string, extra: Partial<OutboxRow> = {}): OutboxRow =>
  ({ id, user_id, kind: 'friends', title: `t${id}`, body: 'b', url: '#/friends', tag: `tag-${id}`, tries: 0, ...extra });
const sub = (endpoint: string, user_id: string): Subscription => ({ endpoint: `https://push.example/${endpoint}`, user_id, p256dh: 'k', auth: 'a' });

/** A fake database + push service: `status` says what the push service answers for each endpoint. */
function fakeDrain(rows: OutboxRow[], subs: Subscription[], status: Record<string, number | Error>, claimed?: number[]) {
  const sent: number[] = [], gaveUp: number[] = [], deleted: string[] = [], calls: { endpoint: string; title: string; topic?: string }[] = [];
  const d: DrainDeps = {
    unsent: async (n) => rows.filter((r) => r.tries < MAX_TRIES).slice(0, n),
    claim: async (rs) => claimed ?? rs.map((r) => r.id),
    subscriptions: async (ids) => subs.filter((s) => ids.includes(s.user_id)),
    send: async (s, p, topic) => {
      calls.push({ endpoint: s.endpoint, title: p.title, topic });
      const k = s.endpoint.split('/').pop()!; const v = status[k] ?? 201;
      if (v instanceof Error) throw v; return v;
    },
    markSent: async (ids) => { sent.push(...ids); },
    giveUp: async (ids) => { gaveUp.push(...ids); },
    deleteSubscriptions: async (eps) => { deleted.push(...eps); },
  };
  return { d, sent, gaveUp, deleted, calls };
}

describe('drain', () => {
  it('201 → sent; 410 → the subscription is deleted; 500 → left to retry', async () => {
    const f = fakeDrain([row(1, 'a'), row(2, 'b'), row(3, 'c')], [sub('a1', 'a'), sub('b1', 'b'), sub('c1', 'c')], { b1: 410, c1: 500 });
    const r = await drain(f.d);
    expect(r).toEqual({ claimed: 3, sent: 1, retry: 1, dropped: 1, gone: 1 });
    expect(f.sent).toEqual([1]);
    expect(f.gaveUp).toEqual([2]);          // b has no phone left: don't keep trying
    expect(f.deleted).toEqual(['https://push.example/b1']);
  });

  it('sends to every phone of the person; one delivered is enough', async () => {
    const f = fakeDrain([row(1, 'a')], [sub('a1', 'a'), sub('a2', 'a'), sub('x', 'other')], { a2: 503 });
    expect(await drain(f.d)).toMatchObject({ sent: 1, retry: 0 });
    expect(f.calls.map((c) => c.endpoint)).toEqual(['https://push.example/a1', 'https://push.example/a2']);
  });

  it('a network error is a retry, not a crash', async () => {
    const f = fakeDrain([row(1, 'a')], [sub('a1', 'a')], { a1: new Error('timeout') });
    expect(await drain(f.d)).toMatchObject({ sent: 0, retry: 1, dropped: 0 });
    expect(f.gaveUp).toEqual([]);
  });

  it('nobody subscribed → given up without sending; a bad request (400) → given up too', async () => {
    const f = fakeDrain([row(1, 'nobody'), row(2, 'a')], [sub('a1', 'a')], { a1: 400 });
    expect(await drain(f.d)).toMatchObject({ dropped: 2, sent: 0 });
    expect(f.gaveUp.sort()).toEqual([1, 2]);
    expect(f.deleted).toEqual([]);
  });

  it('only sends rows this run claimed (another run got the rest)', async () => {
    const f = fakeDrain([row(1, 'a'), row(2, 'a')], [sub('a1', 'a')], {}, [2]);
    expect(await drain(f.d)).toMatchObject({ claimed: 1, sent: 1 });
    expect(f.calls.map((c) => c.title)).toEqual(['t2']);
  });

  it('nothing waiting: no claim, no sends', async () => {
    const f = fakeDrain([], [], {}); const claim = vi.spyOn(f.d, 'claim');
    expect(await drain(f.d)).toEqual({ claimed: 0, sent: 0, retry: 0, dropped: 0, gone: 0 });
    expect(claim).not.toHaveBeenCalled();
  });

  it('a gone phone is skipped for the person’s later rows in the same run', async () => {
    const f = fakeDrain([row(1, 'a'), row(2, 'a')], [sub('a1', 'a'), sub('a2', 'a')], { a1: 404 });
    await drain(f.d, 200, 1); // one at a time, so row 2 sees row 1's result
    expect(f.calls.map((c) => c.endpoint)).toEqual(['https://push.example/a1', 'https://push.example/a2', 'https://push.example/a2']);
    expect(f.sent).toEqual([1, 2]);
  });
});

describe('payload and headers', () => {
  it('the payload is only what the notification shows', () => {
    expect(payloadFor(row(7, 'a', { title: 'Erin wants to be friends', body: 'Say yes', url: '#/friends', tag: 'freq-x' })))
      .toEqual({ title: 'Erin wants to be friends', body: 'Say yes', url: '#/friends', tag: 'freq-x' });
  });
  it('topic: a stable ≤32-character URL-safe hash of the tag; none without a tag', async () => {
    const t = await topicFor('treat-00000000-0000-0000-0000-000000000020-cat_abc');
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(await topicFor('treat-00000000-0000-0000-0000-000000000020-cat_abc')).toBe(t);
    expect(await topicFor('other')).not.toBe(t);
    expect(await topicFor('')).toBeUndefined();
  });
  it('status codes', () => {
    expect([201, 200, 404, 410, 429, 500, 413, 403].map(outcomeOf)).toEqual(['sent', 'sent', 'gone', 'gone', 'retry', 'retry', 'failed', 'failed']);
  });
});

describe('the request', () => {
  const key = 'k'.repeat(32);
  const deps = { cronKey: async () => key as string | undefined, drain: vi.fn(async () => ({ claimed: 0, sent: 0, retry: 0, dropped: 0, gone: 0 })), meds: vi.fn(async () => ({ people: 0, queued: 0 })) };
  const req = (body: unknown, headers: Record<string, string> = { 'x-cron-key': key }, method = 'POST') =>
    new Request('https://x/functions/v1/send-push', { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined });

  it('needs the cron key', async () => {
    expect((await handle(req({ mode: 'drain' }, {}), deps)).status).toBe(403);
    expect((await handle(req({ mode: 'drain' }, { 'x-cron-key': 'k'.repeat(31) }), deps)).status).toBe(403);
    expect(deps.drain).not.toHaveBeenCalled();
    expect((await handle(req({ mode: 'drain' }), { ...deps, cronKey: async () => undefined })).status).toBe(503);
    expect((await handle(req(null, {}, 'GET'), deps)).status).toBe(405);
  });
  it('runs the mode asked for', async () => {
    expect((await handle(req({ mode: 'drain' }), deps)).status).toBe(200);
    expect(deps.drain).toHaveBeenCalledTimes(1);
    expect(await (await handle(req({ mode: 'meds' }), deps)).json()).toEqual({ people: 0, queued: 0 });
    expect((await handle(req({ mode: 'spam' }), deps)).status).toBe(400);
  });
  it('checks the key from Vault the same way (a wrong or short key is refused; none: not set up)', async () => {
    const vault = vi.fn(async () => ({ cronKey: key }));
    const keys = keyLoader(() => ({}), vault);
    const d = { ...deps, cronKey: async () => (await keys()).cronKey };
    expect((await handle(req({ mode: 'drain' }, { 'x-cron-key': 'nope'.repeat(8) }), d)).status).toBe(403);
    expect((await handle(req({ mode: 'meds' }), d)).status).toBe(200);
    const none = keyLoader(() => ({}), async () => null);
    expect((await handle(req({ mode: 'drain' }), { ...deps, cronKey: async () => (await none()).cronKey })).status).toBe(503);
  });
  it('compares keys in constant time, and correctly', () => {
    expect(sameKey('abc', 'abc')).toBe(true);
    expect(sameKey('abc', 'abd')).toBe(false);
    expect(sameKey('abc', 'abcd')).toBe(false);
    expect(sameKey('', 'a')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------

const NY = 'America/New_York';
const med = (name: string, at: number, extra: Partial<MedEntry['data']> = {}): MedEntry => ({ kind: 'med', at, data: { name, what: 'medicine', ...extra } });
/** 2026-11-24 at hh:05 in New York (EST, UTC-5). */
const ny = (hh: number, day = '2026-11-24') => Date.parse(`${day}T${String(hh).padStart(2, '0')}:05:00-05:00`);

describe('medicine notifications', () => {
  it('one medicine: its name in the title, the Home card’s words below', () => {
    expect(medsNotice('Chester', [med('Revolution', ny(9, '2026-10-24'), { what: 'flea', nextDue: '2026-11-24' })], ny(9), NY))
      .toEqual({ title: 'Chester: Revolution due', body: 'Due today' });
    expect(medsNotice('Chester', [med('Clavamox', ny(8, '2026-11-20'), { course: { times: 2, until: '2026-11-25' } })], ny(9), NY))
      .toEqual({ title: 'Chester: Clavamox due', body: '0 of 2 today · until Nov 25' });
  });
  it('several: a count, and their names', () => {
    const items = [med('Revolution', ny(9, '2026-10-20'), { nextDue: '2026-11-22' }), med('Clavamox', ny(8, '2026-11-20'), { course: { times: 2, until: '2026-11-25' } })];
    expect(medsNotice('Mochi', items, ny(9), NY)).toEqual({ title: 'Mochi: 2 medicines due', body: 'Revolution, Clavamox' });
  });
  it('nothing due: nothing', () => {
    expect(medsNotice('Chester', [med('Revolution', ny(9), { nextDue: '2026-12-24' })], ny(10), NY)).toBeNull();
    expect(medsNotice('Chester', [], ny(9), NY)).toBeNull();
  });
  it('"today" is the person’s day, not the server’s (UTC)', () => {
    // 8 PM on Nov 23 in New York is already Nov 24 in UTC: not due yet there
    const items = [med('Revolution', ny(9, '2026-10-24'), { nextDue: '2026-11-24' })];
    expect(medsNotice('Chester', items, ny(20, '2026-11-23'), NY)).toBeNull();
    expect(medsNotice('Chester', items, ny(20, '2026-11-23'), 'UTC')).not.toBeNull();
  });
  it('hour in a time zone; an unknown zone is null', () => {
    expect(hourIn(ny(9), NY)).toBe(9);
    expect(hourIn(ny(9), 'UTC')).toBe(14);
    expect(hourIn(ny(0), NY)).toBe(0);
    expect(hourIn(ny(9), 'Not/AZone')).toBeNull();
  });

  function fakeMeds(people: Awaited<ReturnType<MedsDeps['people']>>, pets: Record<string, { catId: string; name: string; items: MedEntry[] }[]>, recent: Record<string, string[]> = {}) {
    const queued: Parameters<MedsDeps['enqueue']>[0] = [];
    const d: MedsDeps = {
      people: async () => people,
      petsOf: async (ids) => new Map(ids.map((id) => [id, pets[id] ?? []])),
      recent: async (ids) => new Map(ids.map((id) => [id, { tags: new Set(recent[id] ?? []), count: (recent[id] ?? []).length }])),
      enqueue: async (rows) => { queued.push(...rows); },
    };
    return { d, queued };
  }
  const chester = { catId: 'cat1', name: 'Chester', items: [med('Revolution', ny(9, '2026-10-24'), { nextDue: '2026-11-24' })] };

  it('at each person’s own hour, in their own zone; one per pet; opens Home', async () => {
    const f = fakeMeds([
      { user_id: 'josh', prefs: { user_id: 'josh', tz: NY, meds: true, med_hour: 9 } },
      { user_id: 'megan', prefs: { user_id: 'megan', tz: NY, meds: true, med_hour: 8 } },   // not her hour
      { user_id: 'erin', prefs: { user_id: 'erin', tz: 'UTC', meds: true, med_hour: 14 } }, // 9 AM NY = 14 UTC
      { user_id: 'off', prefs: { user_id: 'off', tz: NY, meds: false, med_hour: 9 } },
      { user_id: 'noprefs' },                                                              // defaults: NY, 9
    ], { josh: [chester, { catId: 'cat2', name: 'Mochi', items: [] }], megan: [chester], erin: [chester], off: [chester], noprefs: [chester] });
    expect(await queueMeds(f.d, ny(9))).toEqual({ people: 3, queued: 3 });
    expect(f.queued.map((r) => r.user_id)).toEqual(['josh', 'erin', 'noprefs']);
    expect(f.queued[0]).toEqual({ user_id: 'josh', kind: 'meds', title: 'Chester: Revolution due', body: 'Due today', url: '#/', tag: 'meds-cat1-2026-11-24' });
  });
  it('run twice in the same hour: not twice', async () => {
    const f = fakeMeds([{ user_id: 'josh' }], { josh: [chester] }, { josh: ['meds-cat1-2026-11-24'] });
    expect(await queueMeds(f.d, ny(9))).toEqual({ people: 1, queued: 0 });
  });
  it('the daily cap of 20 holds', async () => {
    const f = fakeMeds([{ user_id: 'josh' }], { josh: [chester] }, { josh: Array.from({ length: 20 }, (_, i) => 'x' + i) });
    expect((await queueMeds(f.d, ny(9))).queued).toBe(0);
  });
  it('nobody at their hour: no database reads beyond the people', async () => {
    const f = fakeMeds([{ user_id: 'josh' }], {}); const pets = vi.spyOn(f.d, 'petsOf');
    expect(await queueMeds(f.d, ny(3))).toEqual({ people: 0, queued: 0 });
    expect(pets).not.toHaveBeenCalled();
  });
});

describe('keys: env first, then Vault', () => {
  const all = { cronKey: 'c'.repeat(32), publicKey: 'pub', privateKey: 'priv', subject: 'https://paldex.example/' };

  it('all four in env: Vault is never asked', async () => {
    const vault = vi.fn(async () => ({ cronKey: 'other' }));
    expect(await keyLoader(() => all, vault)()).toEqual(all);
    expect(vault).not.toHaveBeenCalled();
  });
  it('none in env: all four from Vault, read once per instance', async () => {
    const vault = vi.fn(async () => all);
    const keys = keyLoader(() => ({ cronKey: '', publicKey: '', privateKey: '', subject: '' }), vault);
    expect(await keys()).toEqual(all);
    expect(await keys()).toEqual(all);
    expect(vault).toHaveBeenCalledTimes(1);
  });
  it('env wins per key; only the gaps come from Vault', async () => {
    const keys = keyLoader(() => ({ cronKey: 'e'.repeat(32), publicKey: '' }), async () => ({ ...all, cronKey: 'v'.repeat(32) }));
    expect(await keys()).toEqual({ ...all, cronKey: 'e'.repeat(32) });
  });
  it('requests at the same moment share one Vault read', async () => {
    const vault = vi.fn(async () => all);
    const keys = keyLoader(() => ({}), vault);
    await Promise.all([keys(), keys(), keys()]);
    expect(vault).toHaveBeenCalledTimes(1);
  });
  it('a missing secret in Vault: empty, and asked again next time (added later, no redeploy)', async () => {
    const vault = vi.fn().mockResolvedValueOnce({ ...all, privateKey: null }).mockResolvedValue(all);
    const keys = keyLoader(() => ({}), vault);
    expect((await keys()).privateKey).toBe('');
    expect(await keys()).toEqual(all);
    expect(await keys()).toEqual(all);
    expect(vault).toHaveBeenCalledTimes(2);
  });
  it('Vault read fails: logged, keys empty (never throws), tried again next time', async () => {
    const log = vi.fn();
    const vault = vi.fn().mockRejectedValueOnce(new Error('permission denied')).mockResolvedValue(all);
    const keys = keyLoader(() => ({}), vault, log);
    expect(await keys()).toEqual({ cronKey: '', publicKey: '', privateKey: '', subject: '' });
    expect(log).toHaveBeenCalledWith('keys from Vault: permission denied');
    expect(await keys()).toEqual(all);
  });
  it('a key removed from env later is filled from Vault', async () => {
    const env: Record<string, string> = { ...all };
    const vault = vi.fn(async () => ({ ...all, privateKey: 'vault-priv' }));
    const keys = keyLoader(() => env, vault);
    expect((await keys()).privateKey).toBe('priv');
    delete env.privateKey;
    expect((await keys()).privateKey).toBe('vault-priv');
  });
});
