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
