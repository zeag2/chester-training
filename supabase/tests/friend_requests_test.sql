\set ON_ERROR_STOP on
-- run after the friend requests migration (any time after friends_test.sql). F, G and H are new people.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000f'), ('00000000-0000-0000-0000-000000000010'), ('00000000-0000-0000-0000-000000000011') on conflict do nothing;
create table public._codes (who text primary key, code text); grant select, insert on public._codes to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f'); insert into public._codes values ('f', public.my_friend_code('Fay')); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000010'); insert into public._codes values ('g', public.my_friend_code('Gus')); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011'); insert into public._codes values ('h', public.my_friend_code('Hal')); reset role;

-- F enters G's code: a request, not a friendship; wrong codes and your own code still give null
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ declare r jsonb; begin
  if public.request_friend('nope') is not null then raise exception 'wrong code accepted'; end if;
  if public.request_friend(public.my_friend_code()) is not null then raise exception 'requested myself'; end if;
  r := public.request_friend(lower((select code from public._codes where who = 'g')));
  if r->>'status' <> 'sent' or r->>'name' <> 'Gus' then raise exception 'request_friend returned %', r; end if;
  if (select count(*) from public.my_friends()) <> 0 then raise exception 'friends without accepting'; end if;
  if (select count(*) from public.friend_requests() where not incoming and name = 'Gus') <> 1 then raise exception 'outgoing request not listed'; end if;
  -- the old function sends a request too
  if public.add_friend((select code from public._codes where who = 'h')) <> 'Hal' then raise exception 'add_friend name wrong'; end if;
  if (select count(*) from public.my_friends()) <> 0 then raise exception 'add_friend skipped the request'; end if;
end $$;
-- the table itself is closed
select pg_temp.expect_fail($$select * from public.friend_requests$$);
select pg_temp.expect_fail($$insert into public.friend_requests values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000f')$$);
reset role;

-- G sees "Accept Fay?" and accepts: friends both ways, request gone; nobody can accept a request that wasn't sent
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
do $$ begin
  if public.answer_friend_request('00000000-0000-0000-0000-000000000010', true) then raise exception 'H accepted a request G never sent'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000010');
do $$ begin
  if (select name from public.friend_requests() where incoming) <> 'Fay' then raise exception 'incoming request not listed'; end if;
  if public.answer_friend_request('00000000-0000-0000-0000-000000000011', true) then raise exception 'accepted a request nobody sent'; end if;
  if not public.answer_friend_request('00000000-0000-0000-0000-00000000000f', true) then raise exception 'accept failed'; end if;
  if (select name from public.my_friends()) <> 'Fay' then raise exception 'not friends after accepting'; end if;
  if (select count(*) from public.friend_requests()) <> 0 then raise exception 'request left after accepting'; end if;
  if (select public.request_friend((select code from public._codes where who = 'f'))->>'status') <> 'already' then raise exception 'not already friends'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ begin if (select name from public.my_friends()) <> 'Gus' then raise exception 'friendship not both ways'; end if; end $$;
reset role;

-- H declines F: F still sees it waiting, asking again doesn't bring it back for H; H entering F's code makes friends
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
do $$ begin
  if (select name from public.friend_requests() where incoming) <> 'Fay' then raise exception 'H has no request from F'; end if;
  if not public.answer_friend_request('00000000-0000-0000-0000-00000000000f', false) then raise exception 'decline failed'; end if;
  if (select count(*) from public.friend_requests()) <> 0 then raise exception 'declined request still shown to H'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
do $$ begin
  if (select count(*) from public.friend_requests() where not incoming and name = 'Hal') <> 1 then raise exception 'F can tell it was declined'; end if;
  if (select public.request_friend((select code from public._codes where who = 'h'))->>'status') <> 'sent' then raise exception 'resend wrong'; end if;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
do $$ begin
  if (select count(*) from public.friend_requests()) <> 0 then raise exception 'resent request shown again'; end if;
  if (select public.request_friend((select code from public._codes where who = 'f'))->>'status') <> 'friends' then raise exception 'entering their code did not accept'; end if;
  if (select count(*) from public.my_friends()) <> 1 then raise exception 'H and F not friends'; end if;
end $$;
-- H removes F: friendship and requests gone both ways
select public.remove_friend('00000000-0000-0000-0000-00000000000f');
reset role;
do $$ begin
  if exists (select 1 from public.friends where '00000000-0000-0000-0000-000000000011' in (user_id, friend_id)) then raise exception 'not removed'; end if;
  if exists (select 1 from public.friend_requests where '00000000-0000-0000-0000-000000000011' in (from_user, to_user)) then raise exception 'requests left'; end if;
end $$;

-- cancelling: G asks H, then takes it back
select pg_temp.as_user('00000000-0000-0000-0000-000000000010');
select public.request_friend((select code from public._codes where who = 'h'));
select public.cancel_friend_request('00000000-0000-0000-0000-000000000011');
do $$ begin if (select count(*) from public.friend_requests()) <> 0 then raise exception 'cancel failed'; end if; end $$;
reset role;

-- signed out: nothing works
set role anon;
select pg_temp.expect_fail($$select public.request_friend('x')$$);
select pg_temp.expect_fail($$select * from public.friend_requests()$$);
select pg_temp.expect_fail($$select public.answer_friend_request('00000000-0000-0000-0000-00000000000f', true)$$);
reset role;
drop table public._codes;
select 'friend_requests_test passed';
