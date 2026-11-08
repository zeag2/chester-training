-- Run after rls_test.sql (Chester exists; A and B are members, C is not).
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.care (id, cat_id, kind, at, updated_at, data) values ('f1', 'chester', 'food', 1, 1, '{"name":"Tuna"}');
-- the app's upsert: insert or update the same row
insert into public.care (id, cat_id, kind, at, updated_at, data) values ('f1', 'chester', 'food', 1, 2, '{"name":"Tuna pate"}')
  on conflict (id) do update set id = excluded.id, cat_id = excluded.cat_id, kind = excluded.kind, at = excluded.at,
    updated_at = excluded.updated_at, deleted = excluded.deleted, data = excluded.data;
select pg_temp.expect_fail($q$ insert into public.care (id, cat_id, kind, at, updated_at, data) values ('bad', 'chester', 'nonsense', 1, 1, '{}') $q$);
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select data->>'name' from public.care where id = 'f1') <> 'Tuna pate' then raise exception 'member cannot read care'; end if;
  update public.care set deleted = true, updated_at = 3 where id = 'f1';
  if not found then raise exception 'member cannot edit care'; end if;
  if (select by_user from public.care where id = 'f1') <> '00000000-0000-0000-0000-00000000000b' then raise exception 'by_user not stamped'; end if;
end $$;
-- can't move an item to a cat they're not a member of
select pg_temp.expect_fail($q$ update public.care set cat_id = 'other' $q$);
select pg_temp.expect_fail($q$ delete from public.care $q$);
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.care) <> 0 then raise exception 'stranger can read care'; end if;
  update public.care set data = '{}' where id = 'f1'; if found then raise exception 'stranger can edit care'; end if;
end $$;
select pg_temp.expect_fail($q$ insert into public.care (id, cat_id, kind, at, updated_at, data) values ('x', 'chester', 'food', 1, 1, '{}') $q$);
reset role;
set role anon;
select pg_temp.expect_fail($q$ select * from public.care $q$);
reset role;
select 'ALL CARE CHECKS PASSED' as result;
