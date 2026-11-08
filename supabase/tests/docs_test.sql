\set ON_ERROR_STOP on
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('pet-docs', 'chester/d1.pdf');
insert into public.care (id, cat_id, kind, at, updated_at, data) values ('d1', 'chester', 'doc', 1, 1, '{"title":"Invoice"}');
select pg_temp.expect_fail($q$ insert into storage.objects (bucket_id, name) values ('pet-docs', 'someone-else/x.pdf') $q$);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin if (select count(*) from storage.objects) <> 1 then raise exception 'member cannot see doc'; end if; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if (select count(*) from storage.objects) <> 0 then raise exception 'stranger can see doc'; end if;
  delete from storage.objects; if found then raise exception 'stranger deleted doc'; end if;
end $$;
reset role;
select 'ALL DOC CHECKS PASSED' as result;
