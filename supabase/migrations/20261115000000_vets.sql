-- PalDex: your vet. The household's vet contacts (the usual vet and an emergency vet), shared by everyone in the
-- household like its pets: name, clinic, phone, address, website, notes, in `data`. Edits sync newest-wins in the
-- app (updated_at); a delete is a tombstone (deleted = true) so it reaches the other phones.
-- Run after 20261109000000_households.sql. Safe to run more than once.

create table if not exists public.vets (
  id text primary key check (length(id) between 1 and 64),
  household_id uuid not null references public.households (id) on delete cascade,
  updated_at bigint not null,
  deleted boolean not null default false,
  by_user uuid default auth.uid() references auth.users (id) on delete set null,
  data jsonb not null check (length(data::text) <= 4000)
);
create index if not exists vets_household_idx on public.vets (household_id);

create or replace function private.vets_by() returns trigger language plpgsql set search_path = ''
as $$ begin new.by_user := auth.uid(); return new; end $$;
drop trigger if exists vets_by on public.vets;
create trigger vets_by before insert or update on public.vets for each row execute function private.vets_by();

alter table public.vets enable row level security;
revoke all on public.vets from anon, authenticated;
grant select, insert, update on public.vets to authenticated;

drop policy if exists "household reads vets" on public.vets;
drop policy if exists "household adds vets" on public.vets;
drop policy if exists "household edits vets" on public.vets;
create policy "household reads vets" on public.vets for select to authenticated using (private.in_household(household_id));
create policy "household adds vets" on public.vets for insert to authenticated with check (private.in_household(household_id));
create policy "household edits vets" on public.vets for update to authenticated
  using (private.in_household(household_id)) with check (private.in_household(household_id));
