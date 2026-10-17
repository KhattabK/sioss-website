-- SJSS manuscript uploads (course project pawvtskgquzydpppjbcd).
-- Private bucket: authors can only upload a PDF into a folder named after their order number (SJSS-XXXXXXXX);
-- nobody can list or download through the public API. The editors open the files in Dashboard → Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sjss-submissions', 'sjss-submissions', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sjss upload only" on storage.objects;
create policy "sjss upload only" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'sjss-submissions'
    and (storage.foldername(name))[1] ~ '^SJSS-[A-Z0-9]{8}$'
  );
