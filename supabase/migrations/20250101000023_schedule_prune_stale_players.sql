-- Phase 9: actually schedule prune_stale_players.
--
-- The function has existed since migration 11 but the cron line was
-- left commented out, so ghost players (presence-channel disconnects
-- that never fired, dev-panel bots that never heartbeat, etc.)
-- accumulated indefinitely in old rooms. The function already excludes
-- players in active games (migration 24 extends that to results-screen
-- viewers), so this is safe to run on a short cadence.
--
-- Requires the pg_cron extension. On hosted Supabase, enable it via
-- Dashboard → Database → Extensions before running this migration —
-- a migration role can't run `create extension`, so we don't try.
--
-- Wrapped in a single DO block because Supabase's pooled deploy path
-- uses prepared statements, which reject multi-command files.

do $migration$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'unschedule'
  ) then
    if exists (select 1 from cron.job where jobname = 'prune-stale-players') then
      perform cron.unschedule('prune-stale-players');
    end if;
    perform cron.schedule('prune-stale-players', '*/2 * * * *', $$select prune_stale_players()$$);
  else
    raise notice 'pg_cron not installed; skipping prune-stale-players schedule. Enable pg_cron in the Supabase dashboard, then rerun this migration.';
  end if;
end
$migration$;
