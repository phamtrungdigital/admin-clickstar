-- Generated combined migration file. DO NOT EDIT.
-- Source of truth: supabase/migrations/*.sql
-- Regenerate with: scripts/build-setup-sql.sh
--
-- Apply by pasting the entire contents of this file into
-- https://supabase.com/dashboard/project/kdzorsvjefcmmtefvbrx/sql/new
-- and clicking Run.

-- ============================================================
-- 0001_extensions.sql
-- ============================================================

-- 0001_extensions.sql
-- Required Postgres extensions for Portal.Clickstar.vn

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- Generic updated_at trigger function reused by every table
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 0002_types_enums.sql
-- ============================================================

-- 0002_types_enums.sql
-- Domain ENUM types — match PRD section 3, 7, 8, 9, 10, 11, 12, 13, 14

do $$
begin
  -- Internal staff roles (Clickstar)
  if not exists (select 1 from pg_type where typname = 'internal_role') then
    create type public.internal_role as enum (
      'super_admin',
      'admin',
      'manager',
      'staff',         -- Nhân viên triển khai
      'support',       -- CSKH
      'accountant'     -- Kế toán
    );
  end if;

  -- Customer-side roles
  if not exists (select 1 from pg_type where typname = 'customer_role') then
    create type public.customer_role as enum (
      'owner',
      'marketing_manager',
      'viewer'
    );
  end if;

  -- Internal staff assignment type (account_manager / implementer / cskh / accountant for a customer)
  if not exists (select 1 from pg_type where typname = 'assignment_role') then
    create type public.assignment_role as enum (
      'account_manager',
      'implementer',
      'support',
      'accountant'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'audience') then
    create type public.audience as enum (
      'internal',
      'customer'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'company_status') then
    create type public.company_status as enum (
      'new',
      'active',         -- đang triển khai
      'paused',         -- tạm dừng
      'ended'           -- kết thúc
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'contract_status') then
    create type public.contract_status as enum (
      'draft',
      'signed',
      'active',
      'completed',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'service_status') then
    create type public.service_status as enum (
      'not_started',
      'active',
      'awaiting_customer',
      'awaiting_review',
      'completed',
      'paused'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'todo',
      'in_progress',
      'awaiting_customer',
      'awaiting_review',
      'done',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum (
      'new',
      'in_progress',
      'awaiting_customer',
      'resolved',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type public.ticket_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_visibility') then
    create type public.document_visibility as enum (
      'internal',   -- only Clickstar staff
      'shared',     -- shared with customer
      'public'      -- accessible without auth (rare)
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type public.document_kind as enum (
      'contract',
      'addendum',
      'acceptance',
      'brief',
      'report',
      'design',
      'ad_creative',
      'seo',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type public.message_status as enum (
      'pending',
      'sending',
      'sent',
      'delivered',
      'failed',
      'bounced'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'automation_event_status') then
    create type public.automation_event_status as enum (
      'pending',
      'sent',
      'failed',
      'retried'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type public.notification_channel as enum (
      'in_app',
      'email',
      'zns'
    );
  end if;
end$$;


-- ============================================================
-- 0003_profiles.sql
-- ============================================================

-- 0003_profiles.sql
-- profiles: 1:1 with auth.users, holds business identity (audience, internal_role, full_name, ...)
-- The auth trigger auto-creates a profile row when a new auth.users row is inserted.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  avatar_url    text,
  audience      public.audience not null default 'customer',
  internal_role public.internal_role,            -- only set when audience = 'internal'
  phone         text,
  is_active     boolean not null default true,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint profiles_internal_role_only_internal
    check (
      (audience = 'internal' and internal_role is not null)
      or (audience = 'customer' and internal_role is null)
    )
);

create index if not exists profiles_audience_idx on public.profiles (audience) where deleted_at is null;
create index if not exists profiles_internal_role_idx on public.profiles (internal_role) where deleted_at is null;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auth trigger: on auth.users insert, create matching profile.
-- Reads user_metadata for audience/internal_role/full_name when admin creates the user
-- via supabase.auth.admin.createUser({ user_metadata: { audience, internal_role, full_name } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audience public.audience;
  v_role     public.internal_role;
  v_name     text;
begin
  v_audience := coalesce(
    nullif(new.raw_user_meta_data->>'audience', ''),
    'customer'
  )::public.audience;

  v_role := nullif(new.raw_user_meta_data->>'internal_role', '')::public.internal_role;

  if v_audience = 'internal' and v_role is null then
    -- Default new internal users to 'staff' if no role specified
    v_role := 'staff';
  elsif v_audience = 'customer' then
    v_role := null;
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', '');

  insert into public.profiles (id, audience, internal_role, full_name)
  values (new.id, v_audience, v_role, v_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- 0004_companies_membership.sql
-- ============================================================

-- 0004_companies_membership.sql
-- companies: tenant root. Every customer-facing record references company_id.
-- company_members: junction for CUSTOMER users (owner/marketing_manager/viewer of company).
-- company_assignments: junction for INTERNAL users assigned to a company (account_manager/implementer/...).

create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique,                          -- mã khách hàng (human-readable)
  name            text not null,
  industry        text,
  website         text,
  email           citext,
  phone           text,
  address         text,
  tax_code        text,
  representative  text,                                   -- người đại diện
  status          public.company_status not null default 'new',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists companies_status_idx on public.companies (status) where deleted_at is null;
create index if not exists companies_name_trgm_idx on public.companies using gin (name gin_trgm_ops);

drop trigger if exists set_companies_updated_at on public.companies;
create trigger set_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Customer membership: maps customer profile → company with a role.
create table if not exists public.company_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.customer_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists company_members_company_idx on public.company_members (company_id);

drop trigger if exists set_company_members_updated_at on public.company_members;
create trigger set_company_members_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- Internal staff assignment: maps internal profile → company with an assignment role.
create table if not exists public.company_assignments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  internal_user_id uuid not null references public.profiles(id) on delete cascade,
  role            public.assignment_role not null default 'implementer',
  is_primary      boolean not null default false,                -- account manager chính
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, internal_user_id, role)
);

create index if not exists company_assignments_user_idx on public.company_assignments (internal_user_id);
create index if not exists company_assignments_company_idx on public.company_assignments (company_id);

drop trigger if exists set_company_assignments_updated_at on public.company_assignments;
create trigger set_company_assignments_updated_at
  before update on public.company_assignments
  for each row execute function public.set_updated_at();

-- Enforce: company_assignments only links internal users; company_members only links customer users.
-- Done via deferred check that joins profiles. We use triggers because CHECK can't reference other tables.
create or replace function public.enforce_membership_audience()
returns trigger
language plpgsql
as $$
declare
  v_audience public.audience;
begin
  select audience into v_audience from public.profiles where id = new.user_id;
  if v_audience is null then
    raise exception 'profile % not found', new.user_id;
  end if;
  if v_audience <> 'customer' then
    raise exception 'company_members.user_id must reference a customer profile (got %)', v_audience;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_company_members_audience on public.company_members;
create trigger enforce_company_members_audience
  before insert or update on public.company_members
  for each row execute function public.enforce_membership_audience();

create or replace function public.enforce_assignment_audience()
returns trigger
language plpgsql
as $$
declare
  v_audience public.audience;
begin
  select audience into v_audience from public.profiles where id = new.internal_user_id;
  if v_audience is null then
    raise exception 'profile % not found', new.internal_user_id;
  end if;
  if v_audience <> 'internal' then
    raise exception 'company_assignments.internal_user_id must reference an internal profile (got %)', v_audience;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_company_assignments_audience on public.company_assignments;
create trigger enforce_company_assignments_audience
  before insert or update on public.company_assignments
  for each row execute function public.enforce_assignment_audience();


-- ============================================================
-- 0005_business.sql
-- ============================================================

-- 0005_business.sql
-- Core business entities:
--   contracts        — hợp đồng (PRD §7)
--   services         — danh mục dịch vụ Clickstar cung cấp (PRD §8)
--   contract_services — junction: hợp đồng có nhiều dịch vụ + giá riêng
--   projects         — khoảng triển khai gom task (1 contract → N projects)
--   tasks            — công việc (PRD §9)
--   task_comments    — bình luận task

-- contracts ---------------------------------------------------------------
create table if not exists public.contracts (
  id                uuid primary key default gen_random_uuid(),
  code              citext unique,
  company_id        uuid not null references public.companies(id) on delete restrict,
  name              text not null,
  total_value       numeric(14,2) not null default 0,
  currency          text not null default 'VND',
  vat_percent       numeric(5,2) not null default 8,
  signed_at         date,
  starts_at         date,
  ends_at           date,
  status            public.contract_status not null default 'draft',
  notes             text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  created_by        uuid references public.profiles(id) on delete set null
);

create index if not exists contracts_company_idx on public.contracts (company_id) where deleted_at is null;
create index if not exists contracts_status_idx on public.contracts (status) where deleted_at is null;

drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- services (catalog of offerings) -----------------------------------------
create table if not exists public.services (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique,
  name            text not null,                          -- "SEO", "Facebook Ads", "Email Marketing", ...
  category        text,
  description     text,
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- contract_services: services included in a contract with project status ---
create table if not exists public.contract_services (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete restrict,
  unit_price      numeric(14,2) not null default 0,
  quantity        numeric(12,2) not null default 1,
  status          public.service_status not null default 'not_started',
  starts_at       date,
  ends_at         date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (contract_id, service_id)
);

create index if not exists contract_services_contract_idx on public.contract_services (contract_id);
create index if not exists contract_services_service_idx on public.contract_services (service_id);

drop trigger if exists set_contract_services_updated_at on public.contract_services;
create trigger set_contract_services_updated_at
  before update on public.contract_services
  for each row execute function public.set_updated_at();

-- projects (delivery containers grouping tasks) ---------------------------
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete restrict,
  contract_id         uuid references public.contracts(id) on delete set null,
  contract_service_id uuid references public.contract_services(id) on delete set null,
  name                text not null,
  description         text,
  starts_at           date,
  ends_at             date,
  status              public.service_status not null default 'not_started',
  primary_owner_id    uuid references public.profiles(id) on delete set null,  -- internal lead
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  created_by          uuid references public.profiles(id) on delete set null
);

create index if not exists projects_company_idx on public.projects (company_id) where deleted_at is null;
create index if not exists projects_contract_idx on public.projects (contract_id) where deleted_at is null;
create index if not exists projects_status_idx on public.projects (status) where deleted_at is null;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- tasks --------------------------------------------------------------------
create table if not exists public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete set null,
  contract_service_id uuid references public.contract_services(id) on delete set null,
  title               text not null,
  description         text,
  assignee_id         uuid references public.profiles(id) on delete set null,
  reporter_id         uuid references public.profiles(id) on delete set null,
  due_at              timestamptz,
  status              public.task_status not null default 'todo',
  priority            public.task_priority not null default 'medium',
  is_visible_to_customer boolean not null default false,                 -- chia sẻ task cho khách
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  created_by          uuid references public.profiles(id) on delete set null
);

create index if not exists tasks_company_idx on public.tasks (company_id) where deleted_at is null;
create index if not exists tasks_project_idx on public.tasks (project_id) where deleted_at is null;
create index if not exists tasks_assignee_idx on public.tasks (assignee_id) where deleted_at is null;
create index if not exists tasks_status_idx on public.tasks (status) where deleted_at is null;
create index if not exists tasks_due_idx on public.tasks (due_at) where deleted_at is null;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- task_comments ------------------------------------------------------------
create table if not exists public.task_comments (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete restrict,
  body            text not null,
  is_internal     boolean not null default true,                          -- if true, hidden from customer
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists task_comments_task_idx on public.task_comments (task_id) where deleted_at is null;
create index if not exists task_comments_author_idx on public.task_comments (author_id);

drop trigger if exists set_task_comments_updated_at on public.task_comments;
create trigger set_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();


-- ============================================================
-- 0006_support.sql
-- ============================================================

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


-- ============================================================
-- 0007_messaging.sql
-- ============================================================

-- 0007_messaging.sql
-- Email + ZNS template/campaign/log tables (PRD §12, §13).

-- email_templates ---------------------------------------------------------
create table if not exists public.email_templates (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique not null,
  name            text not null,
  subject         text not null,
  html_body       text not null,
  text_body       text,
  variables       jsonb not null default '[]'::jsonb,    -- ["customer_name", "report_url", ...]
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

drop trigger if exists set_email_templates_updated_at on public.email_templates;
create trigger set_email_templates_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- email_campaigns ---------------------------------------------------------
create table if not exists public.email_campaigns (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique,
  template_id     uuid references public.email_templates(id) on delete restrict,
  company_id      uuid references public.companies(id) on delete set null,  -- null = cross-tenant blast
  name            text not null,
  description     text,
  audience_filter jsonb not null default '{}'::jsonb,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  finished_at     timestamptz,
  total_recipients integer not null default 0,
  total_sent      integer not null default 0,
  total_failed    integer not null default 0,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists email_campaigns_company_idx on public.email_campaigns (company_id);
create index if not exists email_campaigns_scheduled_idx on public.email_campaigns (scheduled_at);

drop trigger if exists set_email_campaigns_updated_at on public.email_campaigns;
create trigger set_email_campaigns_updated_at
  before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- email_logs --------------------------------------------------------------
create table if not exists public.email_logs (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid references public.email_campaigns(id) on delete set null,
  template_id     uuid references public.email_templates(id) on delete set null,
  company_id      uuid references public.companies(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_email citext not null,
  subject         text not null,
  payload         jsonb not null default '{}'::jsonb,    -- merge variables sent
  status          public.message_status not null default 'pending',
  provider_message_id text,                              -- Resend message id
  error_message   text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists email_logs_campaign_idx on public.email_logs (campaign_id);
create index if not exists email_logs_company_idx on public.email_logs (company_id);
create index if not exists email_logs_recipient_idx on public.email_logs (recipient_email);
create index if not exists email_logs_status_idx on public.email_logs (status);

drop trigger if exists set_email_logs_updated_at on public.email_logs;
create trigger set_email_logs_updated_at
  before update on public.email_logs
  for each row execute function public.set_updated_at();

-- zns_templates -----------------------------------------------------------
create table if not exists public.zns_templates (
  id              uuid primary key default gen_random_uuid(),
  code            citext unique not null,                 -- ZNS template id from Zalo OA
  name            text not null,
  category        text,
  variables       jsonb not null default '[]'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

drop trigger if exists set_zns_templates_updated_at on public.zns_templates;
create trigger set_zns_templates_updated_at
  before update on public.zns_templates
  for each row execute function public.set_updated_at();

-- zns_logs ----------------------------------------------------------------
create table if not exists public.zns_logs (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid references public.zns_templates(id) on delete set null,
  company_id      uuid references public.companies(id) on delete set null,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  recipient_phone text not null,
  payload         jsonb not null default '{}'::jsonb,    -- variable values passed
  status          public.message_status not null default 'pending',
  provider_message_id text,
  error_message   text,
  campaign_code   citext,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists zns_logs_company_idx on public.zns_logs (company_id);
create index if not exists zns_logs_recipient_idx on public.zns_logs (recipient_phone);
create index if not exists zns_logs_status_idx on public.zns_logs (status);
create index if not exists zns_logs_campaign_idx on public.zns_logs (campaign_code);

drop trigger if exists set_zns_logs_updated_at on public.zns_logs;
create trigger set_zns_logs_updated_at
  before update on public.zns_logs
  for each row execute function public.set_updated_at();


-- ============================================================
-- 0008_ops.sql
-- ============================================================

-- 0008_ops.sql
-- Operational tables: reports, notifications, automation_events, audit_logs
-- (PRD §15, §16, §14, §17)

-- reports -----------------------------------------------------------------
-- Monthly / ad-hoc reports for a customer (file lưu trên Storage, metadata ở đây).
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  contract_id     uuid references public.contracts(id) on delete set null,
  project_id      uuid references public.projects(id) on delete set null,
  title           text not null,
  description     text,
  period_start    date,
  period_end      date,
  document_id     uuid references public.documents(id) on delete set null,  -- final PDF
  highlights      jsonb not null default '{}'::jsonb,    -- structured KPI summary
  is_published    boolean not null default false,
  published_at    timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists reports_company_idx on public.reports (company_id) where deleted_at is null;
create index if not exists reports_period_idx on public.reports (period_start, period_end) where deleted_at is null;
create index if not exists reports_published_idx on public.reports (is_published) where deleted_at is null;

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- notifications -----------------------------------------------------------
-- In-app notification feed. Email/ZNS deliveries are tracked separately in *_logs.
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  company_id      uuid references public.companies(id) on delete cascade,
  channel         public.notification_channel not null default 'in_app',
  title           text not null,
  body            text,
  link_url        text,
  entity_type     text,                                   -- e.g. 'ticket', 'task', 'report'
  entity_id       uuid,
  read_at         timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_entity_idx on public.notifications (entity_type, entity_id);

-- automation_events --------------------------------------------------------
-- Outbound webhook queue → n8n.
create table if not exists public.automation_events (
  id              uuid primary key default gen_random_uuid(),
  event_name      text not null,                          -- 'company.created', 'ticket.updated', ...
  company_id      uuid references public.companies(id) on delete set null,
  entity_type     text,
  entity_id       uuid,
  payload         jsonb not null default '{}'::jsonb,
  webhook_url     text,                                   -- override target url, else use env default
  status          public.automation_event_status not null default 'pending',
  attempts        integer not null default 0,
  last_attempt_at timestamptz,
  next_retry_at   timestamptz,
  response_status integer,
  response_body   text,
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists automation_events_status_idx on public.automation_events (status, next_retry_at);
create index if not exists automation_events_company_idx on public.automation_events (company_id);
create index if not exists automation_events_event_idx on public.automation_events (event_name);

drop trigger if exists set_automation_events_updated_at on public.automation_events;
create trigger set_automation_events_updated_at
  before update on public.automation_events
  for each row execute function public.set_updated_at();

-- audit_logs --------------------------------------------------------------
-- Append-only log. Triggers wired in a later phase; for MVP the app writes here.
create table if not exists public.audit_logs (
  id              bigserial primary key,
  user_id         uuid references public.profiles(id) on delete set null,
  company_id      uuid references public.companies(id) on delete set null,
  action          text not null,                          -- 'create', 'update', 'delete', 'send_email', ...
  entity_type     text not null,
  entity_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists audit_logs_user_idx on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_company_idx on public.audit_logs (company_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);


-- ============================================================
-- 0010_rls_helpers.sql
-- ============================================================

-- 0010_rls_helpers.sql
-- Security helper functions used by RLS policies in 0011.
-- All marked SECURITY DEFINER + SET search_path so callers cannot inject.
-- Marked STABLE so Postgres can cache results within a single statement.

-- Current user's profile id (= auth.uid()) ---------------------------------
create or replace function public.auth_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid();
$$;

-- Current user's audience ('internal' | 'customer' | null) -----------------
create or replace function public.current_audience()
returns public.audience
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select audience from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- Current user's internal_role ---------------------------------------------
create or replace function public.current_internal_role()
returns public.internal_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select internal_role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

-- True if current user is internal (any internal_role) ---------------------
create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select audience = 'internal' from public.profiles where id = auth.uid() and deleted_at is null and is_active),
    false
  );
$$;

-- True if current user is super_admin or admin ----------------------------
create or replace function public.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select audience = 'internal' and internal_role in ('super_admin', 'admin')
      from public.profiles where id = auth.uid() and deleted_at is null and is_active
    ),
    false
  );
$$;

-- True if current user is super_admin only ---------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select audience = 'internal' and internal_role = 'super_admin'
      from public.profiles where id = auth.uid() and deleted_at is null and is_active
    ),
    false
  );
$$;

-- Customer companies the current user can see (only customer users) -------
create or replace function public.current_customer_companies()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(company_id), '{}'::uuid[])
  from public.company_members
  where user_id = auth.uid();
$$;

-- Internal companies the current user is assigned to ----------------------
create or replace function public.current_assigned_companies()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(distinct company_id), '{}'::uuid[])
  from public.company_assignments
  where internal_user_id = auth.uid();
$$;

-- Combined access list: companies the current user can see ---------------
-- Internal admins see all (returns NULL → policy treats as wildcard)
-- Internal non-admins see assigned companies
-- Customers see their member companies
create or replace function public.accessible_company_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_audience public.audience;
  v_role     public.internal_role;
begin
  select audience, internal_role
    into v_audience, v_role
  from public.profiles
  where id = auth.uid() and deleted_at is null and is_active;

  if v_audience is null then
    return '{}'::uuid[];
  end if;

  if v_audience = 'internal' and v_role in ('super_admin', 'admin') then
    return null;  -- wildcard: see all companies
  end if;

  if v_audience = 'internal' then
    return public.current_assigned_companies();
  end if;

  return public.current_customer_companies();
end;
$$;

-- Convenience predicate: does the current user have access to this company?
create or replace function public.can_access_company(target_company uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_companies uuid[];
begin
  v_companies := public.accessible_company_ids();
  if v_companies is null then
    return true;     -- admin
  end if;
  return target_company = any(v_companies);
end;
$$;

-- Grant execute on helpers to authenticated role ---------------------------
grant execute on function
  public.auth_user_id(),
  public.current_audience(),
  public.current_internal_role(),
  public.is_internal(),
  public.is_internal_admin(),
  public.is_super_admin(),
  public.current_customer_companies(),
  public.current_assigned_companies(),
  public.accessible_company_ids(),
  public.can_access_company(uuid)
to authenticated;


-- ============================================================
-- 0011_rls_policies.sql
-- ============================================================

-- 0011_rls_policies.sql
-- Enable RLS on every public table and define policies.
--
-- Default access model:
--   * Internal super_admin / admin     → SELECT/INSERT/UPDATE/DELETE everything
--   * Other internal staff             → SELECT/UPDATE rows whose company_id is in current_assigned_companies()
--   * Customers                        → SELECT/INSERT (limited) rows whose company_id is in current_customer_companies()
--                                       INSERT only for tickets + ticket_comments
--   * Anonymous (no auth.uid())        → no access (RLS denies all)
--
-- Mutations (INSERT/UPDATE/DELETE) for back-office data are restricted to internal users by default.
-- Service role bypasses RLS and is used by trusted server-side workers (n8n, server actions running with service key).

------------------------------------------------------------------------------
-- profiles
------------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_internal on public.profiles;
create policy profiles_select_internal on public.profiles
  for select to authenticated
  using (public.is_internal());

drop policy if exists profiles_select_customer_same_company on public.profiles;
create policy profiles_select_customer_same_company on public.profiles
  for select to authenticated
  using (
    -- customer can see other customer profiles in their companies (e.g. team list)
    public.current_audience() = 'customer'
    and exists (
      select 1
      from public.company_members m1
      join public.company_members m2 on m1.company_id = m2.company_id
      where m1.user_id = auth.uid() and m2.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and audience = (select audience from public.profiles where id = auth.uid()));

drop policy if exists profiles_update_internal_admin on public.profiles;
create policy profiles_update_internal_admin on public.profiles
  for update to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

drop policy if exists profiles_insert_internal_admin on public.profiles;
create policy profiles_insert_internal_admin on public.profiles
  for insert to authenticated
  with check (public.is_internal_admin());

drop policy if exists profiles_delete_super_admin on public.profiles;
create policy profiles_delete_super_admin on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

------------------------------------------------------------------------------
-- companies
------------------------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (public.can_access_company(id));

drop policy if exists companies_modify_internal_admin on public.companies;
create policy companies_modify_internal_admin on public.companies
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

------------------------------------------------------------------------------
-- company_members  (customer ↔ company)
------------------------------------------------------------------------------
alter table public.company_members enable row level security;

drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members
  for select to authenticated
  using (
    public.is_internal()
    or user_id = auth.uid()
    or public.can_access_company(company_id)
  );

drop policy if exists company_members_modify_admin on public.company_members;
create policy company_members_modify_admin on public.company_members
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

------------------------------------------------------------------------------
-- company_assignments  (internal staff ↔ company)
------------------------------------------------------------------------------
alter table public.company_assignments enable row level security;

drop policy if exists company_assignments_select on public.company_assignments;
create policy company_assignments_select on public.company_assignments
  for select to authenticated
  using (public.is_internal());

drop policy if exists company_assignments_modify_admin on public.company_assignments;
create policy company_assignments_modify_admin on public.company_assignments
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

------------------------------------------------------------------------------
-- contracts
------------------------------------------------------------------------------
alter table public.contracts enable row level security;

drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select to authenticated
  using (public.can_access_company(company_id));

drop policy if exists contracts_modify_internal on public.contracts;
create policy contracts_modify_internal on public.contracts
  for all to authenticated
  using (
    public.is_internal_admin()
    or (public.is_internal() and public.can_access_company(company_id))
  )
  with check (
    public.is_internal_admin()
    or (public.is_internal() and public.can_access_company(company_id))
  );

------------------------------------------------------------------------------
-- services (catalog) — visible to all authenticated users, mutations admin-only
------------------------------------------------------------------------------
alter table public.services enable row level security;

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated using (true);

drop policy if exists services_modify_admin on public.services;
create policy services_modify_admin on public.services
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

------------------------------------------------------------------------------
-- contract_services
------------------------------------------------------------------------------
alter table public.contract_services enable row level security;

drop policy if exists contract_services_select on public.contract_services;
create policy contract_services_select on public.contract_services
  for select to authenticated
  using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_services.contract_id
        and public.can_access_company(c.company_id)
    )
  );

drop policy if exists contract_services_modify_internal on public.contract_services;
create policy contract_services_modify_internal on public.contract_services
  for all to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_services.contract_id
        and public.can_access_company(c.company_id)
    )
  )
  with check (
    public.is_internal()
    and exists (
      select 1 from public.contracts c
      where c.id = contract_services.contract_id
        and public.can_access_company(c.company_id)
    )
  );

------------------------------------------------------------------------------
-- projects
------------------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.can_access_company(company_id));

drop policy if exists projects_modify_internal on public.projects;
create policy projects_modify_internal on public.projects
  for all to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

------------------------------------------------------------------------------
-- tasks
------------------------------------------------------------------------------
alter table public.tasks enable row level security;

drop policy if exists tasks_select_internal on public.tasks;
create policy tasks_select_internal on public.tasks
  for select to authenticated
  using (public.is_internal() and public.can_access_company(company_id));

drop policy if exists tasks_select_customer on public.tasks;
create policy tasks_select_customer on public.tasks
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and is_visible_to_customer
    and public.can_access_company(company_id)
  );

drop policy if exists tasks_modify_internal on public.tasks;
create policy tasks_modify_internal on public.tasks
  for all to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

------------------------------------------------------------------------------
-- task_comments — customer can only see comments on visible tasks where is_internal=false
------------------------------------------------------------------------------
alter table public.task_comments enable row level security;

drop policy if exists task_comments_select_internal on public.task_comments;
create policy task_comments_select_internal on public.task_comments
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id and public.can_access_company(t.company_id)
    )
  );

drop policy if exists task_comments_select_customer on public.task_comments;
create policy task_comments_select_customer on public.task_comments
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and not is_internal
    and exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and t.is_visible_to_customer
        and public.can_access_company(t.company_id)
    )
  );

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_comments.task_id
        and public.can_access_company(t.company_id)
        and (
          public.is_internal()
          or (public.current_audience() = 'customer' and t.is_visible_to_customer and not is_internal)
        )
    )
  );

drop policy if exists task_comments_update_author on public.task_comments;
create policy task_comments_update_author on public.task_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists task_comments_delete_author_or_admin on public.task_comments;
create policy task_comments_delete_author_or_admin on public.task_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_internal_admin());

------------------------------------------------------------------------------
-- tickets
------------------------------------------------------------------------------
alter table public.tickets enable row level security;

drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets
  for select to authenticated
  using (public.can_access_company(company_id));

drop policy if exists tickets_insert_internal on public.tickets;
create policy tickets_insert_internal on public.tickets
  for insert to authenticated
  with check (public.is_internal() and public.can_access_company(company_id));

drop policy if exists tickets_insert_customer on public.tickets;
create policy tickets_insert_customer on public.tickets
  for insert to authenticated
  with check (
    public.current_audience() = 'customer'
    and public.can_access_company(company_id)
    and reporter_id = auth.uid()
  );

drop policy if exists tickets_update_internal on public.tickets;
create policy tickets_update_internal on public.tickets
  for update to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

drop policy if exists tickets_delete_admin on public.tickets;
create policy tickets_delete_admin on public.tickets
  for delete to authenticated
  using (public.is_internal_admin());

------------------------------------------------------------------------------
-- ticket_comments
------------------------------------------------------------------------------
alter table public.ticket_comments enable row level security;

drop policy if exists ticket_comments_select_internal on public.ticket_comments;
create policy ticket_comments_select_internal on public.ticket_comments
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id and public.can_access_company(t.company_id)
    )
  );

drop policy if exists ticket_comments_select_customer on public.ticket_comments;
create policy ticket_comments_select_customer on public.ticket_comments
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and not is_internal
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id and public.can_access_company(t.company_id)
    )
  );

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_comments.ticket_id and public.can_access_company(t.company_id)
    )
    and (public.is_internal() or not is_internal)
  );

drop policy if exists ticket_comments_update_author on public.ticket_comments;
create policy ticket_comments_update_author on public.ticket_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists ticket_comments_delete_author_or_admin on public.ticket_comments;
create policy ticket_comments_delete_author_or_admin on public.ticket_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_internal_admin());

------------------------------------------------------------------------------
-- documents
------------------------------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists documents_select_internal on public.documents;
create policy documents_select_internal on public.documents
  for select to authenticated
  using (public.is_internal() and public.can_access_company(company_id));

drop policy if exists documents_select_customer on public.documents;
create policy documents_select_customer on public.documents
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and visibility in ('shared', 'public')
    and public.can_access_company(company_id)
  );

drop policy if exists documents_modify_internal on public.documents;
create policy documents_modify_internal on public.documents
  for all to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

------------------------------------------------------------------------------
-- email_templates / email_campaigns / email_logs (internal-only by default)
------------------------------------------------------------------------------
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_logs enable row level security;

drop policy if exists email_templates_internal on public.email_templates;
create policy email_templates_internal on public.email_templates
  for all to authenticated
  using (public.is_internal())
  with check (public.is_internal());

drop policy if exists email_campaigns_internal on public.email_campaigns;
create policy email_campaigns_internal on public.email_campaigns
  for all to authenticated
  using (public.is_internal() and (company_id is null or public.can_access_company(company_id)))
  with check (public.is_internal() and (company_id is null or public.can_access_company(company_id)));

drop policy if exists email_logs_select_internal on public.email_logs;
create policy email_logs_select_internal on public.email_logs
  for select to authenticated
  using (public.is_internal() and (company_id is null or public.can_access_company(company_id)));

drop policy if exists email_logs_select_customer on public.email_logs;
create policy email_logs_select_customer on public.email_logs
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and recipient_user_id = auth.uid()
  );

------------------------------------------------------------------------------
-- zns_templates / zns_logs (same model as email_*)
------------------------------------------------------------------------------
alter table public.zns_templates enable row level security;
alter table public.zns_logs enable row level security;

drop policy if exists zns_templates_internal on public.zns_templates;
create policy zns_templates_internal on public.zns_templates
  for all to authenticated
  using (public.is_internal())
  with check (public.is_internal());

drop policy if exists zns_logs_select_internal on public.zns_logs;
create policy zns_logs_select_internal on public.zns_logs
  for select to authenticated
  using (public.is_internal() and (company_id is null or public.can_access_company(company_id)));

drop policy if exists zns_logs_select_customer on public.zns_logs;
create policy zns_logs_select_customer on public.zns_logs
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and recipient_user_id = auth.uid()
  );

------------------------------------------------------------------------------
-- reports
------------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists reports_select_internal on public.reports;
create policy reports_select_internal on public.reports
  for select to authenticated
  using (public.is_internal() and public.can_access_company(company_id));

drop policy if exists reports_select_customer on public.reports;
create policy reports_select_customer on public.reports
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and is_published
    and public.can_access_company(company_id)
  );

drop policy if exists reports_modify_internal on public.reports;
create policy reports_modify_internal on public.reports
  for all to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));

------------------------------------------------------------------------------
-- notifications  — each user reads only their own
------------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- inserts done via service role / triggers; no insert policy for end-users.

------------------------------------------------------------------------------
-- automation_events  — internal-only
------------------------------------------------------------------------------
alter table public.automation_events enable row level security;

drop policy if exists automation_events_internal on public.automation_events;
create policy automation_events_internal on public.automation_events
  for all to authenticated
  using (public.is_internal())
  with check (public.is_internal());

------------------------------------------------------------------------------
-- audit_logs  — read-only via API; super_admin sees all, others see own actions
------------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_super_admin() or user_id = auth.uid());

-- inserts done via service role; no insert policy for end-users.


-- ============================================================
-- 0012_storage.sql
-- ============================================================

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


-- ============================================================
-- 0013_services_pricing.sql
-- ============================================================

-- 0013_services_pricing.sql
-- Add pricing + billing-cycle metadata to the service catalog so the
-- /services UI can show "Giá (VND)" and "Chu kỳ" columns directly.
-- Defaults are zero-priced + null cycle so existing rows survive.

alter table public.services
  add column if not exists default_price numeric(14,2) not null default 0,
  add column if not exists billing_cycle text;

comment on column public.services.default_price is 'Suggested price in VND used as the default when this service is added to a contract.';
comment on column public.services.billing_cycle is 'Free-text cycle label, e.g. "1 lần", "Hàng tháng", "Hàng quý", "Hàng năm". Stored as text to allow flexibility per service.';

create index if not exists services_billing_cycle_idx on public.services (billing_cycle) where is_active;


-- ============================================================
-- 0014_contracts_attachment.sql
-- ============================================================

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


-- ============================================================
-- 0015_company_services.sql
-- ============================================================

-- 0015_company_services.sql
-- Junction: which services a customer (company) uses.
-- Distinct from contract_services (which scopes services to a contract):
-- this represents the customer's profile of services regardless of contract.

create table if not exists public.company_services (
  company_id   uuid not null references public.companies(id) on delete cascade,
  service_id   uuid not null references public.services(id) on delete restrict,
  created_at   timestamptz not null default now(),
  primary key (company_id, service_id)
);

create index if not exists company_services_service_idx
  on public.company_services (service_id);

-- RLS: mirror contract_services pattern — internal staff can manage all,
-- customer users can only see their own company's links.
alter table public.company_services enable row level security;

drop policy if exists company_services_select on public.company_services;
create policy company_services_select on public.company_services
  for select to authenticated
  using (public.can_access_company(company_id));

drop policy if exists company_services_modify_internal on public.company_services;
create policy company_services_modify_internal on public.company_services
  for all to authenticated
  using (public.is_internal() and public.can_access_company(company_id))
  with check (public.is_internal() and public.can_access_company(company_id));


-- ============================================================
-- 0016_tickets_attachments.sql
-- ============================================================

-- 0016_tickets_attachments.sql
-- Add an attachments array to tickets so customers/staff can attach
-- screenshots and files when reporting / handling an issue.
--
-- Each element shape: {
--   path:         string  -- key inside the `documents` storage bucket
--   filename:     string
--   content_type: string
--   size:         number  -- bytes
--   uploaded_at:  string  -- ISO timestamp
-- }

alter table public.tickets
  add column if not exists attachments jsonb not null default '[]'::jsonb;


-- ============================================================
-- 0017_tickets_storage_policies.sql
-- ============================================================

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


-- ============================================================
-- 0018_role_permissions.sql
-- ============================================================

-- 0018_role_permissions.sql
-- Editable per-role action permissions. RLS already gates DATA access by
-- company / project; this table layers on a UI/business gate for ACTIONS
-- (e.g. "can a manager create a contract?").
--
-- Source of truth at runtime is this table — the UI matrix at
-- /admin/roles reads + writes it. PRD §3 supplies the seed defaults.
--
-- We store one row per (role, scope) so the matrix is just rows in/out.
-- "scope" is a logical surface (users, customers, contracts, ...) and
-- "level" is one of: none, view, scoped, manage, full.

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'permission_level' and typnamespace = 'public'::regnamespace
  ) then
    create type public.permission_level as enum (
      'none',
      'view',
      'scoped',
      'manage',
      'full'
    );
  end if;
end $$;

create table if not exists public.role_permissions (
  role         public.internal_role not null,
  scope        text not null,
  level        public.permission_level not null default 'none',
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null,
  primary key (role, scope)
);

drop trigger if exists set_role_permissions_updated_at on public.role_permissions;
create trigger set_role_permissions_updated_at
  before update on public.role_permissions
  for each row execute function public.set_updated_at();

-- RLS: anyone authenticated reads (UI needs to know what current user can do);
-- only super_admin writes. Admin users CAN see but cannot edit — keeps the
-- "you can't elevate yourself" guarantee.
alter table public.role_permissions enable row level security;

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

drop policy if exists role_permissions_modify_super_admin on public.role_permissions;
create policy role_permissions_modify_super_admin on public.role_permissions
  for all to authenticated
  using (public.current_internal_role() = 'super_admin')
  with check (public.current_internal_role() = 'super_admin');

-- Seed defaults — mirrors the matrix shipped in commit 3c06804 / PRD §3.
insert into public.role_permissions (role, scope, level) values
  -- super_admin
  ('super_admin', 'users',     'full'),
  ('super_admin', 'customers', 'full'),
  ('super_admin', 'contracts', 'full'),
  ('super_admin', 'services',  'full'),
  ('super_admin', 'tasks',     'full'),
  ('super_admin', 'tickets',   'full'),
  ('super_admin', 'documents', 'full'),
  ('super_admin', 'reports',   'full'),
  ('super_admin', 'settings',  'full'),
  -- admin
  ('admin', 'users',     'manage'),
  ('admin', 'customers', 'manage'),
  ('admin', 'contracts', 'manage'),
  ('admin', 'services',  'manage'),
  ('admin', 'tasks',     'manage'),
  ('admin', 'tickets',   'manage'),
  ('admin', 'documents', 'manage'),
  ('admin', 'reports',   'view'),
  ('admin', 'settings',  'manage'),
  -- manager
  ('manager', 'users',     'view'),
  ('manager', 'customers', 'scoped'),
  ('manager', 'contracts', 'scoped'),
  ('manager', 'services',  'view'),
  ('manager', 'tasks',     'scoped'),
  ('manager', 'tickets',   'scoped'),
  ('manager', 'documents', 'scoped'),
  ('manager', 'reports',   'view'),
  ('manager', 'settings',  'none'),
  -- staff (Nhân viên triển khai)
  ('staff', 'users',     'none'),
  ('staff', 'customers', 'scoped'),
  ('staff', 'contracts', 'scoped'),
  ('staff', 'services',  'view'),
  ('staff', 'tasks',     'scoped'),
  ('staff', 'tickets',   'scoped'),
  ('staff', 'documents', 'scoped'),
  ('staff', 'reports',   'none'),
  ('staff', 'settings',  'none'),
  -- support (CSKH)
  ('support', 'users',     'none'),
  ('support', 'customers', 'scoped'),
  ('support', 'contracts', 'view'),
  ('support', 'services',  'view'),
  ('support', 'tasks',     'view'),
  ('support', 'tickets',   'scoped'),
  ('support', 'documents', 'scoped'),
  ('support', 'reports',   'none'),
  ('support', 'settings',  'none'),
  -- accountant (Kế toán)
  ('accountant', 'users',     'none'),
  ('accountant', 'customers', 'view'),
  ('accountant', 'contracts', 'manage'),
  ('accountant', 'services',  'view'),
  ('accountant', 'tasks',     'none'),
  ('accountant', 'tickets',   'none'),
  ('accountant', 'documents', 'scoped'),
  ('accountant', 'reports',   'view'),
  ('accountant', 'settings',  'none')
on conflict (role, scope) do nothing;


-- ============================================================
-- 0019_system_settings.sql
-- ============================================================

-- 0019_system_settings.sql
-- Key-value store for system-wide configuration. Flexible enough to add
-- new settings without a schema change — just insert a new key.
--
-- Read: anyone authenticated (settings affect UI defaults).
-- Write: super_admin only.

create table if not exists public.system_settings (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles(id) on delete set null
);

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
  before update on public.system_settings
  for each row execute function public.set_updated_at();

alter table public.system_settings enable row level security;

drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select on public.system_settings
  for select to authenticated
  using (true);

drop policy if exists system_settings_modify_super_admin on public.system_settings;
create policy system_settings_modify_super_admin on public.system_settings
  for all to authenticated
  using (public.current_internal_role() = 'super_admin')
  with check (public.current_internal_role() = 'super_admin');

-- Seed defaults — JSON-encoded values so we can store strings, numbers, booleans.
insert into public.system_settings (key, value) values
  ('org.name',              '"Clickstar"'::jsonb),
  ('org.tagline',           '"Giải pháp Digital & Automation toàn diện"'::jsonb),
  ('org.address',           '""'::jsonb),
  ('org.tax_code',          '""'::jsonb),
  ('org.support_email',     '"support@clickstar.vn"'::jsonb),
  ('business.default_vat',  '8'::jsonb),
  ('business.default_currency', '"VND"'::jsonb),
  ('notifications.email_enabled', 'true'::jsonb),
  ('notifications.zns_enabled',   'false'::jsonb)
on conflict (key) do nothing;


-- ============================================================
-- 0020_p1_templates_milestones.sql
-- ============================================================

-- 0020_p1_templates_milestones.sql
-- Phase 1.1: Service Templates + Milestones + Task lifecycle expansion.
-- Builds on top of the existing `projects` + `tasks` tables — these become
-- the "service instance" + task instance layer in PRD section 5/6 terminology.

-- 1) Expand task_status to cover the 7-state PRD lifecycle ----------------
-- Existing: todo, in_progress, awaiting_customer, awaiting_review, done, cancelled
-- Add: assigned, blocked, returned. Existing values keep working.
-- (PostgreSQL ALTER TYPE ... ADD VALUE is forwards-compatible.)
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'assigned'
      and enumtypid = (select oid from pg_type where typname = 'task_status')
  ) then
    alter type public.task_status add value 'assigned' before 'in_progress';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'blocked'
      and enumtypid = (select oid from pg_type where typname = 'task_status')
  ) then
    alter type public.task_status add value 'blocked' before 'awaiting_review';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'returned'
      and enumtypid = (select oid from pg_type where typname = 'task_status')
  ) then
    alter type public.task_status add value 'returned' before 'done';
  end if;
end$$;

-- 2) service_templates: a reusable task-list blueprint per service kind ---
create table if not exists public.service_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  industry        text,                 -- e.g. 'SEO', 'Ads', 'Content', 'Web'
  description     text,
  duration_days   integer,              -- standard length, e.g. 180 for SEO 6m
  version         integer not null default 1,
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists service_templates_active_idx
  on public.service_templates (is_active)
  where deleted_at is null;

drop trigger if exists set_service_templates_updated_at on public.service_templates;
create trigger set_service_templates_updated_at
  before update on public.service_templates
  for each row execute function public.set_updated_at();

-- 3) template_milestones: shape of milestones inside a template ----------
create table if not exists public.template_milestones (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references public.service_templates(id) on delete cascade,
  code                text,             -- e.g. 'M1', 'M2'
  title               text not null,
  description         text,
  sort_order          integer not null default 0,
  offset_start_days   integer not null default 0,
  offset_end_days     integer not null default 0,
  deliverable_required boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists template_milestones_template_idx
  on public.template_milestones (template_id);

drop trigger if exists set_template_milestones_updated_at on public.template_milestones;
create trigger set_template_milestones_updated_at
  before update on public.template_milestones
  for each row execute function public.set_updated_at();

-- 4) template_tasks: shape of tasks inside a template --------------------
create table if not exists public.template_tasks (
  id                      uuid primary key default gen_random_uuid(),
  template_id             uuid not null references public.service_templates(id) on delete cascade,
  template_milestone_id   uuid references public.template_milestones(id) on delete set null,
  title                   text not null,
  description             text,
  sort_order              integer not null default 0,
  default_role            text,                  -- 'seo','content','design','dev'
  offset_days             integer not null default 0,
  duration_days           integer not null default 1,
  priority                public.task_priority not null default 'medium',
  is_visible_to_customer  boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists template_tasks_template_idx
  on public.template_tasks (template_id);
create index if not exists template_tasks_milestone_idx
  on public.template_tasks (template_milestone_id);

drop trigger if exists set_template_tasks_updated_at on public.template_tasks;
create trigger set_template_tasks_updated_at
  before update on public.template_tasks
  for each row execute function public.set_updated_at();

-- 5) template_checklist_items: default checklist for a template task ----
create table if not exists public.template_checklist_items (
  id                  uuid primary key default gen_random_uuid(),
  template_task_id    uuid not null references public.template_tasks(id) on delete cascade,
  content             text not null,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists template_checklist_items_task_idx
  on public.template_checklist_items (template_task_id);

-- 6) projects: extend with template fork tracking + PM + progress -------
alter table public.projects
  add column if not exists template_id uuid references public.service_templates(id) on delete set null;
alter table public.projects
  add column if not exists template_version integer;
alter table public.projects
  add column if not exists pm_id uuid references public.profiles(id) on delete set null;
alter table public.projects
  add column if not exists progress_percent integer not null default 0;

create index if not exists projects_template_idx
  on public.projects (template_id) where deleted_at is null;
create index if not exists projects_pm_idx
  on public.projects (pm_id) where deleted_at is null;

-- 7) milestones: instance per project, optionally cloned from template --
create table if not exists public.milestones (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  template_milestone_id   uuid references public.template_milestones(id) on delete set null,
  code                    text,
  title                   text not null,
  description             text,
  sort_order              integer not null default 0,
  starts_at               date,
  ends_at                 date,
  status                  public.service_status not null default 'not_started',
  progress_percent        integer not null default 0,
  deliverable_required    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists milestones_project_idx
  on public.milestones (project_id);

drop trigger if exists set_milestones_updated_at on public.milestones;
create trigger set_milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- 8) tasks: extend with milestone, lifecycle metadata, reviewer, source -
alter table public.tasks
  add column if not exists milestone_id uuid references public.milestones(id) on delete set null;
alter table public.tasks
  add column if not exists template_task_id uuid references public.template_tasks(id) on delete set null;
alter table public.tasks
  add column if not exists reviewer_id uuid references public.profiles(id) on delete set null;
alter table public.tasks
  add column if not exists is_extra boolean not null default false;
alter table public.tasks
  add column if not exists extra_source text; -- 'internal' | 'customer' | 'risk'

create index if not exists tasks_milestone_idx
  on public.tasks (milestone_id) where deleted_at is null;
create index if not exists tasks_reviewer_idx
  on public.tasks (reviewer_id) where deleted_at is null;
create index if not exists tasks_extra_idx
  on public.tasks (is_extra) where deleted_at is null and is_extra = true;

-- 9) task_checklist_items: per-task checklist (separate from comments) -
create table if not exists public.task_checklist_items (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  content         text not null,
  sort_order      integer not null default 0,
  done            boolean not null default false,
  done_by         uuid references public.profiles(id) on delete set null,
  done_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists task_checklist_items_task_idx
  on public.task_checklist_items (task_id);

drop trigger if exists set_task_checklist_items_updated_at on public.task_checklist_items;
create trigger set_task_checklist_items_updated_at
  before update on public.task_checklist_items
  for each row execute function public.set_updated_at();

-- 10) RLS policies for new tables ---------------------------------------

-- service_templates: internal admins write, all internal staff read.
-- Templates are not customer-visible (per PRD §10).
alter table public.service_templates enable row level security;

drop policy if exists service_templates_select on public.service_templates;
create policy service_templates_select on public.service_templates
  for select to authenticated
  using (public.is_internal());

drop policy if exists service_templates_modify_admin on public.service_templates;
create policy service_templates_modify_admin on public.service_templates
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- template_milestones: same model as service_templates
alter table public.template_milestones enable row level security;

drop policy if exists template_milestones_select on public.template_milestones;
create policy template_milestones_select on public.template_milestones
  for select to authenticated
  using (public.is_internal());

drop policy if exists template_milestones_modify_admin on public.template_milestones;
create policy template_milestones_modify_admin on public.template_milestones
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- template_tasks
alter table public.template_tasks enable row level security;

drop policy if exists template_tasks_select on public.template_tasks;
create policy template_tasks_select on public.template_tasks
  for select to authenticated
  using (public.is_internal());

drop policy if exists template_tasks_modify_admin on public.template_tasks;
create policy template_tasks_modify_admin on public.template_tasks
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- template_checklist_items
alter table public.template_checklist_items enable row level security;

drop policy if exists template_checklist_items_select on public.template_checklist_items;
create policy template_checklist_items_select on public.template_checklist_items
  for select to authenticated
  using (public.is_internal());

drop policy if exists template_checklist_items_modify_admin on public.template_checklist_items;
create policy template_checklist_items_modify_admin on public.template_checklist_items
  for all to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- milestones: scope by parent project's company
alter table public.milestones enable row level security;

drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and public.can_access_company(p.company_id)
    )
  );

drop policy if exists milestones_modify_internal on public.milestones;
create policy milestones_modify_internal on public.milestones
  for all to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and public.can_access_company(p.company_id)
    )
  )
  with check (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- task_checklist_items: scope by parent task's company
alter table public.task_checklist_items enable row level security;

drop policy if exists task_checklist_items_select on public.task_checklist_items;
create policy task_checklist_items_select on public.task_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and public.can_access_company(t.company_id)
    )
  );

drop policy if exists task_checklist_items_modify_internal on public.task_checklist_items;
create policy task_checklist_items_modify_internal on public.task_checklist_items
  for all to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and public.can_access_company(t.company_id)
    )
  )
  with check (
    public.is_internal()
    and exists (
      select 1 from public.tasks t
      where t.id = task_checklist_items.task_id
        and public.can_access_company(t.company_id)
    )
  );


-- ============================================================
-- 0021_p2_snapshots.sql
-- ============================================================

-- 0021_p2_snapshots.sql
-- Phase 2.1: Snapshot mechanism (PRD §7).
-- Customer-facing data is gated behind approved snapshots so the customer
-- never sees raw, unmoderated state. Internal staff (or PM) creates a
-- snapshot of the customer-visible slice of a project; an admin (or
-- delegated approver) approves it; only then does the customer see it.

-- 1) Enums --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'snapshot_type') then
    create type public.snapshot_type as enum (
      'weekly',         -- snapshot tuần định kỳ (auto-publish 24h)
      'milestone',      -- milestone vừa hoàn thành (bắt buộc duyệt)
      'deliverable',    -- có sản phẩm bàn giao mới (bắt buộc duyệt)
      'extra_task'      -- task phát sinh ngoài kế hoạch (bắt buộc duyệt)
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'snapshot_status') then
    create type public.snapshot_status as enum (
      'draft',           -- PM đang biên soạn, chưa submit
      'pending_approval', -- chờ sếp/người được chỉ định duyệt
      'approved',        -- đã duyệt thủ công, customer đọc được
      'auto_published',  -- auto-publish sau 24h timeout (vẫn là customer-visible)
      'rejected',        -- bị từ chối, không hiển thị customer
      'rolled_back'      -- rollback trong 7 ngày sau publish
    );
  end if;
end$$;

-- 2) snapshots table ----------------------------------------------------
create table if not exists public.snapshots (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  contract_id     uuid not null references public.contracts(id) on delete cascade,
  type            public.snapshot_type not null,
  status          public.snapshot_status not null default 'pending_approval',
  payload         jsonb not null default '{}'::jsonb,    -- frozen customer-visible state
  notes           text,
  auto_publish_at timestamptz,    -- NULL when type requires manual approval
  rollback_until  timestamptz,    -- = approved_at + 7 days
  created_by      uuid not null references public.profiles(id) on delete restrict,
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  rejected_reason text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists snapshots_project_idx
  on public.snapshots (project_id, created_at desc);
create index if not exists snapshots_contract_idx
  on public.snapshots (contract_id);
create index if not exists snapshots_status_idx
  on public.snapshots (status);
create index if not exists snapshots_auto_publish_idx
  on public.snapshots (auto_publish_at)
  where status = 'pending_approval' and auto_publish_at is not null;

drop trigger if exists set_snapshots_updated_at on public.snapshots;
create trigger set_snapshots_updated_at
  before update on public.snapshots
  for each row execute function public.set_updated_at();

-- 3) RLS ----------------------------------------------------------------
alter table public.snapshots enable row level security;

-- Internal staff: read all snapshots in their accessible projects
drop policy if exists snapshots_select_internal on public.snapshots;
create policy snapshots_select_internal on public.snapshots
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Customers: read only approved / auto-published snapshots in their company's projects
drop policy if exists snapshots_select_customer on public.snapshots;
create policy snapshots_select_customer on public.snapshots
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and snapshots.status in ('approved', 'auto_published')
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Internal staff: create snapshots in their accessible projects
drop policy if exists snapshots_insert_internal on public.snapshots;
create policy snapshots_insert_internal on public.snapshots
  for insert to authenticated
  with check (
    public.is_internal()
    and exists (
      select 1 from public.projects p
      where p.id = snapshots.project_id
        and public.can_access_company(p.company_id)
    )
  );

-- Internal admins: approve / reject / rollback
drop policy if exists snapshots_update_admin on public.snapshots;
create policy snapshots_update_admin on public.snapshots
  for update to authenticated
  using (public.is_internal_admin())
  with check (public.is_internal_admin());

-- 4) Auto-publish helper function -- ----------------------------------
-- Will be called by pg_cron in Phase 2.5. SECURITY DEFINER because it
-- needs to bypass per-row RLS to flip pending → auto_published.
create or replace function public.auto_publish_pending_snapshots()
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    update public.snapshots s
    set
      status = 'auto_published',
      approved_at = now(),
      rollback_until = now() + interval '7 days'
    where s.status = 'pending_approval'
      and s.auto_publish_at is not null
      and s.auto_publish_at <= now()
    returning s.id;
end$$;

grant execute on function public.auto_publish_pending_snapshots() to authenticated;


-- ============================================================
-- 0022_p2_snapshot_cron.sql
-- ============================================================

-- 0022_p2_snapshot_cron.sql
-- Phase 2.5: schedule auto_publish_pending_snapshots() to run every 5 min
-- via Supabase pg_cron. PRD §7.4 — when a 'weekly' snapshot has been
-- pending_approval for more than 24h, flip it to auto_published so the
-- customer doesn't get stuck waiting.

create extension if not exists pg_cron with schema extensions;

-- Idempotent: drop the existing job (if any) before re-creating, so we can
-- re-apply this migration safely.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'snapshots_auto_publish';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'snapshots_auto_publish',
  '*/5 * * * *',
  $$select public.auto_publish_pending_snapshots();$$
);


