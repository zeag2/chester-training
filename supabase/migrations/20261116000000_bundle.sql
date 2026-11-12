-- PalDex: this week's SQL in one run (Josh pastes the whole file into the SQL editor). Every part is safe to run again.

-- ============================================================================================================
-- part 1: security (2026-11-12, security review). No new tables; it only takes away access nobody should have.
-- Until it's run the app works the same: every table already has row level security and per-user policies.
-- ============================================================================================================

-- Functions in public are callable through the API. Postgres lets everyone (PUBLIC) run a new function and Supabase
-- also grants them to anon (signed out). Each migration already revokes its own; this catches any that slipped, and
-- makes sure signed-in people keep the ones the app calls. Extension functions are left alone.
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Trigger-only helpers in private: nobody should call them directly (triggers still fire; Postgres checks EXECUTE
-- only when a trigger is created).
do $$ declare f text; begin
  foreach f in array array['private.touch()', 'private.care_by()', 'private.vets_by()'] loop
    if to_regprocedure(f) is not null then execute format('revoke all on function %s from public, anon, authenticated', f); end if;
  end loop;
end $$;

-- Future tables and functions made in public by these scripts: nothing for signed-out visitors unless a migration
-- grants it on purpose (Supabase's default is to grant everything to anon and rely on row level security alone).
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

-- Vet documents stay private (only reachable through signed links for the cat's members).
update storage.buckets set public = false where id = 'pet-docs' and public;

-- ============================================================================================================
-- part 2: photo feed (2026-11-12, plan docs/plans/2026-11-12-photo-feed.md). New tables and a new private bucket.
-- Until the app ships the feed nothing reads or writes them. Who sees a photo is worked out live from the pet's
-- household and `friends`, so removing a friend hides your photos from them at once. Vet documents (pet-docs) are
-- not touched: they stay household-only.
-- ============================================================================================================

-- may I see this pet's photos: I'm in its household, or I'm friends with someone who is
create or replace function private.can_see_pet(c text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_member(c) or exists (
    select 1 from public.cats k
      join public.household_members hm on hm.household_id = k.household_id
      join public.friends f on f.friend_id = hm.user_id and f.user_id = (select auth.uid())
    where k.id = c)
$$;
revoke all on function private.can_see_pet(text) from public, anon;
grant execute on function private.can_see_pet(text) to authenticated;

create table if not exists public.pet_photos (
  id uuid primary key default gen_random_uuid(),
  cat_id text not null references public.cats (id) on delete cascade,
  path text not null unique,                      -- in the pet-photos bucket: <cat_id>/<uuid>.jpg
  caption text not null default '' check (length(caption) <= 140),
  width int check (width between 1 and 4000),
  height int check (height between 1 and 4000),
  skill text check (length(skill) <= 60),          -- set when posted from a mastered skill
  by_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (path like cat_id || '/%')
);
create index if not exists pet_photos_cat_idx on public.pet_photos (cat_id, created_at desc);
create index if not exists pet_photos_by_idx on public.pet_photos (by_user);

create table if not exists public.photo_reactions (    -- one paw per person per photo
  photo_id uuid not null references public.pet_photos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);
create index if not exists photo_reactions_user_idx on public.photo_reactions (user_id);

create table if not exists public.photo_hides (        -- "hide" on a friend's photo; only for me
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  photo_id uuid not null references public.pet_photos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);
create index if not exists photo_hides_photo_idx on public.photo_hides (photo_id);

alter table public.pet_photos enable row level security;
alter table public.photo_reactions enable row level security;
alter table public.photo_hides enable row level security;
revoke all on public.pet_photos, public.photo_reactions, public.photo_hides from public, anon, authenticated;
grant select, insert, delete on public.pet_photos, public.photo_reactions, public.photo_hides to authenticated;
grant update (caption) on public.pet_photos to authenticated;

drop policy if exists "household and friends see photos" on public.pet_photos;
drop policy if exists "household posts photos" on public.pet_photos;
drop policy if exists "poster edits the caption" on public.pet_photos;
drop policy if exists "poster or household deletes photos" on public.pet_photos;
create policy "household and friends see photos" on public.pet_photos for select to authenticated
  using (private.can_see_pet(cat_id));
create policy "household posts photos" on public.pet_photos for insert to authenticated
  with check (by_user = (select auth.uid()) and private.is_member(cat_id));
create policy "poster edits the caption" on public.pet_photos for update to authenticated
  using (by_user = (select auth.uid())) with check (by_user = (select auth.uid()) and private.is_member(cat_id));
create policy "poster or household deletes photos" on public.pet_photos for delete to authenticated
  using (by_user = (select auth.uid()) or private.is_member(cat_id));

drop policy if exists "see paws on photos I can see" on public.photo_reactions;
drop policy if exists "paw a photo I can see" on public.photo_reactions;
drop policy if exists "take back my paw" on public.photo_reactions;
create policy "see paws on photos I can see" on public.photo_reactions for select to authenticated
  using (exists (select 1 from public.pet_photos p where p.id = photo_id));  -- the photo's own policy decides
create policy "paw a photo I can see" on public.photo_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.pet_photos p where p.id = photo_id));
create policy "take back my paw" on public.photo_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "my hidden photos" on public.photo_hides;
drop policy if exists "hide a photo I can see" on public.photo_hides;
drop policy if exists "unhide" on public.photo_hides;
create policy "my hidden photos" on public.photo_hides for select to authenticated using (user_id = (select auth.uid()));
create policy "hide a photo I can see" on public.photo_hides for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.pet_photos p where p.id = photo_id));
create policy "unhide" on public.photo_hides for delete to authenticated using (user_id = (select auth.uid()));

