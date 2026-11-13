\set ON_ERROR_STOP on
-- Photo feed and push subscriptions (bundle parts 2 and 3). Run after the bundle; sets up its own people:
-- P (Pia) and M (Max) share a household with Mochi; F (Fen) is Pia's friend with Tofu; S is a stranger.
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  reset role; perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create function pg_temp.expect_fail(q text) returns void language plpgsql as $$ begin
  begin execute q; exception when others then return; end; raise exception 'should have failed: %', q; end $$;
create function pg_temp.n(q text) returns bigint language plpgsql as $$ declare r bigint; begin
  execute 'select count(*) from (' || q || ') x' into r; return r; end $$;
reset role;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000a4') on conflict do nothing;
insert into public.households (id, created_by) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3');
insert into public.household_members (household_id, user_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3') on conflict do nothing;
insert into public.cats (id, data, household_id, created_by) values
  ('pmochi', '{"name":"Mochi"}', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1'),
  ('ptofu', '{"name":"Tofu"}', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3');
insert into public.friends (user_id, friend_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1');

-- Pia posts Mochi (row and file); not as someone else, not for a pet that isn't hers, not outside the pet's folder
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.pet_photos (id, cat_id, path, caption) values ('00000000-0000-0000-0000-0000000000c1', 'pmochi', 'pmochi/1.jpg', 'Sit!');
insert into storage.objects (bucket_id, name) values ('pet-photos', 'pmochi/1.jpg');
select pg_temp.expect_fail($$insert into public.pet_photos (cat_id, path) values ('ptofu', 'ptofu/x.jpg')$$);
select pg_temp.expect_fail($$insert into public.pet_photos (cat_id, path) values ('pmochi', 'ptofu/x.jpg')$$);
select pg_temp.expect_fail($$insert into public.pet_photos (cat_id, path, by_user) values ('pmochi', 'pmochi/x.jpg', '00000000-0000-0000-0000-0000000000a2')$$);
select pg_temp.expect_fail($$insert into storage.objects (bucket_id, name) values ('pet-photos', 'ptofu/x.jpg')$$);
select pg_temp.expect_fail($$insert into public.pet_photos (cat_id, path, caption) values ('pmochi', 'pmochi/2.jpg', repeat('a', 141))$$);
update public.pet_photos set caption = 'Sit, finally!' where id = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.expect_fail($$update public.pet_photos set cat_id = 'ptofu' where id = '00000000-0000-0000-0000-0000000000c1'$$);

-- Fen (friend) sees it in the feed, can paw it once and hide it; can't post, edit or delete it
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  if pg_temp.n('select * from public.photo_feed()') <> 1 then raise exception 'friend does not see the photo'; end if;
  if pg_temp.n($q$select * from storage.objects where bucket_id = 'pet-photos'$q$) <> 1 then raise exception 'friend cannot read the file'; end if;
  insert into public.photo_reactions (photo_id) values ('00000000-0000-0000-0000-0000000000c1');
  if (select paws from public.photo_feed()) <> 1 or not (select pawed from public.photo_feed()) then raise exception 'paw not counted'; end if;
  update public.pet_photos set caption = 'mine now' where id = '00000000-0000-0000-0000-0000000000c1';
  if found then raise exception 'friend edited the caption'; end if;
  delete from public.pet_photos where id = '00000000-0000-0000-0000-0000000000c1';
  if found then raise exception 'friend deleted the photo'; end if;
  delete from storage.objects where bucket_id = 'pet-photos';
  if found then raise exception 'friend deleted the file'; end if;
  insert into public.photo_hides (photo_id) values ('00000000-0000-0000-0000-0000000000c1');
  if pg_temp.n('select * from public.photo_feed()') <> 0 then raise exception 'hidden photo still in the feed'; end if;
  delete from public.photo_hides;
end $$;
select pg_temp.expect_fail($$insert into public.photo_reactions (photo_id) values ('00000000-0000-0000-0000-0000000000c1')$$);
select pg_temp.expect_fail($$insert into public.pet_photos (cat_id, path) values ('pmochi', 'pmochi/f.jpg')$$);

-- Max (household) sees the paw and Fen's hide stays private; the stranger sees nothing and can't paw or hide
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  if (select paws from public.photo_feed()) <> 1 then raise exception 'household does not see the paw'; end if;
  if pg_temp.n('select * from public.photo_hides') <> 0 then raise exception 'sees someone else''s hides'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  if pg_temp.n('select * from public.pet_photos') + pg_temp.n('select * from public.photo_reactions')
     + pg_temp.n($q$select * from storage.objects where bucket_id = 'pet-photos'$q$) <> 0 then raise exception 'stranger sees photos'; end if;
end $$;
select pg_temp.expect_fail($$insert into public.photo_reactions (photo_id) values ('00000000-0000-0000-0000-0000000000c1')$$);
select pg_temp.expect_fail($$insert into public.photo_hides (photo_id) values ('00000000-0000-0000-0000-0000000000c1')$$);

-- unfriending hides the photo from Fen at once (file included)
reset role;
delete from public.friends where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3')
  and friend_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  if pg_temp.n('select * from public.photo_feed()') + pg_temp.n($q$select * from storage.objects where bucket_id = 'pet-photos'$q$) <> 0
    then raise exception 'ex-friend still sees the photo'; end if;
end $$;

-- Max (household, not the poster) can delete it; the paw goes with it
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  delete from public.pet_photos where id = '00000000-0000-0000-0000-0000000000c1';
  if not found then raise exception 'household cannot delete'; end if;
  delete from storage.objects where bucket_id = 'pet-photos' and name = 'pmochi/1.jpg';
  if not found then raise exception 'household cannot delete the file'; end if;
end $$;
reset role;
do $$ begin if exists (select 1 from public.photo_reactions) then raise exception 'paw left behind'; end if; end $$;
do $$ begin if (select public from storage.buckets where id = 'pet-photos') then raise exception 'pet-photos is public'; end if; end $$;

-- push subscriptions: saved through the function, each person sees only their own; a phone moves to whoever signs in
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.save_push_subscription('https://push.example/abc', 'key', 'auth', 'iPhone');
select pg_temp.expect_fail($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/x', 'k', 'a')$$);
select pg_temp.expect_fail($$select public.save_push_subscription('http://insecure.example/x', 'k', 'a')$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  if pg_temp.n('select * from public.push_subscriptions') <> 0 then raise exception 'sees someone else''s subscription'; end if;
  delete from public.push_subscriptions;
  if found then raise exception 'deleted someone else''s subscription'; end if;
  perform public.save_push_subscription('https://push.example/abc', 'key2', 'auth2');
  if pg_temp.n('select * from public.push_subscriptions') <> 1 then raise exception 'phone did not move to the new person'; end if;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin if pg_temp.n('select * from public.push_subscriptions') <> 0 then raise exception 'old person still gets the phone'; end if; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ begin delete from public.push_subscriptions; if not found then raise exception 'cannot remove my own'; end if; end $$;
reset role;
