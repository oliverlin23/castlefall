-- Phase 16: rooms.active is vestigial after migration 29 (empty rooms
-- are deleted, not deactivated). Remove the column and the
-- deactivate_room RPC, and rewrite the two functions that still
-- referenced active=true.
--
-- The client-side deactivateRoom() call in RoomPage is also being
-- removed in the same change; with active gone, deactivate_room() has
-- nothing left to do.

do $migration$
begin
  execute 'drop function if exists deactivate_room(uuid)';

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
  select id into v_room_id from rooms where name = room_name;
  if v_room_id is not null then
    return v_room_id;
  end if;

  insert into rooms (name) values (room_name) returning id into v_room_id;
  return v_room_id;
end;
$body$
  $sql$;

  execute $sql$
create or replace function set_room_game_type(p_room_id uuid, p_game_type text)
returns void
language plpgsql
security definer
set search_path = public
as $body$
begin
  if p_game_type not in ('castlefall', 'two_rooms') then
    raise exception 'Invalid game_type: %', p_game_type;
  end if;

  update rooms
  set game_type = p_game_type
  where id = p_room_id
    and current_game_id is null;
end;
$body$
  $sql$;

  alter table rooms drop column if exists active;
end
$migration$;
