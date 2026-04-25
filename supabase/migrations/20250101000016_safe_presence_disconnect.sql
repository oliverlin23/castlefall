-- Phase 6: Safe presence-driven disconnect cleanup.
-- The presence-leave handler used to call leave_room, which hard-deletes
-- the player. A reload also fires beforeunload → channel.untrack(), so a
-- reloading player would be deleted before their new tab could reconnect.
-- They'd then re-register with a new uuid and lose their team /
-- assigned_word (or, with auto-assignment, get reshuffled to a different
-- team). This RPC is the safe variant: it only removes the player when
-- they are not currently sitting in an active game.

create or replace function release_disconnected_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from players
  where id = p_player_id
    and (
      game_id is null
      or game_id not in (select id from games where status = 'active')
    );
end;
$$;
