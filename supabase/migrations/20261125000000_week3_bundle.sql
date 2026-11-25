-- PalDex week 3 bundle (2026-11-25): run this ONE file in the Supabase SQL editor. Safe to run more than once.
-- Contains, in order:
--   1. 20261123000000_push.sql           push notifications: prefs, outbox, triggers, pg_cron jobs (with the
--                                        trigger-function EXECUTE revoke from claude/fix-push-revoke)
--   2. 20261124000000_delete_account.sql "Delete my account" (PR #43)
-- Running this file replaces running those two separately.

-- =================================================================================================================
-- 1. push notifications
-- =================================================================================================================
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
-- only the trigger runs it (Postgres checks EXECUTE when the trigger is created, not when it fires)
revoke all on function private.push_on_friend_request() from public, anon, authenticated;
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
-- only the trigger runs it (Postgres checks EXECUTE when the trigger is created, not when it fires)
revoke all on function private.push_on_friend_treat() from public, anon, authenticated;
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
-- only the trigger runs it (Postgres checks EXECUTE when the trigger is created, not when it fires)
revoke all on function private.push_on_pet_photo() from public, anon, authenticated;
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

-- =================================================================================================================
-- 2. delete my account
-- =================================================================================================================
-- PalDex: "Delete my account" (2026-11-23). Safe to run more than once.
--
-- What deleting an account does, server side (the app removes the storage files first; see below):
--   * pets the person shares with someone else stay with them; any the person set up are handed to the longest-standing
--     other member (cats.created_by cascades on a user delete, so without the handover shared pets would vanish);
--   * pets nobody else can reach are deleted, with their logs, sets, documents and photos rows;
--   * a household the person set up is handed over the same way, or deleted when nobody else is in it;
--   * their training sets on pets that stay are kept without a name (like health logs and vets already are), their own
--     photos rows go, and everything else that is theirs goes with the auth user (memberships, friends, requests, treats,
--     paws, hides, push subscriptions and settings: all `on delete cascade`).
--
-- Storage: Supabase refuses direct deletes from storage.objects in SQL, so the app asks
-- `account_deletion_preview()` for the files, removes them through the Storage API while it is still a member (the
-- delete policies need membership), then calls `delete_my_account()`.

-- 1. training sets on shared pets outlive the person who logged them (care and vets already do: `on delete set null`)
alter table public.sets alter column by_user drop not null;
alter table public.sets drop constraint if exists sets_by_user_fkey;
alter table public.sets add constraint sets_by_user_fkey foreign key (by_user) references auth.users (id) on delete set null;

-- 2. who keeps a pet when `leaving` goes: the longest-standing other person in its household (or, for a pet not in a
--    household yet, on the pet itself). Null when nobody else has it.
create or replace function private.pet_heir(c text, leaving uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.user_id from public.cats k join public.household_members m on m.household_id = k.household_id
      where k.id = c and m.user_id <> leaving order by m.joined_at, m.user_id limit 1),
    (select m.user_id from public.cats k join public.cat_members m on m.cat_id = k.id
      where k.id = c and k.household_id is null and m.user_id <> leaving order by m.joined_at, m.user_id limit 1))
$$;
revoke all on function private.pet_heir(text, uuid) from public, anon, authenticated;

-- the pets a person is involved in: every pet they can reach, plus any they set up
create or replace function private.my_pets(u uuid) returns table (id text, name text, created_by uuid, heir uuid)
language sql stable security definer set search_path = ''
as $$
  select k.id, coalesce(k.data ->> 'name', ''), k.created_by, private.pet_heir(k.id, u)
  from public.cats k
  where k.created_by = u
     or exists (select 1 from public.household_members m where m.household_id = k.household_id and m.user_id = u)
     or (k.household_id is null and exists (select 1 from public.cat_members m where m.cat_id = k.id and m.user_id = u))
$$;
revoke all on function private.my_pets(uuid) from public, anon, authenticated;

-- 3. what deleting my account would do, for the confirm screen and the files the app must remove first:
--    { "deleted": [{id, name}], "kept": [{id, name, keeper}], "files": [{bucket, path}] }
create or replace function public.account_deletion_preview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  return jsonb_build_object(
    'deleted', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
                         from private.my_pets(uid) p where p.heir is null), '[]'::jsonb),
    'kept', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
                        'keeper', coalesce((select nullif(m.display_name, '') from public.household_members m
                                            join public.cats k on k.household_id = m.household_id
                                            where k.id = p.id and m.user_id = p.heir limit 1), ''))
                        order by p.name)
                      from private.my_pets(uid) p where p.heir is not null), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.path) order by f.bucket, f.path) from (
        -- everything stored for pets that go
        select o.bucket_id as bucket, o.name as path from storage.objects o
          where o.bucket_id in ('pet-docs', 'pet-photos')
            and (storage.foldername(o.name))[1] in (select p.id from private.my_pets(uid) p where p.heir is null)
        union
        -- my photos of pets that stay
        select 'pet-photos', ph.path from public.pet_photos ph
          where ph.by_user = uid and ph.cat_id in (select p.id from private.my_pets(uid) p where p.heir is not null)
      ) f), '[]'::jsonb));
end $$;
revoke all on function public.account_deletion_preview() from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;

-- 4. delete the signed-in account. Hands over or deletes pets and households, then deletes the auth user (which
--    cascades the rest). Only ever acts on the caller.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); p record; h record; heir uuid;
begin
  if uid is null then raise exception 'sign in first'; end if;
  for p in select * from private.my_pets(uid) loop
    if p.heir is null then delete from public.cats where id = p.id;
    elsif p.created_by = uid then update public.cats set created_by = p.heir where id = p.id;
    end if;
  end loop;
  for h in select x.id from public.households x
           where x.created_by = uid or exists (select 1 from public.household_members m where m.household_id = x.id and m.user_id = uid) loop
    select m.user_id into heir from public.household_members m where m.household_id = h.id and m.user_id <> uid
      order by m.joined_at, m.user_id limit 1;
    if heir is null then delete from public.households where id = h.id;
    else update public.households set created_by = heir where id = h.id and created_by = uid;
    end if;
  end loop;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
