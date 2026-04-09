-- Phase 4: Server-side stale player cleanup
-- Deletes players who haven't sent a heartbeat within the threshold,
-- excluding players in active games.

create or replace function prune_stale_players(p_threshold_minutes int default 5)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from players
  where last_seen < now() - interval '1 minute' * p_threshold_minutes
    and id not in (
      select p.id
      from players p
      join games g on g.id = p.game_id
      where g.status = 'active'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- If pg_cron is available, schedule automatic cleanup every 2 minutes:
-- SELECT cron.schedule('prune-stale-players', '*/2 * * * *', $$SELECT prune_stale_players()$$);
