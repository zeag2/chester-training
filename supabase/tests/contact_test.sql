\set ON_ERROR_STOP on
-- run after 20261126000000_contact_messages.sql (any time after the stubs; before security_test.sql).
-- Admin is V, an ordinary signed-in person is W; signed-out visitors are the anon role.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', '', false); execute 'set role anon'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-000000000030'), ('00000000-0000-0000-0000-000000000031') on conflict do nothing;
insert into public.app_admins values ('00000000-0000-0000-0000-000000000030') on conflict do nothing;
delete from public.contact_messages;

-- signed out: can send, can't read, change or delete, can't set the database's own columns, length limits hold
select pg_temp.as_anon();
insert into public.contact_messages (name, reach, message, app_version) values ('  Erin ', '', '  Love the app! ', '0.1.0');
insert into public.contact_messages (message) values ('No name, no way to reach me.');
select pg_temp.expect_fail($$select * from public.contact_messages$$);
select pg_temp.expect_fail($$update public.contact_messages set done = true$$);
select pg_temp.expect_fail($$delete from public.contact_messages$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message, done) values ('x', true)$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message, user_id) values ('x', '00000000-0000-0000-0000-000000000031')$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message, created_at) values ('x', now() - interval '2 days')$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message) values ('   ')$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message) values (repeat('a', 2001))$$);
select pg_temp.expect_fail($$insert into public.contact_messages (message, name) values ('x', repeat('a', 81))$$);
select pg_temp.expect_fail($$select * from public.app_admins$$);
reset role;
do $$ begin
  if (select count(*) from public.contact_messages where user_id is null) <> 2 then raise exception 'signed-out messages not saved'; end if;
  if not exists (select 1 from public.contact_messages where name = 'Erin' and message = 'Love the app!' and reach is null and not done) then raise exception 'not tidied'; end if;
end $$;

-- signed in (not admin): sends as themselves (2000 characters is fine), can't read, change, delete or see admins
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
insert into public.contact_messages (message, reach) values (repeat('b', 2000), 'w@example.com');
do $$ begin
  if exists (select 1 from public.contact_messages) then raise exception 'non-admin can read messages'; end if;
  if exists (select 1 from public.app_admins) then raise exception 'non-admin sees an admin row'; end if;
end $$;
update public.contact_messages set done = true;
delete from public.contact_messages;
select pg_temp.expect_fail($$update public.contact_messages set message = 'changed'$$);
select pg_temp.expect_fail($$insert into public.app_admins values ('00000000-0000-0000-0000-000000000031')$$);
select pg_temp.expect_fail($$select private.contact_guard()$$);
reset role;
do $$ begin
  if (select count(*) from public.contact_messages) <> 3 then raise exception 'non-admin changed or deleted messages'; end if;
  if exists (select 1 from public.contact_messages where done) then raise exception 'non-admin marked done'; end if;
  if (select user_id from public.contact_messages where reach = 'w@example.com') <> '00000000-0000-0000-0000-000000000031' then raise exception 'wrong sender'; end if;
end $$;

-- rate limit: a signed-in person gets 5 an hour
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
insert into public.contact_messages (message) values ('2'), ('3'), ('4'), ('5');
select pg_temp.expect_fail($$insert into public.contact_messages (message) values ('6')$$);
reset role;

-- the admin: sees their admin row and every message, marks one done, deletes one, can't edit the text
select pg_temp.as_user('00000000-0000-0000-0000-000000000030');
do $$ begin
  if (select count(*) from public.app_admins) <> 1 then raise exception 'admin cannot see own admin row'; end if;
  if (select count(*) from public.contact_messages) <> 7 then raise exception 'admin cannot read every message'; end if;
end $$;
update public.contact_messages set done = true where name = 'Erin';
delete from public.contact_messages where message = '2';
select pg_temp.expect_fail($$update public.contact_messages set message = 'changed'$$);
reset role;
do $$ begin
  if not (select done from public.contact_messages where name = 'Erin') then raise exception 'admin could not mark done'; end if;
  if exists (select 1 from public.contact_messages where message = '2') then raise exception 'admin could not delete'; end if;
end $$;

-- rate limit: 30 an hour across everyone signed out
select pg_temp.as_anon();
insert into public.contact_messages (message) select 'm' || g from generate_series(1, 28) g;
select pg_temp.expect_fail($$insert into public.contact_messages (message) values ('one too many')$$);
reset role;

delete from public.contact_messages;
delete from public.app_admins where user_id = '00000000-0000-0000-0000-000000000030';
select 'contact_test passed';
