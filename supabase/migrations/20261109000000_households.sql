-- PalDex: households. A household holds people and pets; everyone in it can see and train every pet in it.
-- Existing per-pet sharing is moved over: each pet owner's pets and everyone sharing them become one household,
-- and the household keeps the owner's existing invite code, so codes already sent still work.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (length(name) <= 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 40),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);
alter table public.cats add column if not exists household_id uuid references public.households (id) on delete set null;
create index if not exists cats_household_idx on public.cats (household_id);

create or replace function private.in_household(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.household_members m where m.household_id = h and m.user_id = (select auth.uid())) $$;
revoke all on function private.in_household(uuid) from public;
grant execute on function private.in_household(uuid) to authenticated;

-- a pet is shared with its household; pets not in a household yet keep their old per-pet sharing
create or replace function private.is_member(c text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.cats k join public.household_members hm on hm.household_id = k.household_id
                 where k.id = c and hm.user_id = (select auth.uid()))
      or exists (select 1 from public.cat_members m join public.cats k on k.id = m.cat_id
                 where m.cat_id = c and m.user_id = (select auth.uid()) and k.household_id is null)
$$;

-- whoever makes a household is in it
create or replace function private.add_household_creator() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.household_members (household_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
revoke all on function private.add_household_creator() from public;
drop trigger if exists households_add_creator on public.households;
create trigger households_add_creator after insert on public.households for each row execute function private.add_household_creator();

-- move existing sharing over: one household per pet owner
do $$
declare r record; h uuid;
begin
  for r in select distinct created_by from public.cats where household_id is null loop
    insert into public.households (created_by, invite_code)
      values (r.created_by, (select k.invite_code from public.cats k where k.created_by = r.created_by order by k.created_at limit 1))
      returning id into h;
    update public.cats set household_id = h where created_by = r.created_by and household_id is null;
    insert into public.household_members (household_id, user_id, display_name)
      select h, m.user_id, max(m.display_name) from public.cat_members m join public.cats k on k.id = m.cat_id
      where k.household_id = h group by m.user_id
      on conflict (household_id, user_id) do update set display_name = excluded.display_name where public.household_members.display_name = '';
  end loop;
end $$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
grant select, insert on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant update (display_name) on public.household_members to authenticated;
revoke all on public.households, public.household_members from anon;

drop policy if exists "members see their household" on public.households;
drop policy if exists "anyone signed in makes a household" on public.households;
drop policy if exists "members rename their household" on public.households;
create policy "members see their household" on public.households for select to authenticated
  using (private.in_household(id) or created_by = (select auth.uid()));
create policy "anyone signed in makes a household" on public.households for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "members rename their household" on public.households for update to authenticated
  using (private.in_household(id)) with check (private.in_household(id));

drop policy if exists "members see the household" on public.household_members;
drop policy if exists "members rename themselves" on public.household_members;
drop policy if exists "leave or remove from a household" on public.household_members;
create policy "members see the household" on public.household_members for select to authenticated
  using (private.in_household(household_id));
create policy "members rename themselves" on public.household_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "leave or remove from a household" on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.households h where h.id = household_id and h.created_by = (select auth.uid())));

-- new pets go into a household you're in
drop policy if exists "anyone signed in creates a cat they own" on public.cats;
create policy "anyone signed in creates a cat they own" on public.cats for insert to authenticated
  with check (created_by = (select auth.uid()) and (household_id is null or private.in_household(household_id)));

-- join a household with its code (a pet's old invite code works too). Returns the household id, or null.
create or replace function public.join_household(code text, name text default '') returns uuid
language plpgsql security definer set search_path = ''
as $$
declare h uuid; uid uuid := auth.uid(); c text := upper(trim(code));
begin
  if uid is null then raise exception 'sign in first'; end if;
  select id into h from public.households where invite_code = c;
  if h is null then select household_id into h from public.cats where invite_code = c; end if;
  if h is null then return null; end if;
  insert into public.household_members (household_id, user_id, display_name) values (h, uid, left(coalesce(name, ''), 40))
    on conflict (household_id, user_id) do nothing;
  return h;
end $$;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.join_household(text, text) to authenticated;

-- older app versions still call join_cat: send them into the household too
create or replace function public.join_cat(code text, name text default '') returns text
language plpgsql security definer set search_path = ''
as $$
declare c text; h uuid; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  select id, household_id into c, h from public.cats where invite_code = upper(trim(code));
  if c is null then
    select k.id, k.household_id into c, h from public.households x join public.cats k on k.household_id = x.id
      where x.invite_code = upper(trim(code)) order by k.created_at limit 1;
  end if;
  if c is null then return null; end if;
  insert into public.cat_members (cat_id, user_id, display_name) values (c, uid, left(coalesce(name, ''), 40)) on conflict do nothing;
  if h is not null then insert into public.household_members (household_id, user_id, display_name) values (h, uid, left(coalesce(name, ''), 40)) on conflict do nothing; end if;
  return c;
end $$;

-- the people in a household, with email and sets logged across its pets. Members only.
create or replace function public.household_people(h uuid)
returns table (user_id uuid, display_name text, email text, joined_at timestamptz, sets_logged bigint, is_owner boolean)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, m.display_name, u.email::text, m.joined_at,
         (select count(*) from public.sets s join public.cats k on k.id = s.cat_id where k.household_id = h and s.by_user = m.user_id),
         m.user_id = x.created_by
  from public.household_members m
  join auth.users u on u.id = m.user_id
  join public.households x on x.id = m.household_id
  where m.household_id = h and private.in_household(h)
  order by m.joined_at
$$;
revoke all on function public.household_people(uuid) from public, anon;
grant execute on function public.household_people(uuid) to authenticated;
