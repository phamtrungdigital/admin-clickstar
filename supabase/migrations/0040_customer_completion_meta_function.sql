-- 0040_customer_completion_meta_function.sql
--
-- RLS milestone_completions_select hiện chỉ cho is_internal() đọc — vì
-- table chứa proof attachments + summary nội bộ. Customer không nên đọc
-- trực tiếp.
--
-- Nhưng customer view CẦN biết:
--   - Milestone nào đã được nghiệm thu chính thức
--   - Ngày nghiệm thu
--   - Tên người báo (PM/staff)
-- Để hiện badge "✓ Đã nghiệm thu bởi [Tên] · [date]" trong timeline khách.
--
-- Solution: SECURITY DEFINER function trả về CHỈ metadata public-safe
-- (KHÔNG có summary/attachments/links). Customer call function này
-- thay vì select trực tiếp table.

create or replace function public.get_customer_milestone_completion_meta(
  p_project_id uuid
)
returns table (
  milestone_id uuid,
  completed_at timestamptz,
  completer_id uuid,
  completer_full_name text,
  completer_avatar_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    mc.milestone_id,
    mc.completed_at,
    p.id as completer_id,
    p.full_name as completer_full_name,
    p.avatar_url as completer_avatar_url
  from public.milestone_completions mc
  join public.milestones mi on mi.id = mc.milestone_id
  join public.projects pr on pr.id = mi.project_id
  left join public.profiles p on p.id = mc.completed_by
  where pr.id = p_project_id
    and mc.undone_at is null
    and mc.reopened_at is null
    and (
      public.is_internal()
      or (
        public.current_audience() = 'customer'
        and public.can_access_company(pr.company_id)
      )
    );
$$;

grant execute on function public.get_customer_milestone_completion_meta(uuid)
  to authenticated;

comment on function public.get_customer_milestone_completion_meta(uuid) is
  'Customer-safe metadata về milestone completions: chỉ trả ngày nghiệm thu + tên người báo, KHÔNG lộ summary/proof attachments. Áp dụng RLS qua security definer.';
