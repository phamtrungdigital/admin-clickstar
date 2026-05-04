-- 0036_progress_formula_done_ratio.sql
--
-- Đổi công thức recompute_project_progress: từ avg(effective progress)
-- sang ratio đơn giản (số done / total). Lý do: user feedback "thông số
-- phải mapping với nhau" — donut 60% phải khớp 1:1 với "3/5 đã hoàn
-- thành", không bị nhiễu bởi progress slider của milestone đang active.
--
-- Old:  avg(case when status='completed' then 100 else progress_percent end)
-- New:  100 * count(*) filter (where status='completed') / count(*)
--
-- Trigger không đổi (vẫn dùng function này) → backfill ngay sau.

create or replace function public.recompute_project_progress(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_done  int;
  v_pct   int;
begin
  select count(*),
         count(*) filter (where status = 'completed')
  into v_total, v_done
  from public.milestones
  where project_id = p_project_id;

  if v_total = 0 then
    v_pct := 0;
  else
    v_pct := round(100.0 * v_done / v_total)::int;
  end if;

  update public.projects
  set progress_percent = v_pct
  where id = p_project_id;
end;
$$;

-- Backfill all projects với công thức mới
do $$
declare
  p record;
begin
  for p in select id from public.projects loop
    perform public.recompute_project_progress(p.id);
  end loop;
end;
$$;

comment on function public.recompute_project_progress(uuid) is
  'Recompute projects.progress_percent = % milestones completed (done / total).';
