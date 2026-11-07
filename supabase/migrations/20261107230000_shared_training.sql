-- Shared training: a cat and its sets live here so everyone in the cat's household sees the same progress.
-- Sets are append-only; skill progress and treats are worked out from them on each phone.

create schema if not exists private;

create table public.cats (
  id text primary key check (length(id) between 1 and 64),
  data jsonb not null,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cat_members (
  cat_id text not null references public.cats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 40),
  joined_at timestamptz not null default now(),
  primary key (cat_id, user_id)
);
create index cat_members_user_idx on public.cat_members (user_id);

create table public.sets (
  id text primary key check (length(id) between 1 and 64),
  cat_id text not null references public.cats (id) on delete cascade,
  by_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at bigint not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index sets_cat_idx on public.sets (cat_id, at);

-- Membership lookup used by the policies. Definer so the cat_members policy can call it without recursing.
create or replace function private.is_member(c text) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.cat_members m where m.cat_id = c and m.user_id = (select auth.uid())) $$;
revoke all on function private.is_member(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(text) to authenticated;

-- Whoever creates a cat is its first member.
create or replace function private.add_creator() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.cat_members (cat_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;
revoke all on function private.add_creator() from public;
create trigger cats_add_creator after insert on public.cats for each row execute function private.add_creator();

create or replace function private.touch() returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;
create trigger cats_touch before update on public.cats for each row execute function private.touch();

alter table public.cats enable row level security;
alter table public.cat_members enable row level security;
alter table public.sets enable row level security;

grant select, insert, update on public.cats to authenticated;
grant select, update on public.cat_members to authenticated;
grant select, insert on public.sets to authenticated;
revoke all on public.cats, public.cat_members, public.sets from anon;
-- Only the cat's details can change; the owner and invite code stay put.
revoke update on public.cats from authenticated;
grant update (data) on public.cats to authenticated;
revoke update on public.cat_members from authenticated;
grant update (display_name) on public.cat_members to authenticated;

create policy "members read their cats" on public.cats for select to authenticated
  using (private.is_member(id) or created_by = (select auth.uid()));
create policy "anyone signed in creates a cat they own" on public.cats for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "members edit their cats" on public.cats for update to authenticated
  using (private.is_member(id)) with check (private.is_member(id));

create policy "members see who else trains the cat" on public.cat_members for select to authenticated
  using (private.is_member(cat_id));
create policy "members rename themselves" on public.cat_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "members read the cat's sets" on public.sets for select to authenticated
  using (private.is_member(cat_id));
create policy "members log sets as themselves" on public.sets for insert to authenticated
  with check (by_user = (select auth.uid()) and private.is_member(cat_id));

-- Join a cat with its invite code. Returns the cat id, or null when the code is wrong.
create or replace function public.join_cat(code text, name text default '') returns text
language plpgsql security definer set search_path = ''
as $$
declare c text; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  select id into c from public.cats where invite_code = upper(trim(code));
  if c is null then return null; end if;
  insert into public.cat_members (cat_id, user_id, display_name) values (c, uid, left(coalesce(name, ''), 40))
    on conflict (cat_id, user_id) do nothing;
  return c;
end $$;
revoke all on function public.join_cat(text, text) from public, anon;
grant execute on function public.join_cat(text, text) to authenticated;
