-- Phase 1: Multi-game architecture
-- Add game_type to rooms (lobby selection) and games (per-game),
-- plus flexible JSONB fields for game-specific state.

alter table rooms
  add column if not exists game_type text not null default 'castlefall';

alter table games
  add column if not exists game_type text not null default 'castlefall',
  add column if not exists game_state jsonb not null default '{}'::jsonb;

alter table players
  add column if not exists role jsonb;

-- Constrain game_type values
alter table rooms drop constraint if exists rooms_game_type_check;
alter table rooms add constraint rooms_game_type_check
  check (game_type in ('castlefall', 'two_rooms'));

alter table games drop constraint if exists games_game_type_check;
alter table games add constraint games_game_type_check
  check (game_type in ('castlefall', 'two_rooms'));

-- RPC: set the selected game type for a room (from the lobby)
create or replace function set_room_game_type(
  p_room_id uuid,
  p_game_type text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_game_type not in ('castlefall', 'two_rooms') then
    raise exception 'Invalid game_type: %', p_game_type;
  end if;

  update rooms
  set game_type = p_game_type
  where id = p_room_id
    and active = true
    and current_game_id is null;  -- Can't change game type while a game is active
end;
$$;
