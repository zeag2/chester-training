-- PalDex: "Delete my account" (2026-11-23). Safe to run more than once.
--
-- What deleting an account does, server side (the app removes the storage files first; see below):
--   * pets the person shares with someone else stay with them; any the person set up are handed to the longest-standing
--     other member (cats.created_by cascades on a user delete, so without the handover shared pets would vanish);
--   * pets nobody else can reach are deleted, with their logs, sets, documents and photos rows;
--   * a household the person set up is handed over the same way, or deleted when nobody else is in it;
--   * their training sets on pets that stay are kept without a name (like health logs and vets already are), their own
--     photos rows go, and everything else that is theirs goes with the auth user (memberships, friends, requests, treats,
--     paws, hides, push subscriptions and settings: all `on delete cascade`).
--
-- Storage: Supabase refuses direct deletes from storage.objects in SQL, so the app asks
-- `account_deletion_preview()` for the files, removes them through the Storage API while it is still a member (the
-- delete policies need membership), then calls `delete_my_account()`.

-- 1. training sets on shared pets outlive the person who logged them (care and vets already do: `on delete set null`)
alter table public.sets alter column by_user drop not null;
alter table public.sets drop constraint if exists sets_by_user_fkey;
alter table public.sets add constraint sets_by_user_fkey foreign key (by_user) references auth.users (id) on delete set null;

-- 2. who keeps a pet when `leaving` goes: the longest-standing other person in its household (or, for a pet not in a
--    household yet, on the pet itself). Null when nobody else has it.
create or replace function private.pet_heir(c text, leaving uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select m.user_id from public.cats k join public.household_members m on m.household_id = k.household_id
      where k.id = c and m.user_id <> leaving order by m.joined_at, m.user_id limit 1),
    (select m.user_id from public.cats k join public.cat_members m on m.cat_id = k.id
      where k.id = c and k.household_id is null and m.user_id <> leaving order by m.joined_at, m.user_id limit 1))
$$;
revoke all on function private.pet_heir(text, uuid) from public, anon, authenticated;

-- the pets a person is involved in: every pet they can reach, plus any they set up
create or replace function private.my_pets(u uuid) returns table (id text, name text, created_by uuid, heir uuid)
language sql stable security definer set search_path = ''
as $$
  select k.id, coalesce(k.data ->> 'name', ''), k.created_by, private.pet_heir(k.id, u)
  from public.cats k
  where k.created_by = u
     or exists (select 1 from public.household_members m where m.household_id = k.household_id and m.user_id = u)
     or (k.household_id is null and exists (select 1 from public.cat_members m where m.cat_id = k.id and m.user_id = u))
$$;
revoke all on function private.my_pets(uuid) from public, anon, authenticated;

-- 3. what deleting my account would do, for the confirm screen and the files the app must remove first:
--    { "deleted": [{id, name}], "kept": [{id, name, keeper}], "files": [{bucket, path}] }
create or replace function public.account_deletion_preview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first'; end if;
  return jsonb_build_object(
    'deleted', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
                         from private.my_pets(uid) p where p.heir is null), '[]'::jsonb),
    'kept', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
                        'keeper', coalesce((select nullif(m.display_name, '') from public.household_members m
                                            join public.cats k on k.household_id = m.household_id
                                            where k.id = p.id and m.user_id = p.heir limit 1), ''))
                        order by p.name)
                      from private.my_pets(uid) p where p.heir is not null), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.path) order by f.bucket, f.path) from (
        -- everything stored for pets that go
        select o.bucket_id as bucket, o.name as path from storage.objects o
          where o.bucket_id in ('pet-docs', 'pet-photos')
            and (storage.foldername(o.name))[1] in (select p.id from private.my_pets(uid) p where p.heir is null)
        union
        -- my photos of pets that stay
        select 'pet-photos', ph.path from public.pet_photos ph
          where ph.by_user = uid and ph.cat_id in (select p.id from private.my_pets(uid) p where p.heir is not null)
      ) f), '[]'::jsonb));
end $$;
revoke all on function public.account_deletion_preview() from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;

-- 4. delete the signed-in account. Hands over or deletes pets and households, then deletes the auth user (which
--    cascades the rest). Only ever acts on the caller.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid(); p record; h record; heir uuid;
begin
  if uid is null then raise exception 'sign in first'; end if;
  for p in select * from private.my_pets(uid) loop
    if p.heir is null then delete from public.cats where id = p.id;
    elsif p.created_by = uid then update public.cats set created_by = p.heir where id = p.id;
    end if;
  end loop;
  for h in select x.id from public.households x
           where x.created_by = uid or exists (select 1 from public.household_members m where m.household_id = x.id and m.user_id = uid) loop
    select m.user_id into heir from public.household_members m where m.household_id = h.id and m.user_id <> uid
      order by m.joined_at, m.user_id limit 1;
    if heir is null then delete from public.households where id = h.id;
    else update public.households set created_by = heir where id = h.id and created_by = uid;
    end if;
  end loop;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
