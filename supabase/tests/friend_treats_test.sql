\set ON_ERROR_STOP on
-- run after the friend_treats migration (stubs, then all migrations). Sets up its own people:
-- G (Gail) has Pip; H (Hana) has Bean and is Gail's friend; K is a stranger.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-000000000071'), ('00000000-0000-0000-0000-000000000072'), ('00000000-0000-0000-0000-000000000073') on conflict do nothing;
create table public._codes (who text primary key, code text); grant select, insert on public._codes to authenticated;

-- Gail: a household with Pip, and a friend code
select pg_temp.as_user('00000000-0000-0000-0000-000000000071');
insert into public.households default values;
insert into public.cats (id, data, household_id) values ('pip', '{"name":"Pip"}',
  (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-000000000071'));
insert into public._codes values ('g', public.my_friend_code('Gail'));
reset role;

-- Hana: a household with Bean; adds Gail
select pg_temp.as_user('00000000-0000-0000-0000-000000000072');
insert into public.households default values;
insert into public.cats (id, data, household_id) values ('bean', '{"name":"Bean"}',
  (select household_id from public.household_members where user_id = '00000000-0000-0000-0000-000000000072'));
do $$ begin
  perform public.my_friend_code('Hana');
  if public.add_friend((select code from public._codes where who = 'g')) is distinct from 'Gail' then raise exception 'could not add Gail'; end if;
  -- a treat for a friend's pet, once a day
  if public.give_treat('pip', current_date) is not true then raise exception 'treat not given'; end if;
  if public.give_treat('pip', current_date) is not false then raise exception 'second treat the same day'; end if;
  if public.give_treat('pip', current_date - 1) is not true then raise exception 'yesterday (another time zone) refused'; end if;
  if (select array_agg(g) from public.treats_given(current_date) g) <> array['pip'] then raise exception 'treats_given wrong'; end if;
  -- the giver can't read the pet's treat list
  if (select count(*) from public.treats_for('pip')) <> 0 then raise exception 'giver reads the pet''s treats'; end if;
end $$;
-- not for my own pet, not for days far away, not for a pet that doesn't exist, and no direct table access
select pg_temp.expect_fail($$select public.give_treat('bean', current_date)$$);
select pg_temp.expect_fail($$select public.give_treat('pip', current_date + 5)$$);
select pg_temp.expect_fail($$select public.give_treat('pip', current_date - 9)$$);
select pg_temp.expect_fail($$select public.give_treat('nobody', current_date)$$);
select pg_temp.expect_fail($$select * from public.friend_treats$$);
select pg_temp.expect_fail($$insert into public.friend_treats (cat_id, day) values ('pip', current_date + 3)$$);
reset role;

-- Gail (Pip's household) sees who gave Pip treats, with names
select pg_temp.as_user('00000000-0000-0000-0000-000000000071');
do $$ begin
  if (select count(*) from public.treats_for('pip')) <> 2 then raise exception 'owner does not see the treats'; end if;
  if exists (select 1 from public.treats_for('pip') where from_name <> 'Hana' or from_user <> '00000000-0000-0000-0000-000000000072') then raise exception 'giver wrong'; end if;
  -- Gail can treat Hana's Bean (friends both ways), not her own Pip
  if public.give_treat('bean', current_date) is not true then raise exception 'friendship not both ways for treats'; end if;
end $$;
select pg_temp.expect_fail($$select public.give_treat('pip', current_date)$$);
reset role;

-- a stranger can't give or read
select pg_temp.as_user('00000000-0000-0000-0000-000000000073');
select pg_temp.expect_fail($$select public.give_treat('pip', current_date)$$);
do $$ begin if (select count(*) from public.treats_for('pip')) <> 0 then raise exception 'stranger reads treats'; end if; end $$;
reset role;

-- signed out (anon) can't call the functions at all
set role anon;
select pg_temp.expect_fail($$select public.give_treat('pip', current_date)$$);
select pg_temp.expect_fail($$select * from public.treats_for('pip')$$);
reset role;

-- after unfriending, no more treats
select pg_temp.as_user('00000000-0000-0000-0000-000000000072');
select public.remove_friend('00000000-0000-0000-0000-000000000071');
select pg_temp.expect_fail($$select public.give_treat('pip', current_date + 1)$$);
reset role;
drop table public._codes;
select 'friend_treats_test passed';
