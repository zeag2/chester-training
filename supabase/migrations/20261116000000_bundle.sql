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
