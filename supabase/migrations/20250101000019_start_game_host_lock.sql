-- Phase 7: start_game_atomic gets a host check and a row lock to prevent
-- concurrent starts and to stop late-joining players from being missed
-- between the player roster fetch and the per-player update loop.
--
-- Two bugs fixed:
--
-- 1. The roster fetch (`select array_agg(id) ... where room_id = ...`) had
--    no row lock. A new player INSERT between the fetch and the update loop
--    would never get a team or assigned_word. The new CTE-with-FOR-UPDATE
--    locks the player rows for the duration of the function and uses a
--    single shuffle so the resulting arrays correspond.
--
-- 2. The function accepted no caller id, so any client could trigger a
--    start, and two simultaneous starts would each insert a game and
--    interleave per-player updates. Now we lock the room row first,
--    re-read current_game_id under the lock, abort if a game is already
--    active, and require the caller to be the earliest-joined player
--    (matching the host convention used by kick_player).

drop function if exists start_game_atomic(uuid, jsonb, text, jsonb);

create or replace function start_game_atomic(
  p_room_id uuid,
  p_caller_id uuid,
  p_words jsonb,
  p_word_list_name text,
  p_settings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_existing_game_id uuid;
  v_existing_status text;
  v_host_id uuid;
  v_player_ids uuid[];
  v_player_names text[];
  v_player_count int;
  v_word_count int;
  v_game_words jsonb;
  v_team1_word text;
  v_team2_word text;
  v_team_words jsonb;
  v_player_teams jsonb := '{}'::jsonb;
  v_half int;
  v_team int;
  v_assigned_word text;
  v_word_order jsonb;
begin
  -- Serialize concurrent starts on this room and read the current game id
  -- under the lock.
  select current_game_id into v_existing_game_id
  from rooms
  where id = p_room_id
  for update;

  if v_existing_game_id is not null then
    select status into v_existing_status from games where id = v_existing_game_id;
    if v_existing_status = 'active' then
      raise exception 'A game is already active in this room';
    end if;
  end if;

  -- Host = earliest-joined player in the room (matches kick_player).
  select id into v_host_id
  from players
  where room_id = p_room_id
  order by joined_at asc
  limit 1;

  if v_host_id is null or v_host_id <> p_caller_id then
    raise exception 'Only the host may start a game';
  end if;

  -- Lock the player rows for the duration of the function so a late join
  -- cannot land between the roster fetch and the update loop. Single shuffle
  -- in the CTE; aggregates without ORDER BY preserve correspondence.
  with locked as (
    select id, display_name
    from players
    where room_id = p_room_id
    order by random()
    for update
  )
  select array_agg(id), array_agg(display_name)
  into v_player_ids, v_player_names
  from locked;

  v_player_count := coalesce(array_length(v_player_ids, 1), 0);

  if v_player_count < 4 then
    raise exception 'Need at least 4 players to start a game (have %)', v_player_count;
  end if;

  v_word_count := coalesce((p_settings->>'wordCount')::int, 18);

  select jsonb_agg(word) into v_game_words
  from (
    select value as word
    from jsonb_array_elements_text(p_words)
    order by random()
    limit v_word_count
  ) sub;

  select word1, word2 into v_team1_word, v_team2_word
  from (
    select
      (array_agg(w))[1] as word1,
      (array_agg(w))[2] as word2
    from (
      select value as w
      from jsonb_array_elements_text(v_game_words)
      order by random()
      limit 2
    ) picks
  ) sub;

  v_team_words := jsonb_build_object('1', v_team1_word, '2', v_team2_word);

  insert into games (
    room_id, word_list_name, game_words, team_words, status, settings, player_teams
  ) values (
    p_room_id, p_word_list_name, v_game_words, v_team_words, 'active', p_settings, '{}'::jsonb
  ) returning id into v_game_id;

  v_half := ceil(v_player_count::numeric / 2);

  for i in 1..v_player_count loop
    v_team := case when i <= v_half then 1 else 2 end;
    v_assigned_word := case when v_team = 1 then v_team1_word else v_team2_word end;

    select jsonb_agg(w) into v_word_order
    from (
      select value as w
      from jsonb_array_elements_text(v_game_words)
      order by random()
    ) sub;

    update players set
      game_id = v_game_id,
      team = v_team,
      assigned_word = v_assigned_word,
      word_order = v_word_order
    where id = v_player_ids[i];

    v_player_teams := v_player_teams || jsonb_build_object(
      v_player_ids[i]::text,
      jsonb_build_object('team', v_team, 'name', v_player_names[i])
    );
  end loop;

  update games set player_teams = v_player_teams where id = v_game_id;
  update rooms set current_game_id = v_game_id where id = p_room_id;

  return v_game_id;
end;
$$;
