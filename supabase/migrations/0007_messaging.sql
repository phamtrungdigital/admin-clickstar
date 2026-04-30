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
