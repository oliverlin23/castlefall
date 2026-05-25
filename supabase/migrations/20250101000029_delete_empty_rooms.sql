-- Phase 15: drop empty rooms entirely instead of deactivating them.
--
-- The previous design (active=false, reactivate-by-name on rejoin) kept
-- past games attached to a stable room id across sessions. We don't
-- need that for a casual party game — past games are scoreboard fluff
-- for the current session only. Simpler invariant: an empty room
-- doesn't exist.
--
-- - trg_deactivate_empty_room (mig 28) is replaced by trg_delete_empty_room
--   which DELETEs the room. games, players, and chat_messages all
--   cascade-delete via the FKs from migration 1.
-- - get_or_create_room loses the inactive-room reactivation branch —
--   post-migration, no inactive rooms exist, so the branch is dead.
--   The `active` column stays (always true going forward) to avoid
--   churning unrelated queries; treat it as vestigial.
-- - Back-fill: delete every currently-inactive room (cascades clean up
--   the rest).

do $migration$
begin
  execute $sql$
create or replace function delete_empty_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  if not exists (select 1 from players where room_id = old.room_id) then
    delete from rooms where id = old.room_id;
  end if;
  return null;
end;
$body$
  $sql$;

  execute 'drop trigger if exists trg_deactivate_empty_room on players';
  execute 'drop trigger if exists trg_delete_empty_room on players';

  execute $sql$
create trigger trg_delete_empty_room
after delete on players
for each row
execute function delete_empty_room()
  $sql$;

  execute $sql$
create or replace function get_or_create_room(room_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_room_id uuid;
begin
  select id into v_room_id from rooms where name = room_name and active = true;
  if v_room_id is not null then
    return v_room_id;
  end if;

  insert into rooms (name) values (room_name) returning id into v_room_id;
  return v_room_id;
end;
$body$
  $sql$;

  delete from rooms where active = false;
end
$migration$;
