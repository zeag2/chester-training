\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
-- after the migration: A owns Chester's household; B was a member of Chester (from rls_test, before households)
reset role;
do $$ begin
  if (select count(*) from public.households) <> 1 then raise exception 'existing sharing not moved to a household'; end if;
  if (select count(*) from public.household_members) <> 2 then raise exception 'members not moved'; end if;
  if (select invite_code from public.households) <> (select invite_code from public.cats where id = 'chester') then raise exception 'old code not kept'; end if;
end $$;
create table public._h as select id from public.households; grant select on public._h to authenticated;

-- A adds a second pet to the household: B sees it without a new invite
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.cats (id, data, household_id) values ('luna', '{"name":"Luna"}', (select id from public._h));
insert into public.sets (id, cat_id, at, data) values ('l1', 'luna', 5, '{}');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.cats) <> 2 then raise exception 'household member cannot see new pet'; end if;
  if (select count(*) from public.sets where cat_id = 'luna') <> 1 then raise exception 'member cannot read new pet sets'; end if;
  insert into public.sets (id, cat_id, at, data) values ('l2', 'luna', 6, '{}');
  if (select count(*) from public.household_people((select id from public._h))) <> 2 then raise exception 'cannot list household'; end if;
end $$;
reset role;

-- stranger C: sees nothing, can't put a pet in A's household, joins with the (old) code
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.cats) + (select count(*) from public.households) <> 0 then raise exception 'stranger sees household'; end if;
end $$;
select pg_temp.expect_fail($q$ insert into public.cats (id, data, household_id) values ('x', '{}', (select id from public._h)) $q$);
do $$ begin
  if public.join_household('nope') is not null then raise exception 'bad code joined'; end if;
  if public.join_household((select invite_code from public._code)) is distinct from (select id from public._h) then raise exception 'old code does not join'; end if;
  if (select count(*) from public.cats) <> 2 then raise exception 'joined member cannot see pets'; end if;
end $$;
reset role;

-- A removes C from the household: C loses every pet, even though C had joined
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000c';
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin if (select count(*) from public.cats) <> 0 then raise exception 'removed member still sees pets'; end if; end $$;
reset role;
-- B can't remove A; B can leave
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000a'; if found then raise exception 'non-owner removed owner'; end if;
  delete from public.household_members where user_id = '00000000-0000-0000-0000-00000000000b'; if not found then raise exception 'cannot leave'; end if;
  if (select count(*) from public.cats) <> 0 then raise exception 'left member still sees pets'; end if;
end $$;
reset role;
-- a brand-new user makes their own household
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.households (name) values ('D home');
do $$ begin if (select count(*) from public.household_members) <> 1 then raise exception 'creator not added'; end if; end $$;
reset role;
select 'ALL HOUSEHOLD CHECKS PASSED' as result;
