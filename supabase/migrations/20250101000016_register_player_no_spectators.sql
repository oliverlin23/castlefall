-- Phase 6: Server-side player registration that prevents mid-game "spectators".
-- A player who joined a room while a castlefall game was active used to land
-- with team = null and assigned_word = null, so GameResults filtered them out
-- and the round looked like it was missing words. This RPC routes registration
-- through the server and auto-assigns late joiners to the smaller team.

create or replace function register_player(
  p_room_id uuid,
  p_display_name text
)
returns players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player players;
  v_active_game games;
  v_team1_count int;
  v_team2_count int;
  v_team int;
  v_assigned_word text;
  v_word_order jsonb;
begin
  -- Reuse an existing player record (reconnect by name).
  select * into v_player
  from players
  where room_id = p_room_id and display_name = p_display_name;

  if v_player.id is not null then
    update players set last_seen = now() where id = v_player.id
    returning * into v_player;
    return v_player;
  end if;

  -- If a castlefall game is in progress, fold the new player into a team.
  select g.* into v_active_game
  from games g
  join rooms r on r.current_game_id = g.id
  where r.id = p_room_id
    and g.status = 'active'
    and g.game_type = 'castlefall';

  if v_active_game.id is not null then
    select count(*) into v_team1_count
      from players where game_id = v_active_game.id and team = 1;
    select count(*) into v_team2_count
      from players where game_id = v_active_game.id and team = 2;

    if v_team1_count < v_team2_count then
      v_team := 1;
    elsif v_team2_count < v_team1_count then
      v_team := 2;
    else
      v_team := 1 + floor(random() * 2)::int;
    end if;

    v_assigned_word := v_active_game.team_words->>v_team::text;

    select jsonb_agg(w) into v_word_order
    from (
      select value as w
      from jsonb_array_elements_text(v_active_game.game_words)
      order by random()
    ) sub;

    insert into players (
      room_id, display_name, game_id, team, assigned_word, word_order
    ) values (
      p_room_id, p_display_name, v_active_game.id, v_team, v_assigned_word, v_word_order
    )
    returning * into v_player;

    update games set
      player_teams = player_teams || jsonb_build_object(
        v_player.id::text,
        jsonb_build_object('team', v_team, 'name', p_display_name)
      )
    where id = v_active_game.id;
  else
    insert into players (room_id, display_name)
    values (p_room_id, p_display_name)
    returning * into v_player;
  end if;

  return v_player;
end;
$$;
