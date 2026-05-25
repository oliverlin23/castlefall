-- Phase 10: two security/correctness fixes uncovered while wiring up
-- prune_stale_players for real (migration 23):
--
-- 1. prune_stale_players: spare players whose game_id is still the room's
--    current_game_id, regardless of game status. This mirrors the guard
--    added to release_disconnected_player in migration 19 — without it,
--    a viewer idling on the results screen for >5 min gets culled and
--    the scoreboard breaks.
--
-- 2. return_to_lobby: was unauthenticated. Any client could call it and
--    wipe the active game's per-round fields (including game_id on every
--    player) at any time. Restrict to the room host (earliest-joined
--    player), matching kick_player and start_game_atomic.
--
-- Not fixed here: leave_room and update_heartbeat. Both are still
-- callable by anyone who knows a player uuid. Proper fix requires a
-- players.secret uuid stored client-side; that's a coordinated
-- client+server change.
--
-- Wrapped in a single DO block because Supabase's pooled deploy path
-- uses prepared statements, which reject multi-command files.

do $migration$
begin
  execute $sql$
create or replace function prune_stale_players(p_threshold_minutes int default 5)
returns int
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_deleted int;
begin
  delete from players p
  where p.last_seen < now() - interval '1 minute' * p_threshold_minutes
    and (
      p.game_id is null
      or (
        not exists (
          select 1
          from rooms r
          where r.id = p.room_id
            and r.current_game_id = p.game_id
        )
        and p.game_id not in (select id from games where status = 'active')
      )
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$body$
  $sql$;

  execute 'drop function if exists return_to_lobby(uuid)';

  execute $sql$
create or replace function return_to_lobby(p_room_id uuid, p_caller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_host_id uuid;
begin
  perform 1 from rooms where id = p_room_id for update;

  select id into v_host_id
  from players
  where room_id = p_room_id
  order by joined_at asc
  limit 1;

  if v_host_id is null or v_host_id <> p_caller_id then
    raise exception 'Only the host may return the room to the lobby';
  end if;

  update rooms set current_game_id = null where id = p_room_id;
  update players set
    game_id = null,
    team = null,
    assigned_word = null,
    word_order = null,
    role = null
  where room_id = p_room_id;
end;
$body$
  $sql$;
end
$migration$;
