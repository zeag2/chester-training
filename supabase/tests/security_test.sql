-- Whole-database checks (run last, after every migration including the bundle). Each check raises if it fails.
\set ON_ERROR_STOP on
do $$ declare bad text; begin
  -- every table in public has row level security on
  select string_agg(c.relname, ', ') into bad from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity and c.relname not like '\_%';
  if bad is not null then raise exception 'no row level security on: %', bad; end if;
  -- signed-out visitors can't read or write any table in public
  select string_agg(distinct table_name, ', ') into bad from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'PUBLIC') and table_name not like '\_%';
  if bad is not null then raise exception 'anon can reach tables: %', bad; end if;
  -- nor run any function in public or private
  select string_agg(p.oid::regprocedure::text, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute');
  if bad is not null then raise exception 'anon can run: %', bad; end if;
  -- trigger helpers aren't callable by signed-in people either
  select string_agg(p.oid::regprocedure::text, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prorettype = 'trigger'::regtype and has_function_privilege('authenticated', p.oid, 'execute');
  if bad is not null then raise exception 'authenticated can run trigger functions: %', bad; end if;
  -- security definer functions pin their search_path
  select string_agg(p.oid::regprocedure::text, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false);
  if bad is not null then raise exception 'security definer without search_path: %', bad; end if;
  -- no public buckets
  select string_agg(id, ', ') into bad from storage.buckets where public;
  if bad is not null then raise exception 'public buckets: %', bad; end if;
end $$;

-- the app still works for a signed-in member after the bundle: triggers fire, functions run
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  update public.cats set data = data where id = 'chester';
  if not found then raise exception 'member can no longer update (touch trigger)'; end if;
  perform public.my_friends();
end $$;
reset role;
