-- PalDex: the pet's household can say thank you for a friend's treat; the giver sees it.
-- Needs the friend treats migration first. Safe to run more than once.
alter table public.friend_treats add column if not exists thanked_at timestamptz;

-- thank whoever gave my pet a treat on that day (only the pet's household can)
create or replace function public.thank_treat(giver uuid, c text, d date) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not private.is_member(c) then raise exception 'not your pet'; end if;
  update public.friend_treats set thanked_at = coalesce(thanked_at, now()) where from_user = giver and cat_id = c and day = d;
end $$;

-- thank-yous for treats I gave in the last 7 days, with the pet's name
create or replace function public.my_thanks() returns table (cat_id text, cat_name text, day date)
language sql stable security definer set search_path = ''
as $$ select t.cat_id, coalesce(k.data->>'name', ''), t.day from public.friend_treats t join public.cats k on k.id = t.cat_id
      where t.from_user = (select auth.uid()) and t.thanked_at is not null and t.thanked_at > now() - interval '7 days'
      order by t.thanked_at desc $$;

revoke all on function public.thank_treat(uuid, text, date), public.my_thanks() from public, anon;
grant execute on function public.thank_treat(uuid, text, date), public.my_thanks() to authenticated;
