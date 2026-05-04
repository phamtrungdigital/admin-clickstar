-- 0035_milestone_completions_backfill.sql
--
-- Backfill: tạo dummy completion cho các milestone đang ở status=completed
-- nhưng chưa có active completion (data history trước khi triển khai
-- flow nghiệm thu). Cần thiết để UI mapping đúng — sau khi đẩy
-- migration 0034, milestone đã completed cũ không có proof → vẫn hiện
-- nút "Đánh dấu hoàn thành" trong card → confused.
--
-- Dummy completion:
--   completed_by = pm của project (fallback: super_admin/admin đầu tiên)
--   summary     = note giải thích đây là backfill
--   attachments = [], links = []   -- không có evidence (data cũ)
--
-- Nếu DB không có pm + không có super_admin/admin nào → bỏ qua, milestone
-- đó vẫn ở trạng thái "stuck" (không nên xảy ra trong môi trường thật).

do $$
declare
  m record;
  v_user uuid;
begin
  for m in
    select mi.id, mi.project_id, p.pm_id
    from public.milestones mi
    left join public.projects p on p.id = mi.project_id
    where mi.status = 'completed'
      and not exists (
        select 1
        from public.milestone_completions mc
        where mc.milestone_id = mi.id
          and mc.undone_at is null
          and mc.reopened_at is null
      )
  loop
    -- Ưu tiên PM của project
    v_user := m.pm_id;

    -- Fallback: super_admin đầu tiên (active)
    if v_user is null then
      select id into v_user
      from public.profiles
      where audience = 'internal'
        and internal_role = 'super_admin'
        and is_active
        and deleted_at is null
      order by created_at asc
      limit 1;
    end if;

    -- Fallback cuối: admin đầu tiên
    if v_user is null then
      select id into v_user
      from public.profiles
      where audience = 'internal'
        and internal_role in ('super_admin', 'admin')
        and is_active
        and deleted_at is null
      order by created_at asc
      limit 1;
    end if;

    if v_user is not null then
      insert into public.milestone_completions
        (milestone_id, completed_by, summary, attachments, links, completed_at)
      values (
        m.id,
        v_user,
        '(Backfill — milestone này được đánh dấu hoàn thành trước khi hệ thống yêu cầu đính kèm bằng chứng nghiệm thu. Vui lòng cập nhật evidence hoặc mở lại nếu cần.)',
        '[]'::jsonb,
        '[]'::jsonb,
        now()
      );
    end if;
  end loop;
end;
$$;

-- Verify: in ra số lượng đã backfill
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.milestone_completions
  where summary like '(Backfill%)';
  raise notice 'Đã backfill % completion records', v_count;
end;
$$;
