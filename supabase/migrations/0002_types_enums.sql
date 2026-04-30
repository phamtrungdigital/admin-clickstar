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
