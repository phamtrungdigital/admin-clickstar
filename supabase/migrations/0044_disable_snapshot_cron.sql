-- 0044_disable_snapshot_cron.sql
--
-- Phương án A (PRD §7 deprecation): customer view giờ là LIVE, không
-- gate qua snapshot.payload nữa. Snapshot panel UI đã bỏ khỏi project
-- detail. Cron job auto_publish_pending_snapshots không còn purpose
-- (không có ai duyệt → không có gì để publish).
--
-- Soft deprecation:
--   ✓ Unschedule cron snapshots_auto_publish (không chạy nữa)
--   ✓ Giữ table snapshots + function auto_publish_pending_snapshots
--     (audit history, có thể restore)
--   ✓ Giữ RLS policies, action handlers (UI bỏ thôi)
--
-- Reversible: re-apply migration 0022_p2_snapshot_cron.sql để bật lại.

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'snapshots_auto_publish';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise notice 'Unscheduled cron job snapshots_auto_publish (jobid=%)', v_jobid;
  else
    raise notice 'Cron job snapshots_auto_publish chưa tồn tại — skip';
  end if;
end $$;

comment on function public.auto_publish_pending_snapshots() is
  'DEPRECATED Phương án A: customer view live, không cần auto-publish snapshot. Function giữ + cron unscheduled — re-schedule để bật lại nếu cần.';
