-- Phase 14: hold a disconnected player's seat instead of deleting it.
--
-- Presence-leave used to trigger release_disconnected_player after a 4 s
-- grace, which deleted any player not in the room's current game. A phone
-- locking in the lobby therefore removed the player within seconds, and on
-- unlock they came back as a new row. Disconnection and membership are now
-- separate: presence only drives an "away" badge, and removal is left to
-- the heartbeat-based prune below (or an explicit leave / kick).
--
-- prune_stale_players gets two thresholds, both measured against last_seen,
-- which the client now refreshes every 45 s while the tab is visible:
--   * lobby players (game_id null, or not the room's current game): 3 min
--   * results-screen viewers (current game, status 'revealed'):    10 min
-- Players in an active round are never pruned: dropping one mid-round would
-- desynchronise team sizes for declarations. Kick covers that case.
--
-- Wrapped in a single DO block because Supabase's pooled deploy path uses
-- prepared statements, which reject multi-command files.

do $migration$
begin
  execute 'drop function if exists release_disconnected_player(uuid)';
  execute 'drop function if exists prune_stale_players(int)';

  execute $sql$
create or replace function prune_stale_players(
  p_lobby_minutes int default 3,
  p_results_minutes int default 10
)
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_deleted int;
begin
  delete from players p
  using rooms r
  where r.id = p.room_id
    and (
      -- Not part of the room's current game: lobby threshold. Never touch a
      -- player whose game is still active, whatever the room points at.
      (
        (p.game_id is null or p.game_id is distinct from r.current_game_id)
        and not exists (select 1 from games g where g.id = p.game_id and g.status = 'active')
        and p.last_seen < now() - interval '1 minute' * p_lobby_minutes
      )
      or
      -- Viewing the finished round's results: longer threshold.
      (
        p.game_id = r.current_game_id
        and exists (select 1 from games g where g.id = p.game_id and g.status = 'revealed')
        and p.last_seen < now() - interval '1 minute' * p_results_minutes
      )
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$body$
  $sql$;
end
$migration$;