-- ============================================================
-- 0023_p2_snapshot_notifications.sql
-- ============================================================

-- 0023_p2_snapshot_notifications.sql
-- Phase 2.6: when the cron auto-publishes a snapshot, also insert
-- notifications for (a) the PM who created it and (b) every customer
-- linked to the project's company. The TypeScript server actions
-- (createSnapshot/approve/reject/rollback) write notifications via the
-- service-role admin client; the cron path can't go through that, so the
-- logic lives here too.
--
-- Replaces the simpler version from 0021. SECURITY DEFINER + explicit
-- search_path so it can read projects/company_members and write
-- notifications regardless of the calling role.

create or replace function public.auto_publish_pending_snapshots()
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot record;
begin
  for v_snapshot in
    select s.id           as snapshot_id,
           s.project_id   as project_id,
           s.created_by   as created_by,
           p.company_id   as company_id,
           p.name         as project_name
    from public.snapshots s
    join public.projects p on p.id = s.project_id
    where s.status = 'pending_approval'
      and s.auto_publish_at is not null
      and s.auto_publish_at <= now()
  loop
    update public.snapshots
    set status         = 'auto_published',
        approved_at    = now(),
        rollback_until = now() + interval '7 days'
    where snapshots.id = v_snapshot.snapshot_id;

    -- Notify the PM who created the snapshot
    insert into public.notifications
      (user_id, company_id, channel, title, body, link_url, entity_type, entity_id)
    values (
      v_snapshot.created_by,
      v_snapshot.company_id,
      'in_app',
      'Snapshot tự auto-publish',
      'Snapshot tuần của dự án "' || v_snapshot.project_name ||
        '" đã hết 24h chờ duyệt và được tự động publish cho khách.',
      '/projects/' || v_snapshot.project_id::text,
      'snapshot',
      v_snapshot.snapshot_id
    );

    -- Notify every customer linked to the company
    insert into public.notifications
      (user_id, company_id, channel, title, body, link_url, entity_type, entity_id)
    select
      cm.user_id,
      v_snapshot.company_id,
      'in_app',
      'Có cập nhật mới: ' || v_snapshot.project_name,
      'Clickstar vừa công bố tiến độ mới. Bấm để xem chi tiết.',
      '/projects/' || v_snapshot.project_id::text,
      'snapshot',
      v_snapshot.snapshot_id
    from public.company_members cm
    where cm.company_id = v_snapshot.company_id;

    id := v_snapshot.snapshot_id;
    return next;
  end loop;
  return;
