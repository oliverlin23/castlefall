-- Phase 14: deactivate rooms automatically when the last player leaves.
--
-- The existing client-side path (RoomPage.tsx → deactivate_room) only
-- fires while a tab is still open. If the last user just closes the
-- browser, the presence-channel leave is handled by
-- release_disconnected_player which deletes their players row, but
-- nothing then flips rooms.active to false. Result: orphaned
-- active=true, players=0 rooms accumulate (one per month per the audit
-- the user just ran).
--
-- Trigger fires AFTER DELETE on players. If no players remain in the
-- room, mark it inactive. get_or_create_room (migration 8) already
-- knows how to reactivate an inactive room by name, so a returning
-- user with the same room name picks up the same row.

do $migration$
begin
  execute $sql$
create or replace function deactivate_empty_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not exists (select 1 from players where room_id = old.room_id) then
    update rooms set active = false, current_game_id = null where id = old.room_id;
  end if;
  return null;
end;
$body$
  $sql$;

  execute 'drop trigger if exists trg_deactivate_empty_room on players';

  execute $sql$
create trigger trg_deactivate_empty_room
after delete on players
for each row
execute function deactivate_empty_room()
  $sql$;

  -- Back-fill the existing ghosts so the user doesn't have to.
  update rooms r set active = false
  where r.active = true
    and not exists (select 1 from players p where p.room_id = r.id);
end
$migration$;
