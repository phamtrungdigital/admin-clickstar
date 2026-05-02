-- 0025_p5_documents_optional_company.sql
-- Make documents.company_id nullable so internal staff can store
-- "Clickstar-only" documents (training, processes, brand guides, ...)
-- that don't belong to a specific customer.
--
-- RLS impact:
--   * Internal: can SELECT/MODIFY documents where company_id IS NULL
--     OR can_access_company(company_id) is true.
--   * Customer: company_id IS NULL → never visible (their company set
--     can never include null), regardless of visibility column. Public
--     internal-only documents are reachable only via signed URL by staff.
--   * Storage: when company_id IS NULL, the file lives under
--     `internal/<uuid>.<ext>` and the storage SELECT policy uses the
--     same nullable check so internal staff can read it back.

-- 1) Drop NOT NULL ---------------------------------------------------------
alter table public.documents
  alter column company_id drop not null;

-- 2) Recreate documents RLS policies to allow company_id IS NULL ----------
drop policy if exists documents_select_internal on public.documents;
create policy documents_select_internal on public.documents
  for select to authenticated
  using (
    public.is_internal()
    and (company_id is null or public.can_access_company(company_id))
  );

-- Customer policy unchanged in spirit, but be explicit that null company
-- documents are NOT visible to customers (defensive: can_access_company
-- already returns false on null, but spelling it out avoids future drift).
drop policy if exists documents_select_customer on public.documents;
create policy documents_select_customer on public.documents
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and company_id is not null
    and visibility in ('shared', 'public')
    and public.can_access_company(company_id)
  );

drop policy if exists documents_modify_internal on public.documents;
create policy documents_modify_internal on public.documents
  for all to authenticated
  using (
    public.is_internal()
    and (company_id is null or public.can_access_company(company_id))
  )
  with check (
    public.is_internal()
    and (company_id is null or public.can_access_company(company_id))
  );

-- 3) Storage policies (bucket = 'documents') ------------------------------
-- The SELECT policy in 0012_storage.sql validates the storage path against
-- the documents table. Re-create it so internal staff can read files whose
-- documents row has company_id IS NULL (path prefix `internal/...`).
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
          (
            public.is_internal()
            and (
              d.company_id is null
              or public.can_access_company(d.company_id)
            )
          )
          or (
            public.current_audience() = 'customer'
            and d.company_id is not null
            and d.visibility in ('shared', 'public')
            and public.can_access_company(d.company_id)
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE policies on storage.objects already gate by
-- is_internal() / is_internal_admin() (see 0012_storage.sql) — no change
-- needed there.

-- 4) Belt-and-braces CHECK: when company_id is null, visibility must be
-- 'internal' or 'public' (never 'shared' — there's no specific company
-- to share with). 'public' remains valid because a public-link document
-- doesn't need an owning company.
alter table public.documents
  drop constraint if exists documents_company_visibility_check;
alter table public.documents
  add constraint documents_company_visibility_check
  check (
    company_id is not null
    or visibility in ('internal', 'public')
  );
