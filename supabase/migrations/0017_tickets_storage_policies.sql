-- 0017_tickets_storage_policies.sql
-- Allow ticket attachments inside the `documents` bucket without requiring a
-- row in public.documents (which is reserved for first-class document records
-- like contracts/briefs/reports).
--
-- Path convention: companies/<company_id>/tickets/<uuid>.<ext>
-- Access is gated by can_access_company() — internal staff with company
-- access AND the customer of the company can upload + read.

drop policy if exists tickets_storage_select on storage.objects;
create policy tickets_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'tickets'
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists tickets_storage_insert on storage.objects;
create policy tickets_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'tickets'
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists tickets_storage_delete on storage.objects;
create policy tickets_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'tickets'
    and public.is_internal()
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );
