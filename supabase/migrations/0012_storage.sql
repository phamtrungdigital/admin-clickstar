-- 0012_storage.sql
-- Storage buckets + RLS policies on storage.objects.
--
-- Buckets:
--   documents — contracts, briefs, reports, designs, etc. Path: companies/<company_id>/<filename>
--   avatars   — user profile pictures. Path: <user_id>/<filename>
--
-- File reads are validated against the documents.documents table when bucket = 'documents':
-- only profiles with access to documents.company_id (via accessible_company_ids()) may read.

-- Create buckets (idempotent) ---------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('avatars',  'avatars',   true)
on conflict (id) do nothing;

------------------------------------------------------------------------------
-- documents bucket
------------------------------------------------------------------------------

drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from public.documents d
      where d.storage_path = storage.objects.name
        and (
          (public.is_internal() and public.can_access_company(d.company_id))
          or (
            public.current_audience() = 'customer'
            and d.visibility in ('shared', 'public')
            and public.can_access_company(d.company_id)
          )
        )
    )
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_internal()
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and public.is_internal())
  with check (bucket_id = 'documents' and public.is_internal());

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.is_internal_admin());

------------------------------------------------------------------------------
-- avatars bucket — public bucket, but only owner can write
------------------------------------------------------------------------------

drop policy if exists avatars_storage_select on storage.objects;
create policy avatars_storage_select on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'avatars');

drop policy if exists avatars_storage_insert_self on storage.objects;
create policy avatars_storage_insert_self on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_storage_update_self on storage.objects;
create policy avatars_storage_update_self on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_storage_delete_self on storage.objects;
create policy avatars_storage_delete_self on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
