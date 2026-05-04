-- 0041_backfill_pm_from_primary_am.sql
--
-- Bug: Project "Thiết kế Website — SEO 123" của company TT Công Ty
-- vẫn pm_id NULL sau migration 0037 vì:
--   - Chưa có milestone completion (ai báo hoàn thành)
--   - Chưa có task assignee/reviewer
--   - Primary AM của company là role 'staff' (không phải manager+) →
--     priority 4 trong 0037 skip
--
-- Fix: thêm priority 4.5 (sau manager+ nhưng trước fallback NULL):
-- pick primary account manager của company của project — bất kể role,
-- vì AM thường là người chịu trách nhiệm chính cho khách hàng đó.
--
-- Re-run cho mọi project còn pm_id NULL.

do $$
declare
  proj record;
  v_pm_id uuid;
begin
  for proj in
    select id, company_id from public.projects
    where pm_id is null and deleted_at is null and company_id is not null
  loop
    v_pm_id := null;

    -- Priority A: Primary AM của company (account_manager role + is_primary)
    -- → người chịu trách nhiệm chính, hợp lý làm PM mặc định
    select ca.internal_user_id into v_pm_id
    from public.company_assignments ca
    join public.profiles pr on pr.id = ca.internal_user_id
    where ca.company_id = proj.company_id
      and ca.role = 'account_manager'
      and ca.is_primary = true
      and pr.is_active
      and pr.deleted_at is null
    limit 1;

    -- Priority B: bất kỳ AM nào của company
    if v_pm_id is null then
      select ca.internal_user_id into v_pm_id
      from public.company_assignments ca
      join public.profiles pr on pr.id = ca.internal_user_id
      where ca.company_id = proj.company_id
        and ca.role = 'account_manager'
        and pr.is_active
        and pr.deleted_at is null
      limit 1;
    end if;

    -- Priority C: bất kỳ internal staff nào có company_assignment
    if v_pm_id is null then
      select ca.internal_user_id into v_pm_id
      from public.company_assignments ca
      join public.profiles pr on pr.id = ca.internal_user_id
      where ca.company_id = proj.company_id
        and pr.is_active
        and pr.deleted_at is null
      limit 1;
    end if;

    if v_pm_id is not null then
      update public.projects set pm_id = v_pm_id where id = proj.id;
    end if;
  end loop;
end;
$$;

-- Verify
do $$
declare
  v_total int;
  v_with_pm int;
begin
  select count(*) into v_total from public.projects where deleted_at is null;
  select count(*) into v_with_pm from public.projects
    where pm_id is not null and deleted_at is null;
  raise notice 'Projects sau backfill: %/% có pm_id', v_with_pm, v_total;
end;
$$;
