-- PalDex: friend requests. Entering someone's code now sends them a request ("Accept Erin?") instead of making you
-- friends straight away. If they had already sent you one, entering their code accepts it.
-- A declined request stays (quietly): the sender still sees it as waiting, and sending again doesn't ask twice.
-- Existing friendships are untouched. add_friend keeps its name and signature (older app versions call it) but now
-- sends a request too, so no version of the app can skip the "Accept?" step.
-- Run after 20261110000000_friends.sql. Safe to run more than once.

create table if not exists public.friend_requests (
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  declined_at timestamptz,
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_user);
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;
-- everything goes through the functions below

-- send a request by code (or accept theirs if they already asked):
-- {"name": "Erin", "status": "friends" | "sent" | "already"}, or null when the code is wrong or it's your own
create or replace function public.request_friend(code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); them uuid; nm text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select user_id, display_name into them, nm from public.friend_profiles where friend_code = upper(trim(code));
  if them is null or them = me then return null; end if;
  nm := coalesce(nm, '');
  if exists (select 1 from public.friends where user_id = me and friend_id = them) then
    return jsonb_build_object('name', nm, 'status', 'already');
  end if;
  if exists (select 1 from public.friend_requests where from_user = them and to_user = me) then
    insert into public.friends (user_id, friend_id) values (me, them), (them, me) on conflict do nothing;
    delete from public.friend_requests where (from_user = them and to_user = me) or (from_user = me and to_user = them);
    return jsonb_build_object('name', nm, 'status', 'friends');
  end if;
  if (select count(*) from public.friend_requests where from_user = me and declined_at is null) >= 30 then
    raise exception 'too many requests';
  end if;
  insert into public.friend_requests (from_user, to_user) values (me, them) on conflict do nothing;
  return jsonb_build_object('name', nm, 'status', 'sent');
end $$;

-- older app versions: same name and result as before (their name, or null), but it only sends a request now
create or replace function public.add_friend(code text) returns text
language plpgsql security definer set search_path = ''
as $$
declare r jsonb := public.request_friend(code);
begin return r->>'name'; end $$;

-- requests waiting on me (incoming) and mine waiting on them (outgoing; a declined one still shows as waiting)
create or replace function public.friend_requests() returns table (user_id uuid, name text, incoming boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.from_user, coalesce(p.display_name, ''), true, r.created_at from public.friend_requests r
    left join public.friend_profiles p on p.user_id = r.from_user
    where r.to_user = (select auth.uid()) and r.declined_at is null
  union all
  select r.to_user, coalesce(p.display_name, ''), false, r.created_at from public.friend_requests r
    left join public.friend_profiles p on p.user_id = r.to_user
    where r.from_user = (select auth.uid())
  order by 4
$$;

-- accept (friends both ways) or decline (kept, quietly) a request someone sent me; false when there's no such request
create or replace function public.answer_friend_request(requester uuid, accept boolean) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.friend_requests where from_user = requester and to_user = me) then return false; end if;
  if accept then
    insert into public.friends (user_id, friend_id) values (me, requester), (requester, me) on conflict do nothing;
    delete from public.friend_requests where (from_user = requester and to_user = me) or (from_user = me and to_user = requester);
  else
    update public.friend_requests set declined_at = now() where from_user = requester and to_user = me;
  end if;
  return true;
end $$;

-- take back a request I sent
create or replace function public.cancel_friend_request(target uuid) returns void
language sql security definer set search_path = ''
as $$ delete from public.friend_requests where from_user = (select auth.uid()) and to_user = target $$;

-- removing a friend also clears any requests between you, so either can ask again later
create or replace function public.remove_friend(friend uuid) returns void
language sql security definer set search_path = ''
as $$
  delete from public.friends where (user_id = (select auth.uid()) and friend_id = friend) or (user_id = friend and friend_id = (select auth.uid()));
  delete from public.friend_requests where (from_user = (select auth.uid()) and to_user = friend) or (from_user = friend and to_user = (select auth.uid()));
$$;

-- signed-in people only
revoke all on function public.request_friend(text), public.add_friend(text), public.friend_requests(), public.answer_friend_request(uuid, boolean), public.cancel_friend_request(uuid), public.remove_friend(uuid) from public, anon;
grant execute on function public.request_friend(text), public.add_friend(text), public.friend_requests(), public.answer_friend_request(uuid, boolean), public.cancel_friend_request(uuid), public.remove_friend(uuid) to authenticated;
