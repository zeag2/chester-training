\set ON_ERROR_STOP on
-- run after 20261123000000_push.sql (any time after friend_requests_test.sql). P, Q, R are new people.
-- pg_cron and pg_net aren't in a plain Postgres: before loading the migration, drop its `create extension` lines and
-- stub cron.schedule (see docs/HANDOFF.md, database policy tests).
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-000000000020'), ('00000000-0000-0000-0000-000000000021'), ('00000000-0000-0000-0000-000000000022') on conflict do nothing;
create table public._pcodes (who text primary key, code text); grant select, insert on public._pcodes to authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000020'); insert into public._pcodes values ('p', public.my_friend_code('Pat')); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000021'); insert into public._pcodes values ('q', public.my_friend_code('Quinn')); reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022'); insert into public._pcodes values ('r', public.my_friend_code('Rae')); reset role;

-- Q allows notifications on one phone, with quiet hours that never bite (0 → 0), and can only see their own prefs
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.save_push_subscription('https://push.example/q1', 'k', 'a', 'test');
insert into public.push_prefs (tz, quiet_from, quiet_to) values ('UTC', 0, 0);
select pg_temp.expect_fail($$insert into public.push_prefs (user_id) values ('00000000-0000-0000-0000-000000000020')$$);
select pg_temp.expect_fail($$select * from public.push_outbox$$);
select pg_temp.expect_fail($$select private.enqueue_push('00000000-0000-0000-0000-000000000021', 'friends', 'x', '', '#/', '')$$);
reset role;

-- P asks Q to be friends: one notification for Q, named; R (no phone allowed) asking gets Q one more, P none
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.request_friend((select code from public._pcodes where who = 'q'));
reset role;
do $$ begin
  if (select count(*) from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000021') <> 1 then raise exception 'no notification for the request'; end if;
  if (select title from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000021') <> 'Pat wants to be friends' then raise exception 'wrong title'; end if;
end $$;
-- the same request again (cancel and re-send) within 10 minutes: still one
select pg_temp.as_user('00000000-0000-0000-0000-000000000020');
select public.cancel_friend_request('00000000-0000-0000-0000-000000000021');
select public.request_friend((select code from public._pcodes where who = 'q'));
reset role;
do $$ begin
  if (select count(*) from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000021') <> 1 then raise exception 'dedupe failed'; end if;
end $$;

-- Q turns friend requests off: R's request queues nothing
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
update public.push_prefs set friends = false;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.request_friend((select code from public._pcodes where who = 'q'));
reset role;
do $$ begin
  if (select count(*) from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000021') <> 1 then raise exception 'pref ignored'; end if;
end $$;

-- quiet hours all day (0 → 23 covers every hour but 23; pick the window that holds now)
update public.push_prefs set friends = true, quiet_from = (extract(hour from now() at time zone 'UTC')::int + 23) % 24,
  quiet_to = (extract(hour from now() at time zone 'UTC')::int + 1) % 24 where user_id = '00000000-0000-0000-0000-000000000021';
do $$ begin
  if private.enqueue_push('00000000-0000-0000-0000-000000000021', 'photos', 'Pat posted Mochi', '', '#/feed', 'quiet-test') then raise exception 'sent in quiet hours'; end if;
  if not private.enqueue_push('00000000-0000-0000-0000-000000000021', 'meds', 'Revolution for Chester', '', '#/', 'meds-test') then raise exception 'medicine held by quiet hours'; end if;
end $$;
update public.push_prefs set quiet_from = 0, quiet_to = 0 where user_id = '00000000-0000-0000-0000-000000000021';

-- Q accepts P; P's household cat gets a photo: Q (a friend, phone allowed) is told, P (the poster) isn't
select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
select public.answer_friend_request('00000000-0000-0000-0000-000000000020', true);
reset role;
insert into public.households (id, name, created_by) values ('00000000-0000-0000-0000-0000000000a0', 'Pat''s', '00000000-0000-0000-0000-000000000020') on conflict do nothing;
insert into public.household_members (household_id, user_id) values ('00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-000000000020') on conflict do nothing;
insert into public.cats (id, data, created_by, household_id) values ('push-mochi', '{"name":"Mochi"}', '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-0000000000a0') on conflict do nothing;
insert into public.pet_photos (cat_id, path, caption, by_user) values ('push-mochi', 'push-mochi/1.jpg', 'Sun nap', '00000000-0000-0000-0000-000000000020');
do $$ begin
  if not exists (select 1 from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000021' and title = 'Pat posted Mochi' and body = 'Sun nap') then raise exception 'no photo notification'; end if;
  if exists (select 1 from public.push_outbox where user_id = '00000000-0000-0000-0000-000000000020') then raise exception 'poster notified'; end if;
end $$;

-- a broken trigger never blocks the insert: a treat for a cat with no household still saves
insert into public.cats (id, data, created_by) values ('push-loner', '{}', '00000000-0000-0000-0000-000000000021') on conflict do nothing;
insert into public.friend_treats (from_user, cat_id, day) values ('00000000-0000-0000-0000-000000000020', 'push-loner', current_date);

-- tidy
delete from public.push_outbox where user_id in ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000022');
drop table public._pcodes;
select 'push_test passed';
