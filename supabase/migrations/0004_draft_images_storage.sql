-- Run this in the Supabase SQL editor, same as the previous migrations.

insert into storage.buckets (id, name, public)
values ('draft-images', 'draft-images', true)
on conflict (id) do nothing;

create policy "Writers can upload images into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'draft-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Writers can manage their own uploaded images"
  on storage.objects for update
  using (
    bucket_id = 'draft-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Writers can delete their own uploaded images"
  on storage.objects for delete
  using (
    bucket_id = 'draft-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Anyone can view draft images"
  on storage.objects for select
  using (bucket_id = 'draft-images');
