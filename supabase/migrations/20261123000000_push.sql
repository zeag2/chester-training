-- PalDex push notifications, part 1 of the plan in docs/plans/2026-11-23-push-notifications.md.
-- Builds on bundle part 3 (public.push_subscriptions + save_push_subscription, run 2026-11-13). Idempotent: safe to
-- run twice. Nothing is sent until the `send-push` Edge Function is deployed with its VAPID secrets, the Vault secret
-- `push_cron_key` exists, and the app asks someone for permission.
--
-- What it adds:
--   push_prefs      one row per person: which kinds they want, their time zone, the medicine reminder hour, quiet hours
--   push_outbox     what's waiting to be sent (service role only; the Edge Function drains it)
--   private.enqueue_push(...)   checks prefs, quiet hours, a per-tag dedupe and a daily cap, then queues
--   triggers        a friend request, a friend's treat for my pet, a friend's new photo
--   cron            every minute: drain the outbox; every hour at :05: medicine reminders (both call send-push)

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------------------------------------------
-- prefs: everything on by default once someone allows notifications on a phone; they turn kinds off in Settings
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.push_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  tz text not null default 'America/New_York' check (length(tz) <= 64),
  friends boolean not null default true,      -- friend requests
  treats boolean not null default true,       -- a friend gave my pet a treat
  photos boolean not null default true,       -- a friend posted a photo
  meds boolean not null default true,         -- medicine due today
  med_hour smallint not null default 9 check (med_hour between 0 and 23),
  quiet_from smallint not null default 21 check (quiet_from between 0 and 23),
  quiet_to smallint not null default 8 check (quiet_to between 0 and 23),
  updated_at timestamptz not null default now()
);
alter table public.push_prefs enable row level security;
revoke all on public.push_prefs from public, anon, authenticated;
grant select, insert, update on public.push_prefs to authenticated;
drop policy if exists "my push prefs" on public.push_prefs;
drop policy if exists "add my push prefs" on public.push_prefs;
drop policy if exists "change my push prefs" on public.push_prefs;
create policy "my push prefs" on public.push_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy "add my push prefs" on public.push_prefs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "change my push prefs" on public.push_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------------
-- outbox: no one but the service role reads or writes it
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('friends', 'treats', 'photos', 'meds')),
  title text not null check (length(title) <= 80),
  body text not null default '' check (length(body) <= 160),
  url text not null default '#/' check (url like '#/%' and length(url) <= 200),  -- a hash route in the app
  tag text not null default '' check (length(tag) <= 100),                       -- same tag replaces on the phone
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  tries smallint not null default 0
);
create index if not exists push_outbox_unsent_idx on public.push_outbox (created_at) where sent_at is null;
create index if not exists push_outbox_user_idx on public.push_outbox (user_id, created_at);
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from public, anon, authenticated;

