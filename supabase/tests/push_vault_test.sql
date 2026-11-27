\set ON_ERROR_STOP on
-- run after 20261127000000_push_vault.sql (stubs: stub_auth.sql, stub_vault.sql). Fake values only.
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into vault.secrets values ('push_cron_key', 'test-cron-key-0123456789'), ('push_vapid_public', 'test-public'),
  ('push_vapid_private', 'test-private'), ('push_vapid_subject', 'https://example.test/')
  on conflict (name) do update set secret = excluded.secret;

-- signed out and signed in: no
set role anon;
select pg_temp.expect_fail($$select * from public.push_secrets()$$);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect_fail($$select * from public.push_secrets()$$);
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.push_secrets()', 'execute') then raise exception 'anon can run push_secrets'; end if;
  if has_function_privilege('authenticated', 'public.push_secrets()', 'execute') then raise exception 'authenticated can run push_secrets'; end if;
  if not has_function_privilege('service_role', 'public.push_secrets()', 'execute') then raise exception 'service_role cannot run push_secrets'; end if;
end $$;

-- the service role: all four, even though it can't read Vault itself
set role service_role;
select pg_temp.expect_fail($$select * from vault.decrypted_secrets$$);
do $$ declare s record; begin
  select * into s from public.push_secrets();
  if s.cron_key <> 'test-cron-key-0123456789' or s.vapid_public <> 'test-public' or s.vapid_private <> 'test-private'
     or s.vapid_subject <> 'https://example.test/' then raise exception 'wrong values: %', s; end if;
end $$;
reset role;
-- a missing secret comes back null (the function then says "not set up"), not an error
delete from vault.secrets where name = 'push_vapid_private';
set role service_role;
do $$ begin if (select vapid_private from public.push_secrets()) is not null then raise exception 'missing should be null'; end if; end $$;
reset role;
