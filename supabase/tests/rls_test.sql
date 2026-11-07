-- A = Josh, B = his girlfriend, C = a stranger. Each check raises if the policy is wrong.
\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.cats (id, data) values ('chester', '{"name":"Chester"}');
do $$ begin if (select count(*) from public.cat_members) <> 1 then raise exception 'creator not a member'; end if; end $$;
insert into public.sets (id, cat_id, at, data) values ('s1', 'chester', 1, '{}');
select pg_temp.expect_fail($q$ insert into public.cats (id, data, created_by) values ('x', '{}', '00000000-0000-0000-0000-00000000000b') $q$);
select pg_temp.expect_fail($q$ insert into public.sets (id, cat_id, at, data, by_user) values ('s9', 'chester', 1, '{}', '00000000-0000-0000-0000-00000000000b') $q$);
select pg_temp.expect_fail($q$ update public.cats set invite_code = 'AAAA' $q$);
reset role;
create table public._code as select invite_code from public.cats where id = 'chester'; grant select on public._code to authenticated;

-- stranger sees nothing and cannot write to Chester
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.cats) + (select count(*) from public.sets) + (select count(*) from public.cat_members) <> 0 then raise exception 'stranger can read'; end if;
  update public.cats set data = '{"name":"Hacked"}' where id = 'chester';
  if found then raise exception 'stranger can update'; end if;
end $$;
select pg_temp.expect_fail($q$ insert into public.sets (id, cat_id, at, data) values ('s2', 'chester', 1, '{}') $q$);
do $$ begin if public.join_cat('WRONG123') is not null then raise exception 'bad code joined'; end if; end $$;
reset role;

-- girlfriend joins with the code, then sees and adds sets
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if public.join_cat(lower((select invite_code from public._code)), 'Sam') <> 'chester' then raise exception 'join failed'; end if;
  if (select count(*) from public.sets) <> 1 then raise exception 'member cannot read sets'; end if;
  if (select count(*) from public.cat_members) <> 2 then raise exception 'member cannot see household'; end if;
  insert into public.sets (id, cat_id, at, data) values ('s3', 'chester', 2, '{}');
  -- the app re-sends sets it isn't sure arrived; duplicates are skipped, not errors
  insert into public.sets (id, cat_id, at, data) values ('s1', 'chester', 1, '{}'), ('s3', 'chester', 2, '{}') on conflict (id) do nothing;
  if (select count(*) from public.sets) <> 2 then raise exception 'duplicate set stored'; end if;
  update public.cats set data = '{"name":"Chester P."}' where id = 'chester';
  if not found then raise exception 'member cannot edit cat'; end if;
  update public.cat_members set display_name = 'Nope' where user_id = '00000000-0000-0000-0000-00000000000a';
  if found then raise exception 'renamed someone else'; end if;
end $$;
select pg_temp.expect_fail($q$ update public.sets set at = 5 $q$);
select pg_temp.expect_fail($q$ delete from public.sets $q$);
reset role;

-- logged-out visitors get nothing
set role anon;
select pg_temp.expect_fail($q$ select * from public.cats $q$);
select pg_temp.expect_fail($q$ select public.join_cat('X') $q$);
reset role;
select 'ALL RLS CHECKS PASSED' as result;
