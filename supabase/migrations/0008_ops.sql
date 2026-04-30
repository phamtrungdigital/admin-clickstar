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
