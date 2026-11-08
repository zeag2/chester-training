-- Chester's care: food profiles and the health log. Members can add, edit and (soft-)delete; newest edit wins in the app.
create table if not exists public.care (
  id text primary key check (length(id) between 1 and 64),
  cat_id text not null references public.cats (id) on delete cascade,
  kind text not null check (kind in ('food', 'vet', 'symptom', 'weight', 'groom', 'med')),
  at bigint not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  by_user uuid default auth.uid() references auth.users (id) on delete set null,
  data jsonb not null
);
create index if not exists care_cat_idx on public.care (cat_id);

-- whoever saved it last
create or replace function private.care_by() returns trigger language plpgsql set search_path = ''
as $$ begin new.by_user := auth.uid(); return new; end $$;
drop trigger if exists care_by on public.care;
create trigger care_by before insert or update on public.care for each row execute function private.care_by();

alter table public.care enable row level security;
grant select, insert, update on public.care to authenticated;
revoke all on public.care from anon;

drop policy if exists "members read care" on public.care;
drop policy if exists "members add care" on public.care;
drop policy if exists "members edit care" on public.care;
create policy "members read care" on public.care for select to authenticated using (private.is_member(cat_id));
create policy "members add care" on public.care for insert to authenticated with check (private.is_member(cat_id));
create policy "members edit care" on public.care for update to authenticated using (private.is_member(cat_id)) with check (private.is_member(cat_id));
