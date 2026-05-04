-- 0033_project_progress_trigger.sql
--
-- Auto-recompute projects.progress_percent từ milestones bất cứ khi nào
-- milestone INSERT/UPDATE/DELETE. Trước đây progress_percent là field
-- thủ công → khi staff đánh dấu 1 milestone hoàn thành, donut "Tiến độ
-- tổng thể" vẫn hiện 0%.
--
-- Công thức: average của effective progress, trong đó status='completed'
-- = 100%, các status khác dùng progress_percent của milestone đó.
-- VD 5 milestone, 1 completed + 4 not_started (progress=0) = (100+0+0+0+0)/5 = 20%.

create or replace function public.recompute_project_progress(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
begin
  select coalesce(
    avg(case when status = 'completed' then 100
             else progress_percent end),
    0
  )
  into v_avg
  from public.milestones
  where project_id = p_project_id;

  update public.projects
  set progress_percent = round(v_avg)::int
  where id = p_project_id;
end;
$$;

create or replace function public.trg_milestones_recompute_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_project_progress(old.project_id);
    return old;
  else
    perform public.recompute_project_progress(new.project_id);
    -- Nếu milestone bị move sang project khác (hiếm), recompute project cũ
    if (tg_op = 'UPDATE' and old.project_id is distinct from new.project_id) then
      perform public.recompute_project_progress(old.project_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_milestones_progress on public.milestones;
create trigger trg_milestones_progress
  after insert or update or delete on public.milestones
  for each row execute function public.trg_milestones_recompute_progress();

-- Backfill: chạy 1 lần cho tất cả project hiện tại để sync ngay sau khi
-- migration apply. Idempotent — chạy lại không hại.
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
  'Recompute projects.progress_percent từ avg milestone effective progress (completed=100).';
