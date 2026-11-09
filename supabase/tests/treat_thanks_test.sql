\set ON_ERROR_STOP on
-- run after friend_treats_test.sql and the treat thanks migration. Gail owns Pip; Hana gave Pip treats; K is a stranger.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
reset role;
insert into public.friend_treats (from_user, cat_id, day) values ('00000000-0000-0000-0000-000000000072', 'pip', current_date) on conflict do nothing;
-- Hana sees no thanks yet; she can't thank for her own gift (not her pet)
select pg_temp.as_user('00000000-0000-0000-0000-000000000072');
do $$ begin if (select count(*) from public.my_thanks()) <> 0 then raise exception 'thanks before any'; end if; end $$;
select pg_temp.expect_fail($$select public.thank_treat('00000000-0000-0000-0000-000000000072', 'pip', current_date)$$);
reset role;
-- a stranger can't thank either
select pg_temp.as_user('00000000-0000-0000-0000-000000000073');
select pg_temp.expect_fail($$select public.thank_treat('00000000-0000-0000-0000-000000000072', 'pip', current_date)$$);
reset role;
-- Gail thanks Hana for today's treat (twice is fine)
select pg_temp.as_user('00000000-0000-0000-0000-000000000071');
select public.thank_treat('00000000-0000-0000-0000-000000000072', 'pip', current_date);
select public.thank_treat('00000000-0000-0000-0000-000000000072', 'pip', current_date);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-000000000072');
do $$ begin
  if (select count(*) from public.my_thanks()) <> 1 then raise exception 'thanks not seen'; end if;
  if (select cat_name from public.my_thanks()) <> 'Pip' then raise exception 'wrong name'; end if;
end $$;
reset role;
set role anon;
select pg_temp.expect_fail($$select * from public.my_thanks()$$);
reset role;
select 'treat_thanks_test passed';
