-- 0037_backfill_project_pm.sql
--
-- Backfill projects.pm_id = NULL từ dữ liệu thực tế: người đang làm
-- dự án nhiều nhất.
--
-- Heuristic priority (chọn người đầu tiên có data):
--   1. Người báo hoàn thành milestone nhiều nhất trong project đó
--      (milestone_completions.completed_by — chỉ tính active, chưa undone/reopened)
--   2. Assignee xuất hiện nhiều nhất trong tasks của project
--   3. Reviewer xuất hiện nhiều nhất trong tasks của project
--   4. Fallback: super_admin/admin đầu tiên trong company_assignments
--      của company project (nếu có)
--
-- Idempotent: chỉ chạy với projects có pm_id = NULL → re-run an toàn.

do $$
declare
  proj record;
  v_pm_id uuid;
begin
  for proj in
    select id, company_id from public.projects
    where pm_id is null and deleted_at is null
  loop
    v_pm_id := null;

    -- 1. Người báo hoàn thành milestone nhiều nhất
    select mc.completed_by into v_pm_id
    from public.milestone_completions mc
    join public.milestones mi on mi.id = mc.milestone_id
    where mi.project_id = proj.id
      and mc.undone_at is null
      and mc.reopened_at is null
    group by mc.completed_by
    order by count(*) desc
    limit 1;

    -- 2. Assignee xuất hiện nhiều nhất trong tasks
    if v_pm_id is null then
      select t.assignee_id into v_pm_id
      from public.tasks t
      where t.project_id = proj.id
        and t.assignee_id is not null
        and t.deleted_at is null
      group by t.assignee_id
      order by count(*) desc
      limit 1;
    end if;

    -- 3. Reviewer xuất hiện nhiều nhất
    if v_pm_id is null then
      select t.reviewer_id into v_pm_id
      from public.tasks t
      where t.project_id = proj.id
        and t.reviewer_id is not null
        and t.deleted_at is null
      group by t.reviewer_id
      order by count(*) desc
      limit 1;
    end if;

    -- 4. Fallback: super_admin/admin có assignment cho company của project
    if v_pm_id is null and proj.company_id is not null then
      select pr.id into v_pm_id
      from public.profiles pr
      join public.company_assignments ca on ca.internal_user_id = pr.id
      where ca.company_id = proj.company_id
        and pr.audience = 'internal'
        and pr.internal_role in ('super_admin', 'admin', 'manager')
        and pr.is_active
        and pr.deleted_at is null
      order by pr.created_at asc
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
  raise notice 'Projects: %/% có pm_id', v_with_pm, v_total;
end;
$$;
