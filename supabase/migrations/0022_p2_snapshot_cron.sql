-- 0022_p2_snapshot_cron.sql
-- Phase 2.5: schedule auto_publish_pending_snapshots() to run every 5 min
-- via Supabase pg_cron. PRD §7.4 — when a 'weekly' snapshot has been
-- pending_approval for more than 24h, flip it to auto_published so the
-- customer doesn't get stuck waiting.

create extension if not exists pg_cron with schema extensions;

-- Idempotent: drop the existing job (if any) before re-creating, so we can
-- re-apply this migration safely.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'snapshots_auto_publish';
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end$$;

select cron.schedule(
  'snapshots_auto_publish',
  '*/5 * * * *',
  $$select public.auto_publish_pending_snapshots();$$
);
