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
