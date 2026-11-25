-- "Contact us": messages from the in-app form, read only by the app owner. Idempotent: safe to run twice.
--
--   app_admins           who owns the app (one row: Josh). Each person can see only their own row, so a select
--                        that returns a row is the app's "am I an admin?" check. Nobody can write it from the app.
--   contact_messages     the form's messages. Anyone (signed in or not) may INSERT, and only the form's columns
--                        (name, reach, message, app_version); user_id, created_at and done are set by the database.
--                        Users can't read, change or delete them, not even their own. Admins read, mark done, delete.
--   private.contact_guard()  before insert: fixes created_at/done/user_id, trims the text, and a cheap rate limit
--                        (5 an hour for a signed-in person; 30 an hour across everyone signed out).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- the app owner ----
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from public, anon, authenticated;
grant select on public.app_admins to authenticated;
drop policy if exists "see my own admin row" on public.app_admins;
create policy "see my own admin row" on public.app_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Josh: put your own user id here (Supabase → Authentication → Users), take away the "--" and run this one line.
-- insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-000000000000') on conflict do nothing;

-- ---- the messages ----
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  name text,
  reach text,
  message text not null,
  app_version text,
  done boolean not null default false
);
alter table public.contact_messages drop constraint if exists contact_messages_message_len;
alter table public.contact_messages add constraint contact_messages_message_len
  check (char_length(btrim(message)) between 1 and 2000);
alter table public.contact_messages drop constraint if exists contact_messages_short_fields;
alter table public.contact_messages add constraint contact_messages_short_fields
  check (coalesce(char_length(name), 0) <= 80 and coalesce(char_length(reach), 0) <= 200 and coalesce(char_length(app_version), 0) <= 40);
-- newest first for the inbox; per person (and signed out) for the rate limit
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_user_created_idx on public.contact_messages (user_id, created_at);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;
-- only the form's columns can be written; no table-level insert, so user_id/created_at/done can't be set
grant insert (name, reach, message, app_version) on public.contact_messages to anon, authenticated;
-- admins only (the policies below): read, mark done, delete
grant select, delete on public.contact_messages to authenticated;
grant update (done) on public.contact_messages to authenticated;

drop policy if exists "anyone can send a message" on public.contact_messages;
create policy "anyone can send a message" on public.contact_messages for insert to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()) and done = false);
drop policy if exists "admins read messages" on public.contact_messages;
create policy "admins read messages" on public.contact_messages for select to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));
drop policy if exists "admins mark messages done" on public.contact_messages;
create policy "admins mark messages done" on public.contact_messages for update to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));
drop policy if exists "admins delete messages" on public.contact_messages;
create policy "admins delete messages" on public.contact_messages for delete to authenticated
  using (exists (select 1 from public.app_admins a where a.user_id = (select auth.uid())));

-- ---- before insert: tidy the row and rate-limit (definer: it counts rows the sender can't see) ----
create or replace function private.contact_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); recent int;
begin
  new.user_id := me; new.created_at := now(); new.done := false;
  new.message := btrim(new.message);
  new.name := nullif(btrim(coalesce(new.name, '')), '');
  new.reach := nullif(btrim(coalesce(new.reach, '')), '');
  new.app_version := nullif(btrim(coalesce(new.app_version, '')), '');
  if me is null then
    select count(*) into recent from public.contact_messages where user_id is null and created_at > now() - interval '1 hour';
    if recent >= 30 then raise exception 'contact-rate-limited' using errcode = 'P0001'; end if;
  else
    select count(*) into recent from public.contact_messages where user_id = me and created_at > now() - interval '1 hour';
    if recent >= 5 then raise exception 'contact-rate-limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
revoke all on function private.contact_guard() from public, anon, authenticated;
drop trigger if exists contact_guard on public.contact_messages;
create trigger contact_guard before insert on public.contact_messages
  for each row execute function private.contact_guard();
