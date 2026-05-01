-- 0023_p2_snapshot_notifications.sql
-- Phase 2.6: when the cron auto-publishes a snapshot, also insert
-- notifications for (a) the PM who created it and (b) every customer
-- linked to the project's company. The TypeScript server actions
-- (createSnapshot/approve/reject/rollback) write notifications via the
-- service-role admin client; the cron path can't go through that, so the
-- logic lives here too.
--
-- Replaces the simpler version from 0021. SECURITY DEFINER + explicit
-- search_path so it can read projects/company_members and write
-- notifications regardless of the calling role.

create or replace function public.auto_publish_pending_snapshots()
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot record;
begin
  for v_snapshot in
    select s.id           as snapshot_id,
           s.project_id   as project_id,
           s.created_by   as created_by,
           p.company_id   as company_id,
           p.name         as project_name
    from public.snapshots s
    join public.projects p on p.id = s.project_id
    where s.status = 'pending_approval'
      and s.auto_publish_at is not null
      and s.auto_publish_at <= now()
  loop
    update public.snapshots
    set status         = 'auto_published',
        approved_at    = now(),
        rollback_until = now() + interval '7 days'
    where snapshots.id = v_snapshot.snapshot_id;

    -- Notify the PM who created the snapshot
    insert into public.notifications
      (user_id, company_id, channel, title, body, link_url, entity_type, entity_id)
    values (
      v_snapshot.created_by,
      v_snapshot.company_id,
      'in_app',
      'Snapshot tự auto-publish',
      'Snapshot tuần của dự án "' || v_snapshot.project_name ||
        '" đã hết 24h chờ duyệt và được tự động publish cho khách.',
      '/projects/' || v_snapshot.project_id::text,
      'snapshot',
      v_snapshot.snapshot_id
    );

    -- Notify every customer linked to the company
    insert into public.notifications
      (user_id, company_id, channel, title, body, link_url, entity_type, entity_id)
    select
      cm.user_id,
      v_snapshot.company_id,
      'in_app',
      'Có cập nhật mới: ' || v_snapshot.project_name,
      'Clickstar vừa công bố tiến độ mới. Bấm để xem chi tiết.',
      '/projects/' || v_snapshot.project_id::text,
      'snapshot',
      v_snapshot.snapshot_id
    from public.company_members cm
    where cm.company_id = v_snapshot.company_id;

    id := v_snapshot.snapshot_id;
    return next;
  end loop;
  return;
end$$;

grant execute on function public.auto_publish_pending_snapshots() to authenticated;
