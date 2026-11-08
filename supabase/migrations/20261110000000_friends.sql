-- PalDex: friends. Every account has a friend code; entering someone's code makes you friends both ways.
-- Friends see a small card for each of each other's pets (look, outfit, age, skills mastered, streak, bond), published
-- by the pet's own household. They never see the pet record itself, its care log, documents or training sets.
-- Safe to run more than once.

create table if not exists public.friend_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  display_name text not null default '' check (length(display_name) <= 40)
);
create table if not exists public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friends_friend_idx on public.friends (friend_id);
-- the public face of a pet, written by its household (see set_pet_card)
alter table public.cats add column if not exists card jsonb;

alter table public.friend_profiles enable row level security;
alter table public.friends enable row level security;
revoke all on public.friend_profiles from anon, authenticated;
revoke all on public.friends from anon, authenticated;
-- everything goes through the functions below; people can read only their own rows directly
grant select on public.friend_profiles, public.friends to authenticated;
drop policy if exists "see my friend profile" on public.friend_profiles;
create policy "see my friend profile" on public.friend_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "see my friendships" on public.friends;
create policy "see my friendships" on public.friends for select to authenticated using (user_id = (select auth.uid()));

-- my code (made on first use) and the name friends see
create or replace function public.my_friend_code(name text default '') returns text
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); c text;
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.friend_profiles (user_id, display_name) values (me, left(coalesce(name, ''), 40))
    on conflict (user_id) do update set display_name = case when excluded.display_name <> '' then excluded.display_name else public.friend_profiles.display_name end;
  select friend_code into c from public.friend_profiles where user_id = me;
  return c;
end $$;

-- add a friend by code: returns their name, '' if they have none, or null when the code is wrong or it's your own
create or replace function public.add_friend(code text) returns text
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); them uuid; nm text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select user_id, display_name into them, nm from public.friend_profiles where friend_code = upper(trim(code));
  if them is null or them = me then return null; end if;
  insert into public.friends (user_id, friend_id) values (me, them), (them, me) on conflict do nothing;
  return coalesce(nm, '');
end $$;

create or replace function public.remove_friend(friend uuid) returns void
language sql security definer set search_path = ''
as $$ delete from public.friends where (user_id = (select auth.uid()) and friend_id = friend) or (user_id = friend and friend_id = (select auth.uid())) $$;

create or replace function public.my_friends() returns table (user_id uuid, name text)
language sql stable security definer set search_path = ''
as $$ select f.friend_id, coalesce(p.display_name, '') from public.friends f left join public.friend_profiles p on p.user_id = f.friend_id
      where f.user_id = (select auth.uid()) order by f.created_at $$;

-- my friends' pets: only the card, the name and the look; never the full record
create or replace function public.friend_pets() returns table (owner uuid, owner_name text, cat_id text, card jsonb)
language sql stable security definer set search_path = ''
as $$
  select distinct on (k.id) f.friend_id, coalesce(p.display_name, ''), k.id,
    coalesce(k.card, '{}'::jsonb) || jsonb_build_object('name', k.data->>'name', 'coat', k.data->>'coat', 'eyes', k.data->>'eyes', 'sex', k.data->>'sex', 'birthday', k.data->>'birthday')
  from public.friends f
  join public.household_members hm on hm.user_id = f.friend_id
  join public.cats k on k.household_id = hm.household_id
  left join public.friend_profiles p on p.user_id = f.friend_id
  where f.user_id = (select auth.uid())
    and not private.in_household(k.household_id) -- my own pets aren't "friends' pets"
  order by k.id, f.created_at
$$;

-- a pet's household publishes its card (a few display fields, size-capped)
create or replace function public.set_pet_card(c text, card jsonb) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not private.is_member(c) then raise exception 'not your pet'; end if;
  if length(card::text) > 4000 then raise exception 'card too big'; end if;
  update public.cats set card = set_pet_card.card where id = c;
end $$;

revoke all on function public.my_friend_code(text), public.add_friend(text), public.remove_friend(uuid), public.my_friends(), public.friend_pets(), public.set_pet_card(text, jsonb) from public;
grant execute on function public.my_friend_code(text), public.add_friend(text), public.remove_friend(uuid), public.my_friends(), public.friend_pets(), public.set_pet_card(text, jsonb) to authenticated;