-- the feed, newest first, a page at a time; runs as the caller, so the policies above decide what's in it
create or replace function public.photo_feed(before timestamptz default null, n int default 20)
returns table (id uuid, cat_id text, path text, caption text, width int, height int, skill text, by_user uuid,
               created_at timestamptz, paws bigint, pawed boolean)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.cat_id, p.path, p.caption, p.width, p.height, p.skill, p.by_user, p.created_at,
    (select count(*) from public.photo_reactions r where r.photo_id = p.id),
    exists (select 1 from public.photo_reactions r where r.photo_id = p.id and r.user_id = (select auth.uid()))
  from public.pet_photos p
  where (before is null or p.created_at < before)
    and not exists (select 1 from public.photo_hides h where h.photo_id = p.id and h.user_id = (select auth.uid()))
  order by p.created_at desc
  limit least(greatest(coalesce(n, 20), 1), 50)
$$;
revoke all on function public.photo_feed(timestamptz, int) from public, anon;
grant execute on function public.photo_feed(timestamptz, int) to authenticated;

-- the bucket: private, photos only, already shrunk on the phone (1600 px, JPEG ~0.8 is well under 2 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('pet-photos', 'pet-photos', false, 2097152, array['image/jpeg', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "household and friends read pet photos" on storage.objects;
drop policy if exists "household adds pet photos" on storage.objects;
drop policy if exists "household removes pet photos" on storage.objects;
create policy "household and friends read pet photos" on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos' and private.can_see_pet((storage.foldername(name))[1]));
create policy "household adds pet photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos' and private.is_member((storage.foldername(name))[1]));
create policy "household removes pet photos" on storage.objects for delete to authenticated
  using (bucket_id = 'pet-photos' and private.is_member((storage.foldername(name))[1]));

-- ============================================================================================================
-- part 3: push subscriptions (2026-11-12). Only the table; the Edge Function that sends (with the VAPID keys as
-- secrets, never in the repo) reads it with the service role. Nothing uses it until the app asks for permission.
-- ============================================================================================================
create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) <= 1000),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  user_agent text not null default '' check (length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
drop policy if exists "my push subscriptions" on public.push_subscriptions;
drop policy if exists "remove my push subscriptions" on public.push_subscriptions;
create policy "my push subscriptions" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "remove my push subscriptions" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- save this phone's subscription for me. A phone has one endpoint; if someone else signed in on it before, it moves
-- to me (so their notifications stop arriving on a phone they've left).
create or replace function public.save_push_subscription(endpoint text, p256dh text, auth text, user_agent text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions as s (endpoint, user_id, p256dh, auth, user_agent)
    values (save_push_subscription.endpoint, me, save_push_subscription.p256dh, save_push_subscription.auth,
            left(coalesce(save_push_subscription.user_agent, ''), 300))
  on conflict on constraint push_subscriptions_pkey do update
    set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, last_seen = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
