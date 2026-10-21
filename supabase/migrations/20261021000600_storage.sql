-- pglite:skip-file
-- Storage buckets and object policies. Paths are "<user_id>/<file>" for user-owned files and
-- "<company_id>/<file>" for company-owned files, so policies can check ownership from the path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('licenses', 'licenses', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']),
  ('certifications', 'certifications', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']),
  ('incident-photos', 'incident-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('site-photos', 'site-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('company-logos', 'company-logos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- License images: owner and admins only (signed URLs). Nobody else, including employers.
create policy "licenses: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'licenses' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()));
create policy "licenses: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'licenses' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "licenses: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'licenses' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "licenses: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'licenses' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "certifications: owner all" on storage.objects for all to authenticated
  using (bucket_id = 'certifications' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_admin()))
  with check (bucket_id = 'certifications' and (storage.foldername(name))[1] = auth.uid()::text);

-- Incident photos: officer who filed them, the company on that shift, admins.
create policy "incident-photos: officer write" on storage.objects for insert to authenticated
  with check (bucket_id = 'incident-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "incident-photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'incident-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.is_admin()
    or exists (select 1 from public.incident_reports ir where ir.company_id = private.jwt_company_id() and name = any (ir.photo_paths))));

-- Public buckets: anyone can read, owners write.
create policy "avatars: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "site-photos: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-photos');
create policy "site-photos: company write" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-photos' and (storage.foldername(name))[1] = private.jwt_company_id()::text);
create policy "site-photos: company update" on storage.objects for update to authenticated
  using (bucket_id = 'site-photos' and (storage.foldername(name))[1] = private.jwt_company_id()::text);

create policy "company-logos: public read" on storage.objects for select to anon, authenticated using (bucket_id = 'company-logos');
create policy "company-logos: company write" on storage.objects for insert to authenticated
  with check (bucket_id = 'company-logos' and (storage.foldername(name))[1] = private.jwt_company_id()::text);
create policy "company-logos: company update" on storage.objects for update to authenticated
  using (bucket_id = 'company-logos' and (storage.foldername(name))[1] = private.jwt_company_id()::text);
