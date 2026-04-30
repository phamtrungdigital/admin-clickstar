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
