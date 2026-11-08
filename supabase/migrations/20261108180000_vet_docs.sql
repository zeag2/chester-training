-- PalDex: vet documents. Files live in a private bucket under <cat id>/<doc id>.<ext>; only the cat's members can touch them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pet-docs', 'pet-docs', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "members read pet docs" on storage.objects;
drop policy if exists "members add pet docs" on storage.objects;
drop policy if exists "members replace pet docs" on storage.objects;
drop policy if exists "members remove pet docs" on storage.objects;
create policy "members read pet docs" on storage.objects for select to authenticated
  using (bucket_id = 'pet-docs' and private.is_member((storage.foldername(name))[1]));
create policy "members add pet docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-docs' and private.is_member((storage.foldername(name))[1]));
create policy "members replace pet docs" on storage.objects for update to authenticated
  using (bucket_id = 'pet-docs' and private.is_member((storage.foldername(name))[1]))
  with check (bucket_id = 'pet-docs' and private.is_member((storage.foldername(name))[1]));
create policy "members remove pet docs" on storage.objects for delete to authenticated
  using (bucket_id = 'pet-docs' and private.is_member((storage.foldername(name))[1]));

-- documents are care items too
alter table public.care drop constraint if exists care_kind_check;
alter table public.care add constraint care_kind_check check (kind in ('food', 'vet', 'symptom', 'weight', 'groom', 'med', 'doc'));
