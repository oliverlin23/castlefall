-- Phase 12: revert the host-only restriction on return_to_lobby.
--
-- Migration 24 locked this to the earliest-joined player, matching the
-- start-game host check. Both turned out to be friction without a
-- corresponding gain — return_to_lobby only runs after a game has
-- already been revealed (no in-flight state to grief), and party-game
-- etiquette doesn't need that gate.
--
-- p_caller_id stays in the signature for client compatibility; we just
-- no longer compare it to the host.

do $migration$
begin
  execute $sql$
create or replace function return_to_lobby(p_room_id uuid, p_caller_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  perform 1 from rooms where id = p_room_id for update;

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
