-- Phase 13: drop the host gate from kick_player.
--
-- The host concept is being removed from the app entirely. Any player
-- in the room can now kick another player. p_kicker_id stays in the
-- signature for client compatibility but is no longer checked.

do $migration$
begin
  execute $sql$
create or replace function kick_player(p_kicker_id uuid, p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_target_room uuid;
begin
  select room_id into v_target_room from players where id = p_target_id;
  if v_target_room is null then
    return false;
  end if;

  delete from players where id = p_target_id;
  return true;
end;
$body$
  $sql$;
end
$migration$;
