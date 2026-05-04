-- 0034_milestone_completions.sql
--
-- Khi nhân viên báo milestone hoàn thành, lưu lại evidence (mô tả +
-- file/link) để admin spot-check, audit về sau, và làm cơ sở thông
-- báo qua email/in-app.
--
-- Workflow:
--   1. Staff click "Đánh dấu hoàn thành" → modal nhập summary +
--      attachments + links (ít nhất 1 attachment hoặc link).
--   2. Server insert milestone_completions row + UPDATE milestones
--      SET status='completed', progress_percent=100.
--   3. Trigger notify PM/AM/admin (in-app + email).
--   4. Trong 5 phút: nhân viên có thể "Hoàn tác" → set undone_at, milestone
--      revert sang active.
--   5. Sau 5 phút: chỉ admin mới mở lại được, ghi vào reopened_at +
--      reopen_reason.
--
-- Path file: companies/<company_id>/milestones/<uuid>.<ext> trong bucket
-- 'documents' (reuse, không cần bucket mới).

create table if not exists public.milestone_completions (
  id              uuid primary key default gen_random_uuid(),
  milestone_id    uuid not null references public.milestones(id) on delete cascade,
  completed_by    uuid not null references public.profiles(id) on delete restrict,
  summary         text not null,
  -- attachments: [{ path, filename, content_type, size }]
  attachments     jsonb not null default '[]'::jsonb,
  -- links: [{ url, label }]
  links           jsonb not null default '[]'::jsonb,
  completed_at    timestamptz not null default now(),

  -- Hoàn tác trong 5 phút: nhân viên tự xoá
  undone_at       timestamptz,
  undone_by       uuid references public.profiles(id) on delete set null,

  -- Reopen sau khi đã completed: chỉ admin
  reopened_at     timestamptz,
  reopened_by     uuid references public.profiles(id) on delete set null,
  reopen_reason   text
);

-- Chỉ cho phép 1 completion ACTIVE (chưa undone, chưa reopened) cho mỗi
-- milestone tại 1 thời điểm — tránh race condition tạo duplicate.
create unique index if not exists milestone_completions_active_unique
  on public.milestone_completions (milestone_id)
  where undone_at is null and reopened_at is null;

create index if not exists milestone_completions_milestone_idx
  on public.milestone_completions (milestone_id, completed_at desc);
create index if not exists milestone_completions_completed_by_idx
  on public.milestone_completions (completed_by);

alter table public.milestone_completions enable row level security;

drop policy if exists milestone_completions_select on public.milestone_completions;
create policy milestone_completions_select on public.milestone_completions
  for select to authenticated
  using (
    public.is_internal()
    and exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = milestone_completions.milestone_id
        and public.can_access_company(p.company_id)
    )
  );

drop policy if exists milestone_completions_insert on public.milestone_completions;
create policy milestone_completions_insert on public.milestone_completions
  for insert to authenticated
  with check (
    public.is_internal()
    and completed_by = auth.uid()
    and exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = milestone_completions.milestone_id
        and public.can_access_company(p.company_id)
    )
  );

-- Update: tác giả update để undone_at, hoặc admin update để reopened_at
drop policy if exists milestone_completions_update on public.milestone_completions;
create policy milestone_completions_update on public.milestone_completions
  for update to authenticated
  using (
    public.is_internal()
    and (completed_by = auth.uid() or public.is_internal_admin())
  )
  with check (
    public.is_internal()
    and (completed_by = auth.uid() or public.is_internal_admin())
  );

-- =============================================================================
-- Storage RLS: cho phép milestone proof attachments trong bucket 'documents'
-- với path scheme: companies/<company_id>/milestones/<filename>
-- (tương tự tickets_storage_policies trong 0017)
-- =============================================================================

drop policy if exists milestones_storage_select on storage.objects;
create policy milestones_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'milestones'
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists milestones_storage_insert on storage.objects;
create policy milestones_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'milestones'
    and public.is_internal()
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists milestones_storage_delete on storage.objects;
create policy milestones_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'milestones'
    and public.is_internal()
    and public.can_access_company(((storage.foldername(name))[2])::uuid)
  );

-- =============================================================================
-- Email template seed: milestone_completed
-- =============================================================================
insert into public.email_templates (code, name, subject, html_body, text_body, is_active)
values (
  'milestone_completed',
  'Milestone hoàn thành',
  '[Clickstar] {{actor_name}} báo hoàn thành milestone "{{milestone_title}}"',
  $html$
<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a">Milestone hoàn thành</h2>
  <p style="margin:0 0 12px;line-height:1.6">
    <strong>{{actor_name}}</strong> vừa báo hoàn thành milestone
    <strong>{{milestone_title}}</strong> trong dự án <strong>{{project_name}}</strong>
    {{#if company_name}}({{company_name}}){{/if}}.
  </p>
  <div style="background:#f1f5f9;border-left:3px solid #3b82f6;padding:12px 16px;margin:16px 0;border-radius:4px">
    <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Mô tả nghiệm thu</p>
    <p style="margin:0;white-space:pre-wrap;line-height:1.5">{{summary}}</p>
  </div>
  <p style="margin:0 0 12px;font-size:13px;color:#64748b">
    📎 {{attachments_count}} tệp đính kèm · 🔗 {{links_count}} liên kết
  </p>
  <p style="margin:24px 0 0">
    <a href="{{milestone_url}}"
       style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:500">
      Xem chi tiết
    </a>
  </p>
  <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e2e8f0">
  <p style="margin:0;font-size:12px;color:#94a3b8">
    Bạn nhận email này vì là PM / Account Manager / Admin của dự án này.
  </p>
</div>
  $html$,
  'Milestone "{{milestone_title}}" trong dự án "{{project_name}}" vừa được {{actor_name}} báo hoàn thành.

Mô tả: {{summary}}

Số tệp đính kèm: {{attachments_count}} · Liên kết: {{links_count}}

Xem chi tiết: {{milestone_url}}',
  true
)
on conflict (code) do nothing;

comment on table public.milestone_completions is
  'Evidence khi staff báo hoàn thành milestone — summary + file/link proof. Có hỗ trợ undone (5 phút) và reopened (admin).';
