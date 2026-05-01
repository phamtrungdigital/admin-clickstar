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
