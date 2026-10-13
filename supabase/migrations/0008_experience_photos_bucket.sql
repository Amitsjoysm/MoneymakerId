-- 0008_experience_photos_bucket: the private experience-photos storage bucket and its policies.
-- CONTRACTS section 5: only service_role can read and write it.
-- Owner: T02a.
--
-- service_role has BYPASSRLS, so its policy is documentation as much as access. What matters is that
-- anon and authenticated get nothing: storage.objects has RLS on and they have no permissive policy,
-- and a RESTRICTIVE policy keeps it that way even if someone later adds a broad permissive one.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experience-photos',
  'experience-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "experience-photos: service_role only"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'experience-photos')
  with check (bucket_id = 'experience-photos');

create policy "experience-photos: never anon or authenticated"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'experience-photos')
  with check (bucket_id <> 'experience-photos');
