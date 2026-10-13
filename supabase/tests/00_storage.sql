-- T02a: the private experience-photos bucket (CONTRACTS section 5): only service_role can read and write it.
-- 42501 = insufficient privilege / row level security violation.
begin;
select plan(21);

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from storage.buckets where id = 'experience-photos'),
  1,
  'the experience-photos bucket exists');
select is(
  (select public from storage.buckets where id = 'experience-photos'),
  false,
  'the bucket is private');
select is(
  (select name from storage.buckets where id = 'experience-photos'),
  'experience-photos',
  'the bucket name matches its id');
select is(
  (select file_size_limit from storage.buckets where id = 'experience-photos'),
  10485760::bigint,
  'the bucket limits an upload to 10 MiB');
select is(
  (select allowed_mime_types from storage.buckets where id = 'experience-photos'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'the bucket accepts only jpeg, png and webp');
select is(
  (select count(*)::int from storage.buckets where public),
  0,
  'no bucket in this project is public');

-- ---------------------------------------------------------------------------
-- Policies on storage.objects
-- ---------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'row level security is on for storage.objects');
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and permissive = 'PERMISSIVE'
      and roles && array['public', 'anon', 'authenticated']::name[]),
  0,
  'no permissive policy on storage.objects reaches public, anon or authenticated');
select is(
  (select roles::text[] from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'experience-photos: service_role only'),
  array['service_role'],
  'the permissive policy is for service_role only');
select is(
  (select cmd from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'experience-photos: service_role only'),
  'ALL',
  'service_role may read, write, update and delete');
select is(
  (select permissive || ' ' || cmd from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'experience-photos: never anon or authenticated'),
  'RESTRICTIVE ALL',
  'a restrictive policy covers every command for anon and authenticated');

-- ---------------------------------------------------------------------------
-- Behaviour, with an object in the bucket
-- ---------------------------------------------------------------------------
insert into storage.objects (bucket_id, name, owner_id) values ('experience-photos', 'visit-1/photo-1.webp', null);

set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'experience-photos'), 0, 'anon cannot list the bucket');
select is((select count(*)::int from storage.objects), 0, 'anon sees no object at all');
select is((select count(*)::int from storage.buckets), 0, 'anon cannot see the bucket itself');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('experience-photos', 'visit-1/anon.webp')$$,
  '42501', null, 'anon cannot upload to the bucket');
reset role;

set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'experience-photos'), 0, 'authenticated cannot list the bucket');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('experience-photos', 'visit-1/auth.webp')$$,
  '42501', null, 'authenticated cannot upload to the bucket');
reset role;

set local role service_role;
select is((select count(*)::int from storage.objects where bucket_id = 'experience-photos'), 1, 'service_role can list the bucket');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('experience-photos', 'visit-1/photo-2.webp')$$,
  'service_role can upload to the bucket');
reset role;

-- ---------------------------------------------------------------------------
-- A broad permissive policy added later cannot open the bucket (the restrictive policy still applies)
-- ---------------------------------------------------------------------------
create policy "zz broad read" on storage.objects for select to anon, authenticated using (true);

set local role anon;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'experience-photos'),
  0,
  'a broad SELECT policy for anon still shows nothing from experience-photos');
reset role;
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'experience-photos'),
  0,
  'a broad SELECT policy for authenticated still shows nothing from experience-photos');
reset role;

select * from finish();
rollback;
