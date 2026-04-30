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
