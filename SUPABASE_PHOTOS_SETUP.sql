-- Vappie Fotoalbum - eenmalige setup in Supabase SQL Editor
-- Bucket is privé. Alleen ingelogde Supabase-gebruikers van Vappie mogen lezen/schrijven.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vappie-photos',
  'vappie-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vappie photos read authenticated" on storage.objects;
create policy "vappie photos read authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'vappie-photos');

drop policy if exists "vappie photos upload authenticated" on storage.objects;
create policy "vappie photos upload authenticated"
on storage.objects for insert
to authenticated
with check (bucket_id = 'vappie-photos');

drop policy if exists "vappie photos delete authenticated" on storage.objects;
create policy "vappie photos delete authenticated"
on storage.objects for delete
to authenticated
using (bucket_id = 'vappie-photos');
