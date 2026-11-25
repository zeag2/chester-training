\set ON_ERROR_STOP on
-- run after 20261124000000_delete_account.sql (any time after the bundle; it sets up its own people: Sam, Tia, Uma).
-- Sam set up a household with Tia (pet Pip) and joined Tia's household (pet Tot). Uma has a pet of her own (Ula).
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into auth.users values ('00000000-0000-0000-0000-000000000030'), ('00000000-0000-0000-0000-000000000031'), ('00000000-0000-0000-0000-000000000032') on conflict do nothing;
insert into public.households (id, created_by) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000030'),  -- Sam's (trigger adds Sam)
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000031'),  -- Tia's
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000032');  -- Uma's
insert into public.household_members (household_id, user_id, display_name, joined_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000031', 'Tia', now() + interval '1 minute'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000030', 'Sam', now() + interval '1 minute');
insert into public.cats (id, data, created_by, household_id) values
  ('dpip', '{"name":"Pip"}', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-0000000000a1'),
  ('dtot', '{"name":"Tot"}', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-0000000000a2'),
  ('dula', '{"name":"Ula"}', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-0000000000a3');
insert into public.sets (id, cat_id, at, data, by_user) values
  ('dps', 'dpip', 1, '{}', '00000000-0000-0000-0000-000000000030'), ('dts', 'dtot', 1, '{}', '00000000-0000-0000-0000-000000000031'),
  ('dus', 'dula', 1, '{}', '00000000-0000-0000-0000-000000000032');
insert into public.pet_photos (cat_id, path, by_user) values
  ('dpip', 'dpip/sam.jpg', '00000000-0000-0000-0000-000000000030'), ('dpip', 'dpip/tia.jpg', '00000000-0000-0000-0000-000000000031'),
  ('dtot', 'dtot/sam.jpg', '00000000-0000-0000-0000-000000000030'), ('dula', 'dula/uma.jpg', '00000000-0000-0000-0000-000000000032');
insert into storage.objects (bucket_id, name) values ('pet-photos', 'dpip/sam.jpg'), ('pet-photos', 'dpip/tia.jpg'),
  ('pet-photos', 'dtot/sam.jpg'), ('pet-photos', 'dula/uma.jpg'), ('pet-docs', 'dula/x/bill.pdf'), ('pet-docs', 'dpip/x/vax.pdf');

-- signed out: neither function runs
set role anon;
select pg_temp.expect_fail($$select public.account_deletion_preview()$$);
select pg_temp.expect_fail($$select public.delete_my_account()$$);
reset role;
-- nobody can call the helpers directly
select pg_temp.as_user('00000000-0000-0000-0000-000000000030');
select pg_temp.expect_fail($$select private.pet_heir('dula', '00000000-0000-0000-0000-000000000032')$$);
select pg_temp.expect_fail($$select * from private.my_pets('00000000-0000-0000-0000-000000000032')$$);

-- Sam's preview: both pets stay (Pip with Tia), and only Sam's own photos are to be removed
do $$ declare p jsonb := public.account_deletion_preview(); begin
  if jsonb_array_length(p -> 'deleted') <> 0 then raise exception 'shared pets would be deleted: %', p; end if;
  if (select array_agg(x ->> 'name' order by x ->> 'name') from jsonb_array_elements(p -> 'kept') x) <> array['Pip', 'Tot'] then raise exception 'kept: %', p; end if;
  if (select x ->> 'keeper' from jsonb_array_elements(p -> 'kept') x where x ->> 'id' = 'dpip') <> 'Tia' then raise exception 'keeper: %', p; end if;
  if (select array_agg(x ->> 'path' order by x ->> 'path') from jsonb_array_elements(p -> 'files') x) <> array['dpip/sam.jpg', 'dtot/sam.jpg'] then raise exception 'files: %', p; end if;
end $$;
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000030') then raise exception 'user not deleted'; end if;
  if (select created_by from public.cats where id = 'dpip') <> '00000000-0000-0000-0000-000000000031' then raise exception 'Pip not handed to Tia'; end if;
  if (select created_by from public.households where id = '00000000-0000-0000-0000-0000000000a1') <> '00000000-0000-0000-0000-000000000031' then raise exception 'household not handed to Tia'; end if;
  if (select count(*) from public.cats where id in ('dpip', 'dtot')) <> 2 then raise exception 'shared pets lost'; end if;
  if (select by_user from public.sets where id = 'dps') is not null then raise exception 'Sam''s set on Pip not kept anonymously'; end if;
  if exists (select 1 from public.pet_photos where by_user = '00000000-0000-0000-0000-000000000030') then raise exception 'Sam''s photos rows left'; end if;
  if not exists (select 1 from public.pet_photos where path = 'dpip/tia.jpg') then raise exception 'Tia''s photo lost'; end if;
  if exists (select 1 from public.household_members where user_id = '00000000-0000-0000-0000-000000000030') then raise exception 'memberships left'; end if;
end $$;
-- Tia still sees and runs both pets
select pg_temp.as_user('00000000-0000-0000-0000-000000000031');
do $$ begin
  if (select count(*) from public.cats where id in ('dpip', 'dtot')) <> 2 then raise exception 'Tia lost a pet'; end if;
  update public.cats set data = data where id = 'dpip';
  if not found then raise exception 'Tia cannot update Pip'; end if;
  if (select count(*) from public.sets where cat_id = 'dpip') <> 1 then raise exception 'Tia lost Pip''s history'; end if;
end $$;
reset role;

-- Uma alone: her pet goes, with everything stored for it; Tia's things are untouched
select pg_temp.as_user('00000000-0000-0000-0000-000000000032');
do $$ declare p jsonb := public.account_deletion_preview(); begin
  if (p -> 'deleted' -> 0 ->> 'name') <> 'Ula' or jsonb_array_length(p -> 'kept') <> 0 then raise exception 'Uma preview: %', p; end if;
  if (select array_agg(x ->> 'bucket' || ':' || (x ->> 'path') order by x ->> 'path') from jsonb_array_elements(p -> 'files') x)
     <> array['pet-photos:dula/uma.jpg', 'pet-docs:dula/x/bill.pdf'] then raise exception 'Uma files: %', p; end if;
end $$;
select public.delete_my_account();
reset role;
do $$ begin
  if exists (select 1 from public.cats where id = 'dula') or exists (select 1 from public.sets where id = 'dus') then raise exception 'Ula not deleted'; end if;
  if exists (select 1 from public.households where id = '00000000-0000-0000-0000-0000000000a3') then raise exception 'empty household left'; end if;
  if not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000031') then raise exception 'Tia deleted too'; end if;
  if (select count(*) from public.cats where id in ('dpip', 'dtot')) <> 2 then raise exception 'other pets touched'; end if;
end $$;
delete from storage.objects where name like 'd%/%' and bucket_id in ('pet-photos', 'pet-docs');