-- queue one notification for one person, if they want it. Returns whether it was queued.
create or replace function private.enqueue_push(who uuid, k text, t text, b text, u text, g text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare p public.push_prefs; h int;
begin
  if who is null or not exists (select 1 from public.push_subscriptions s where s.user_id = who) then return false; end if;
  select * into p from public.push_prefs where user_id = who;
  if found then
    if (k = 'friends' and not p.friends) or (k = 'treats' and not p.treats) or (k = 'photos' and not p.photos)
       or (k = 'meds' and not p.meds) then return false; end if;
    -- quiet hours (medicine reminders go at the hour the person picked, so they're exempt)
    h := extract(hour from now() at time zone p.tz);
    if k <> 'meds' and (case when p.quiet_from > p.quiet_to then h >= p.quiet_from or h < p.quiet_to
                             else h >= p.quiet_from and h < p.quiet_to end) then return false; end if;
  end if;
  -- the same thing twice within 10 minutes (a re-sent treat, an edited photo) is one notification
  if g <> '' and exists (select 1 from public.push_outbox o where o.user_id = who and o.tag = g
                         and o.created_at > now() - interval '10 minutes') then return false; end if;
  -- never more than 20 a day for one person
  if (select count(*) from public.push_outbox o where o.user_id = who and o.created_at > now() - interval '1 day') >= 20
    then return false; end if;
  insert into public.push_outbox (user_id, kind, title, body, url, tag)
    values (who, k, left(t, 80), left(coalesce(b, ''), 160), u, left(coalesce(g, ''), 100));
  return true;
end $$;
revoke all on function private.enqueue_push(uuid, text, text, text, text, text) from public, anon, authenticated;

create or replace function private.person_name(who uuid) returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif((select display_name from public.friend_profiles where user_id = who), ''), 'A friend') $$;
revoke all on function private.person_name(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- triggers (after insert; a failure here must never block the insert itself)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function private.push_on_friend_request() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform private.enqueue_push(new.to_user, 'friends', private.person_name(new.from_user) || ' wants to be friends',
      'Say yes to see each other''s cats.', '#/friends', 'freq-' || new.from_user);
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists push_friend_request on public.friend_requests;
create trigger push_friend_request after insert on public.friend_requests
  for each row execute function private.push_on_friend_request();

-- a treat for my pet: everyone in the pet's household but the giver
create or replace function private.push_on_friend_treat() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare pet text; m record;
begin
  begin
    select coalesce(nullif(k.data->>'name', ''), 'your cat') into pet from public.cats k where k.id = new.cat_id;
    for m in select hm.user_id from public.cats k join public.household_members hm on hm.household_id = k.household_id
             where k.id = new.cat_id and hm.user_id <> new.from_user loop
      perform private.enqueue_push(m.user_id, 'treats', private.person_name(new.from_user) || ' gave ' || pet || ' a treat',
        'Say thanks from the Friends tab.', '#/friends', 'treat-' || new.from_user || '-' || new.cat_id);
    end loop;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists push_friend_treat on public.friend_treats;
create trigger push_friend_treat after insert on public.friend_treats
  for each row execute function private.push_on_friend_treat();

-- a new photo: friends of anyone in the pet's household (the same people private.can_see_pet lets in), not the
-- household itself (they live with the cat), not the poster
create or replace function private.push_on_pet_photo() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare pet text; m record;
begin
  begin
    select coalesce(nullif(k.data->>'name', ''), 'their cat') into pet from public.cats k where k.id = new.cat_id;
    for m in select distinct f.user_id from public.cats k
               join public.household_members hm on hm.household_id = k.household_id
               join public.friends f on f.friend_id = hm.user_id
             where k.id = new.cat_id and f.user_id <> new.by_user
               and not exists (select 1 from public.household_members me
                               where me.household_id = k.household_id and me.user_id = f.user_id) loop
      perform private.enqueue_push(m.user_id, 'photos', private.person_name(new.by_user) || ' posted ' || pet,
        left(new.caption, 160), '#/feed', 'photo-' || new.by_user);
    end loop;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists push_pet_photo on public.pet_photos;
create trigger push_pet_photo after insert on public.pet_photos
  for each row execute function private.push_on_pet_photo();

-- ---------------------------------------------------------------------------------------------------------------
-- cron: both jobs call the Edge Function with the key kept in Vault (Josh adds `push_cron_key` once; until then the
-- calls fail quietly and nothing is sent). cron.schedule with an existing name replaces it, so re-running is safe.
-- ---------------------------------------------------------------------------------------------------------------
select cron.schedule('paldex-push-drain', '* * * * *', $cron$
  select net.http_post(
    url := 'https://vtcufhddooqzckjcpzwn.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_key')),
    body := '{"mode":"drain"}'::jsonb)
  where exists (select 1 from public.push_outbox where sent_at is null and tries < 3)
$cron$);
select cron.schedule('paldex-push-meds', '5 * * * *', $cron$
  select net.http_post(
    url := 'https://vtcufhddooqzckjcpzwn.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key',
      (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_key')),
    body := '{"mode":"meds"}'::jsonb)
$cron$);

-- sent rows older than 30 days go (the outbox is a queue, not a history)
select cron.schedule('paldex-push-tidy', '17 4 * * *', $cron$
  delete from public.push_outbox where created_at < now() - interval '30 days'
$cron$);
