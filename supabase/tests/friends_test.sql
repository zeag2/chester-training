\set ON_ERROR_STOP on
-- run after the friends migration. D and E are new people; E has a household with a pet; C is a stranger.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-00000000000d'), ('00000000-0000-0000-0000-00000000000e') on conflict do nothing;
create table public._codes (who text primary key, code text); grant select, insert on public._codes to authenticated;

-- E sets up a household with Mochi and publishes Mochi's card; E's code is made on first use
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
insert into public.households default values;
insert into public.cats (id, data, household_id) values ('mochi', '{"name":"Mochi","coat":"orange","eyes":"green","microchip":"985112345","carry":{"treats":9}}',
  (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-00000000000e'));
select public.set_pet_card('mochi', '{"mastered":["clicker"],"streak":3,"wear":"crown"}');
insert into public._codes values ('e', public.my_friend_code('Erin'));
reset role;

-- D adds E by code (any case, spaces): both are friends; D sees Mochi's card and look, not her private record
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ declare nm text; c jsonb; begin
  perform public.my_friend_code('Dana');
  if public.add_friend('nope') is not null then raise exception 'wrong code accepted'; end if;
  if public.add_friend(public.my_friend_code()) is not null then raise exception 'befriended myself'; end if;
  nm := public.add_friend(' ' || lower((select code from public._codes where who = 'e')) || ' ');
  if nm is distinct from 'Erin' then raise exception 'add_friend returned %', nm; end if;
  if (select count(*) from public.my_friends()) <> 1 then raise exception 'friend not listed'; end if;
  select card into c from public.friend_pets() where cat_id = 'mochi';
  if c is null then raise exception 'friend cannot see pet card'; end if;
  if c->>'name' <> 'Mochi' or c->>'coat' <> 'orange' or c->>'wear' <> 'crown' or (c->>'streak')::int <> 3 then raise exception 'card wrong: %', c; end if;
  if c ? 'microchip' or c ? 'carry' then raise exception 'private fields leaked: %', c; end if;
  if (select count(*) from public.cats where id = 'mochi') <> 0 then raise exception 'friend can read the pet record'; end if;
  if (select count(*) from public.sets where cat_id = 'mochi') <> 0 then raise exception 'friend can read sets'; end if;
end $$;
select pg_temp.expect_fail($$select public.set_pet_card('mochi', '{"streak":99}')$$);
reset role;

-- E sees D as a friend too (both ways)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin
  if (select name from public.my_friends()) <> 'Dana' then raise exception 'friendship not both ways'; end if;
  if (select count(*) from public.friend_pets() where cat_id = 'mochi') <> 0 then raise exception 'own pet listed as a friend''s'; end if;
  if (select count(*) from public.friend_profiles) <> 1 then raise exception 'can read other people''s codes'; end if;
end $$;
reset role;

-- a stranger sees nothing and can't read codes
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from public.friend_pets()) <> 0 then raise exception 'stranger sees friend pets'; end if;
  if (select count(*) from public.friend_profiles) <> 0 then raise exception 'stranger reads codes'; end if;
end $$;
select pg_temp.expect_fail($$insert into public.friends values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000e')$$);
reset role;

-- D removes E: gone both ways
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.remove_friend('00000000-0000-0000-0000-00000000000e');
do $$ begin if (select count(*) from public.friend_pets()) <> 0 then raise exception 'still see pets after unfriending'; end if; end $$;
reset role;
do $$ begin if (select count(*) from public.friends) <> 0 then raise exception 'friendship not removed both ways'; end if; end $$;
drop table public._codes;
select 'friends_test passed';
