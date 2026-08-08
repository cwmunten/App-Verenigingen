insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('vappie-photoalbum','vappie-photoalbum',false,5242880,array['image/jpeg','image/png','image/webp','image/heic','image/heif']) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "vappie photoalbum lezen" on storage.objects;
create policy "vappie photoalbum lezen" on storage.objects for select to authenticated using (bucket_id='vappie-photoalbum');
drop policy if exists "vappie photoalbum uploaden" on storage.objects;
create policy "vappie photoalbum uploaden" on storage.objects for insert to authenticated with check (bucket_id='vappie-photoalbum');


drop policy if exists "vappie photoalbum verwijderen" on storage.objects;
create policy "vappie photoalbum verwijderen"
on storage.objects for delete
to authenticated
using (bucket_id = 'vappie-photoalbum');
