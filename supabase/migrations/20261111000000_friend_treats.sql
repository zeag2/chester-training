-- PalDex: friends give treats. Once a day, a friend can give each of their friends' pets a free treat. The pet's
-- household reads who gave what (treats_for) and its phones add +1 treat each to the pet's corner.
-- Needs the friends migration first. Safe to run more than once.

create table if not exists public.friend_treats (
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cat_id text not null references public.cats (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (from_user, cat_id, day)
);
create index if not exists friend_treats_cat_idx on public.friend_treats (cat_id, day);

alter table public.friend_treats enable row level security;
-- no direct access at all: everything goes through the functions below
revoke all on public.friend_treats from anon, authenticated;

-- give a friend's pet today's treat. `d` is the giver's local day (it must be within a day of the server's).
-- Returns true when given, false when this pet already had one from you that day.
create or replace function public.give_treat(c text, d date) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if d is null or d < current_date - 1 or d > current_date + 1 then raise exception 'bad day'; end if;
  if not exists (
    select 1 from public.friends f
    join public.household_members hm on hm.user_id = f.friend_id
    join public.cats k on k.household_id = hm.household_id
    where f.user_id = me and k.id = c and not private.in_household(k.household_id)
  ) then raise exception 'not a friend''s pet'; end if;
  insert into public.friend_treats (from_user, cat_id, day) values (me, c, d) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- which of my friends' pets I've given a treat on day `d` (so the button can say "Given today")
create or replace function public.treats_given(d date) returns setof text
language sql stable security definer set search_path = ''
as $$ select t.cat_id from public.friend_treats t where t.from_user = (select auth.uid()) and t.day = d $$;

-- treats my pet got in the last 30 days, with the giver's friend name; only for the pet's own household
create or replace function public.treats_for(c text) returns table (from_user uuid, from_name text, day date)
language sql stable security definer set search_path = ''
as $$
  select t.from_user, coalesce(p.display_name, ''), t.day
  from public.friend_treats t left join public.friend_profiles p on p.user_id = t.from_user
  where t.cat_id = c and private.is_member(c) and t.day >= current_date - 30
  order by t.day, t.created_at
$$;

revoke all on function public.give_treat(text, date), public.treats_given(date), public.treats_for(text) from public, anon;
grant execute on function public.give_treat(text, date), public.treats_given(date), public.treats_for(text) to authenticated;
