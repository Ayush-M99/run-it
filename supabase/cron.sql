-- Run-It daily snapshot. Paste after schema.sql + functions.sql.
--
-- Requires the pg_cron extension. On Supabase: Database → Extensions → enable "pg_cron".
-- If pg_cron isn't available on your plan, see the Edge Function fallback in README.
--
-- Schedule: every day at 00:05 UTC. Tweak the cron expression to your local midnight if you prefer.

create extension if not exists pg_cron;

-- Drop any prior schedule with this name so re-runs don't pile up.
do $$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'run-it-snapshot-winners' loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'run-it-snapshot-winners',
  '5 0 * * *',
  $$ select public.snapshot_daily_winners(current_date - 1); $$
);

-- One-time backfill so the demo isn't empty before the first scheduled run:
select public.snapshot_daily_winners(current_date - 1);
