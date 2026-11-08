\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
-- A owns Chester; B is a member (from rls_test). Add a duplicate D, and a stranger C.
reset role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000d');
insert into public.cat_members (cat_id, user_id, display_name) values ('chester', '00000000-0000-0000-0000-00000000000d', 'Megan');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin if (select count(*) from public.cat_people('chester')) <> 0 then raise exception 'stranger sees people'; end if; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if (select count(*) from public.cat_people('chester')) <> 3 then raise exception 'member cannot list people'; end if;
  delete from public.cat_members where user_id = '00000000-0000-0000-0000-00000000000d';
  if found then raise exception 'a non-owner removed someone'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if not (select is_owner from public.cat_people('chester') where user_id = '00000000-0000-0000-0000-00000000000a') then raise exception 'owner not marked'; end if;
  delete from public.cat_members where user_id = '00000000-0000-0000-0000-00000000000d';
  if not found then raise exception 'owner cannot remove'; end if;
  if (select count(*) from public.sets where cat_id = 'chester') = 0 then raise exception 'sets lost'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin delete from public.cat_members where user_id = '00000000-0000-0000-0000-00000000000b'; if not found then raise exception 'cannot leave'; end if; end $$;
reset role;
select 'ALL PEOPLE CHECKS PASSED' as result;
