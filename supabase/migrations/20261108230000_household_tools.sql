-- PalDex: see who trains a cat (with their email) and remove someone, e.g. a duplicate sign-up.

-- Everyone on a cat, with their email and how many sets they logged. Only members can call it for their cat.
create or replace function public.cat_people(c text)
returns table (user_id uuid, display_name text, email text, joined_at timestamptz, sets_logged bigint, is_owner boolean)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, m.display_name, u.email::text, m.joined_at,
         (select count(*) from public.sets s where s.cat_id = c and s.by_user = m.user_id),
         m.user_id = k.created_by
  from public.cat_members m
  join auth.users u on u.id = m.user_id
  join public.cats k on k.id = m.cat_id
  where m.cat_id = c and private.is_member(c)
  order by m.joined_at
$$;
revoke all on function public.cat_people(text) from public, anon;
grant execute on function public.cat_people(text) to authenticated;

-- Leave a cat yourself, or (as the person who set it up) remove someone else. Their past sets stay.
grant delete on public.cat_members to authenticated;
drop policy if exists "leave or remove from a cat" on public.cat_members;
create policy "leave or remove from a cat" on public.cat_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.cats k where k.id = cat_id and k.created_by = (select auth.uid())));
