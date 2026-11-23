// End-to-end check of supabase/functions/send-push/index.ts: the real function in Deno, against PostgREST + a local
// Postgres 16 with every migration, sending to a fake HTTPS push service that decrypts what it gets.
import ece from 'npm:http_ece@1.2.0';
import webpush from 'npm:web-push@3.6.7';
import { createECDH, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';

const DIR = Deno.env.get('E2E_TMP') ?? '/tmp/send-push-e2e/';
const REPO = new URL('../../..', import.meta.url).pathname;
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const psql = async (sql: string) => {
  const o = await new Deno.Command('psql', { args: ['-h', '/tmp/pgx', '-p', '5499', '-U', 'postgres', '-d', 't', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql] }).output();
  if (!o.success) throw new Error(new TextDecoder().decode(o.stderr));
  return new TextDecoder().decode(o.stdout).trim();
};
let fails = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${what}`); if (!cond) fails++; };

// --- people and phones ------------------------------------------------------------------------------------------
const JOSH = '00000000-0000-0000-0000-0000000000a1', MEGAN = '00000000-0000-0000-0000-0000000000a2', ERIN = '00000000-0000-0000-0000-0000000000a3';
const phones: Record<string, { ecdh: ReturnType<typeof createECDH>; auth: Buffer; user: string; status: number }> = {};
for (const [name, user, status] of [['josh-phone', JOSH, 201], ['josh-old', JOSH, 410], ['megan', MEGAN, 201], ['erin', ERIN, 500]] as const) {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys(); phones[name] = { ecdh, auth: randomBytes(16), user, status };
}
const got: { phone: string; payload: Record<string, string>; headers: Record<string, string> }[] = [];
const push = Deno.serve({ port: 8443, cert: Deno.readTextFileSync(DIR + 'cert.pem'), key: Deno.readTextFileSync(DIR + 'key.pem'), onListen() {} }, async (req) => {
  const phone = new URL(req.url).pathname.slice(1); const p = phones[phone];
  if (!p) return new Response(null, { status: 404 });
  const body = Buffer.from(await req.arrayBuffer());
  if (p.status === 201) {
    const plain = ece.decrypt(body, { version: 'aes128gcm', privateKey: p.ecdh, authSecret: p.auth });
    got.push({ phone, payload: JSON.parse(new TextDecoder().decode(plain)), headers: Object.fromEntries(req.headers) });
  }
  return new Response(null, { status: p.status });
});

// PostgREST serves at /, supabase-js calls /rest/v1/…
const proxy = Deno.serve({ port: 54321, onListen() {} }, (req) => {
  const u = new URL(req.url); u.host = '127.0.0.1:3000'; u.protocol = 'http:'; u.pathname = u.pathname.replace(/^\/rest\/v1/, '');
  return fetch(u, { method: req.method, headers: req.headers, body: req.body });
});

const vapid = webpush.generateVAPIDKeys();
const KEY = 'cron-key-' + b64u(randomBytes(24));
Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', Deno.readTextFileSync(DIR + 'service.jwt').trim());
Deno.env.set('PUSH_CRON_KEY', KEY);
Deno.env.set('VAPID_PUBLIC_KEY', vapid.publicKey); Deno.env.set('VAPID_PRIVATE_KEY', vapid.privateKey); Deno.env.set('VAPID_SUBJECT', 'mailto:test@example.com');
await import(REPO + '/supabase/functions/send-push/index.ts'); // Deno.serve on :8000
const call = async (mode: unknown, key = KEY) => {
  const r = await fetch('http://127.0.0.1:8000/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-key': key }, body: JSON.stringify({ mode }) });
  return { status: r.status, body: await r.json() };
};

// --- data: Josh and Megan share Chester; Erin is Josh's friend --------------------------------------------------
const hour = new Date().getUTCHours();
const today = new Date().toISOString().slice(0, 10);
await psql(`
  insert into auth.users (id) values ('${JOSH}'), ('${MEGAN}'), ('${ERIN}');
  insert into public.friend_profiles (user_id, display_name) values ('${JOSH}', 'Josh'), ('${MEGAN}', 'Megan'), ('${ERIN}', 'Erin');
  insert into public.households (id, created_by) values ('11111111-1111-1111-1111-111111111111', '${JOSH}');
  insert into public.household_members (household_id, user_id) values ('11111111-1111-1111-1111-111111111111', '${MEGAN}') on conflict do nothing;
  insert into public.cats (id, data, created_by, household_id) values ('chester', '{"name":"Chester"}', '${JOSH}', '11111111-1111-1111-1111-111111111111');
  insert into public.care (id, cat_id, kind, at, updated_at, data) values
    ('m1', 'chester', 'med', ${Date.now() - 30 * 864e5}, ${Date.now()}, '{"name":"Revolution","what":"flea","nextDue":"${today}"}'),
    ('m0', 'chester', 'med', ${Date.now() - 400 * 864e5}, ${Date.now()}, '{"name":"FVRCP","what":"vaccine","nextDue":"${today}"}');
  insert into public.push_prefs (user_id, tz, quiet_from, quiet_to, med_hour) values
    ('${JOSH}', 'UTC', 0, 0, ${hour}), ('${MEGAN}', 'UTC', 0, 0, ${(hour + 1) % 24}), ('${ERIN}', 'UTC', 0, 0, ${hour});
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
    ${Object.entries(phones).map(([n, p]) => `('https://127.0.0.1:8443/${n}', '${p.user}', '${b64u(p.ecdh.getPublicKey())}', '${b64u(p.auth)}')`).join(',\n    ')};
`);

// --- the checks --------------------------------------------------------------------------------------------------
ok((await call('drain', 'wrong-key-wrong-key')).status === 403, 'a wrong key is refused');
ok((await call('nope')).status === 400, 'an unknown mode is refused');

// a friend request from Erin to Josh, and Erin's treat for Chester (→ Josh and Megan)
await psql(`insert into public.friend_requests (from_user, to_user) values ('${ERIN}', '${JOSH}');
  insert into public.friend_treats (from_user, cat_id, day) values ('${ERIN}', 'chester', current_date);`);
ok(await psql(`select count(*) from public.push_outbox where sent_at is null`) === '3', 'triggers queued 3 (request → Josh, treat → Josh + Megan)');

const meds = await call('meds');
ok(meds.status === 200 && meds.body.people === 2 && meds.body.queued === 1, `meds: Josh's hour (Megan's is next hour; Erin has no pets) → ${JSON.stringify(meds.body)}`);
ok(await psql(`select title || ' | ' || body || ' | ' || url from public.push_outbox where kind = 'meds'`) === 'Chester: 2 medicines due | FVRCP, Revolution | #/',
  'the 400-day-old vaccine entry counts (all medicine entries are read)');
ok((await call('meds')).body.queued === 0, 'meds again in the same hour: nothing new');

// Erin's own phone fails (500): add a row for her so we see a retry
await psql(`insert into public.push_outbox (user_id, kind, title, url, tag) values ('${ERIN}', 'friends', 'Retry me', '#/friends', 'r1')`);
const d1 = await call('drain');
console.log('drain 1:', JSON.stringify(d1.body));
ok(d1.body.claimed === 5 && d1.body.sent === 4 && d1.body.retry === 1 && d1.body.gone === 1, 'drain: 4 sent, Erin left to retry, Josh’s old phone gone');
ok(await psql(`select count(*) from public.push_subscriptions where endpoint like '%josh-old'`) === '0', 'the 410 phone was deleted');
ok(got.filter((g) => g.phone === 'josh-phone').map((g) => g.payload.title).sort().join(' / ') === 'Chester: 2 medicines due / Erin gave Chester a treat / Erin wants to be friends',
  'Josh’s phone got the request, the treat and the medicine, decrypted');
ok(got.filter((g) => g.phone === 'megan').map((g) => g.payload.title).join() === 'Erin gave Chester a treat', 'Megan got the treat');
const h = got[0].headers;
ok(h.ttl === '43200' && /^[A-Za-z0-9_-]{32}$/.test(h.topic) && h['content-encoding'] === 'aes128gcm' && /^vapid t=/.test(h.authorization), 'headers: TTL 12 h, a 32-char Topic, aes128gcm, VAPID');
const tr = got.find((g) => g.payload.title.includes('treat'))!.payload;
ok(tr.url === '#/friends' && tr.tag.startsWith('treat-') && tr.body === 'Say thanks from the Friends tab.', 'payload {title, body, url, tag}');

const d2 = await call('drain'); const d3 = await call('drain'); const d4 = await call('drain');
console.log('drain 2–4:', JSON.stringify([d2.body, d3.body, d4.body]));
ok(await psql(`select tries || ',' || (sent_at is null) from public.push_outbox where tag = 'r1'`) === '3,true', 'a row that keeps failing stops at 3 tries');
ok(d4.body.claimed === 0, 'then nothing is left to do');
ok(await psql(`select count(*) from public.push_outbox where sent_at is null and tries < 3`) === '0', 'the outbox is empty, so the cron stops calling');

// two overlapping runs (a slow minute): each row goes out once
const before = got.length;
await psql(`insert into public.push_outbox (user_id, kind, title, url, tag) select '${MEGAN}', 'photos', 'Photo ' || g, '#/feed', 'p' || g from generate_series(1, 30) g`);
const [ra, rb] = await Promise.all([call('drain'), call('drain')]);
console.log('overlap:', JSON.stringify([ra.body, rb.body]));
ok(got.length - before === 30 && new Set(got.slice(before).map((g) => g.payload.title)).size === 30 && ra.body.claimed + rb.body.claimed === 30, 'two drains at once: 30 rows, 30 pushes, none twice');

// a missing secret: nothing touched
Deno.env.delete('VAPID_PRIVATE_KEY');
await psql(`insert into public.push_outbox (user_id, kind, title, url, tag) values ('${JOSH}', 'friends', 'Later', '#/friends', 'l1')`);
ok((await call('drain')).status === 500 && await psql(`select tries from public.push_outbox where tag = 'l1'`) === '0', 'without VAPID secrets: an error and no try lost');

await push.shutdown(); await proxy.shutdown();
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
Deno.exit(fails ? 1 : 0);
