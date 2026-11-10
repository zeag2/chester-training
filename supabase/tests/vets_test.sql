\set ON_ERROR_STOP on
-- run after the vets migration. J and K each set up a household; K must not see or touch J's vets.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-000000000021'), ('00000000-0000-0000-0000-000000000022') on conflict do nothing;
create table public._h (who text primary key, id uuid); grant select, insert on public._h to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-000000000021');
insert into public.households default values;
insert into public._h select 'j', household_id from public.household_members where user_id = '00000000-0000-0000-0000-000000000021';
insert into public.vets (id, household_id, updated_at, data) values ('v1', (select id from public._h where who = 'j'), 1, '{"clinic":"Maple Street Vet","phone":"555-0100","kind":"primary"}');
update public.vets set data = data || '{"vetName":"Dr. Patel"}', updated_at = 2 where id = 'v1';
do $$ begin
  if (select data->>'vetName' from public.vets where id = 'v1') <> 'Dr. Patel' then raise exception 'edit lost'; end if;
  if (select by_user from public.vets where id = 'v1') <> '00000000-0000-0000-0000-000000000021' then raise exception 'by_user not set'; end if;
end $$;
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
insert into public.households default values;
do $$ begin if (select count(*) from public.vets) <> 0 then raise exception 'stranger sees vets'; end if; end $$;
select pg_temp.expect_fail($$insert into public.vets (id, household_id, updated_at, data) values ('v2', (select id from public._h where who = 'j'), 1, '{}')$$);
update public.vets set deleted = true where id = 'v1';
reset role;
do $$ begin if (select deleted from public.vets where id = 'v1') then raise exception 'stranger edited a vet'; end if; end $$;

set role anon;
select pg_temp.expect_fail($$select * from public.vets$$);
reset role;
drop table public._h;
select 'vets_test passed';
