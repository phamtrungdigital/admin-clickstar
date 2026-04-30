-- 0014_contracts_attachment.sql
-- Add the contract attachment fields used by the form. The URL can be
-- either a Supabase Storage object path (relative, e.g.
-- "companies/<id>/contracts/<uuid>.pdf") OR an external link (https://...).
-- The app distinguishes by prefix when rendering the download button.

alter table public.contracts
  add column if not exists attachment_url text,
  add column if not exists attachment_filename text;

comment on column public.contracts.attachment_url is 'Either a storage object path inside the documents bucket (no scheme) or a fully-qualified external URL (https://...)';
comment on column public.contracts.attachment_filename is 'Display name for the attachment, falls back to the last path segment when null';
