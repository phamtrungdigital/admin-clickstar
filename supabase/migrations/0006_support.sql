-- 0006_support.sql
-- Customer-facing support entities:
--   tickets         — yêu cầu hỗ trợ (PRD §10)
--   ticket_comments — trao đổi trong ticket
--   documents       — tài liệu metadata, file thực sự lưu trên Supabase Storage (PRD §11)

-- tickets ------------------------------------------------------------------
create table if not exists public.tickets (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique,                         -- e.g. TKT-2026-0001
  company_id      uuid not null references public.companies(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete set null,
  title           text not null,
  description     text,
  priority        public.ticket_priority not null default 'medium',
  status          public.ticket_status not null default 'new',
  assignee_id     uuid references public.profiles(id) on delete set null,
  reporter_id     uuid references public.profiles(id) on delete set null,  -- person who raised it
  closed_at       timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists tickets_company_idx on public.tickets (company_id) where deleted_at is null;
create index if not exists tickets_status_idx on public.tickets (status) where deleted_at is null;
create index if not exists tickets_priority_idx on public.tickets (priority) where deleted_at is null;
create index if not exists tickets_assignee_idx on public.tickets (assignee_id) where deleted_at is null;

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ticket_comments ----------------------------------------------------------
create table if not exists public.ticket_comments (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references public.tickets(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete restrict,
  body            text not null,
  is_internal     boolean not null default false,                        -- internal-only note
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists ticket_comments_ticket_idx on public.ticket_comments (ticket_id) where deleted_at is null;
create index if not exists ticket_comments_author_idx on public.ticket_comments (author_id);

drop trigger if exists set_ticket_comments_updated_at on public.ticket_comments;
create trigger set_ticket_comments_updated_at
  before update on public.ticket_comments
  for each row execute function public.set_updated_at();

-- documents ----------------------------------------------------------------
-- File bytes live in Supabase Storage bucket 'documents'.
-- This table holds metadata + ACL.
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  contract_id     uuid references public.contracts(id) on delete set null,
  project_id      uuid references public.projects(id) on delete set null,
  ticket_id       uuid references public.tickets(id) on delete set null,
  kind            public.document_kind not null default 'other',
  name            text not null,
  description     text,
  storage_path    text not null,                          -- e.g. companies/<company_id>/<uuid>.pdf
  mime_type       text,
  size_bytes      bigint,
  visibility      public.document_visibility not null default 'internal',
  metadata        jsonb not null default '{}'::jsonb,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists documents_company_idx on public.documents (company_id) where deleted_at is null;
create index if not exists documents_contract_idx on public.documents (contract_id) where deleted_at is null;
create index if not exists documents_project_idx on public.documents (project_id) where deleted_at is null;
create index if not exists documents_ticket_idx on public.documents (ticket_id) where deleted_at is null;
create index if not exists documents_kind_idx on public.documents (kind) where deleted_at is null;
create index if not exists documents_visibility_idx on public.documents (visibility) where deleted_at is null;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();