end$$;

grant execute on function public.auto_publish_pending_snapshots() to authenticated;


-- ============================================================
-- 0024_p4_reports.sql
-- ============================================================

-- 0024_p4_reports.sql
-- Phase 4.2 (PRD §10, §13): periodic project reports — PM viết Markdown,
-- sếp duyệt, khách đọc/download. Builds on the existing `reports` table
-- from 0008 by adding the lifecycle columns + Markdown body.
--
-- Existing columns kept: id, company_id, contract_id, project_id, title,
-- description, period_start, period_end, document_id (final PDF, optional),
-- highlights jsonb, is_published, published_at, metadata, soft delete,
-- created_by.

-- 1) Status enum --------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum (
      'draft',             -- PM đang biên soạn
      'pending_approval',  -- chờ sếp duyệt
      'approved',          -- đã duyệt, customer đọc được
      'rejected'           -- bị từ chối, không hiển thị customer
    );
  end if;
end$$;

-- 2) Extend reports table -----------------------------------------------
alter table public.reports
  add column if not exists content text;
alter table public.reports
  add column if not exists status public.report_status not null default 'draft';
alter table public.reports
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.reports
  add column if not exists approved_at timestamptz;
alter table public.reports
  add column if not exists rejected_reason text;

create index if not exists reports_status_idx
  on public.reports (status)
  where deleted_at is null;
create index if not exists reports_project_status_idx
  on public.reports (project_id, status, created_at desc)
  where deleted_at is null;

-- 3) RLS ----------------------------------------------------------------
-- Reports already had RLS in 0011 — internal staff (read+modify), customer
-- (read where is_published). The new lifecycle changes how customer sees
-- "published": only status in (approved) AND is_published, not just is_published.
-- We rewrite the customer SELECT policy so a draft/pending_approval/rejected
-- report never leaks even if is_published got set accidentally.

drop policy if exists reports_select_customer on public.reports;
create policy reports_select_customer on public.reports
  for select to authenticated
  using (
    public.current_audience() = 'customer'
    and reports.status = 'approved'
    and reports.is_published = true
    and public.can_access_company(reports.company_id)
  );

-- Internal SELECT/modify policies from 0011 stay as-is (any internal staff
-- with company access can read; same plus is_internal can write).


