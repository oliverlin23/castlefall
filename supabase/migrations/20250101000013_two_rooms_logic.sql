-- Phase 2: Two Rooms and a Boom — basic game server logic
-- Basic characters only: President, Bomber, Red/Blue team, Gambler (odd counts)

-- Start a 2R1B game: deal cards, split into two rooms, set up game_state.
create or replace function start_two_rooms_game(
  p_room_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_player_ids uuid[];
  v_player_names text[];
  v_player_count int;
  v_characters jsonb;
  v_chars text[];
  v_rooms text[];
  v_teams text[];
  v_red_count int;
  v_blue_count int;
  v_round_durations int[] := array[180000, 120000, 60000];  -- 3min, 2min, 1min
  v_hostages_per_round int[];
  v_game_state jsonb;
  v_player_teams jsonb := '{}'::jsonb;
  v_round_ends_at timestamptz;
  v_gambler boolean;
begin
  -- Fetch players, shuffled for both team assignment AND room assignment
  select array_agg(id order by random()), array_agg(display_name order by random())
  into v_player_ids, v_player_names
  from (
    select id, display_name
    from players
    where room_id = p_room_id
    order by random()
  ) sub;

  v_player_count := coalesce(array_length(v_player_ids, 1), 0);

  if v_player_count < 6 then
    raise exception 'Two Rooms and a Boom needs at least 6 players (have %)', v_player_count;
  end if;
  if v_player_count > 30 then
    raise exception 'Two Rooms and a Boom supports up to 30 players (have %)', v_player_count;
  end if;

  -- Hostages per round based on player count
  if v_player_count <= 10 then
    v_hostages_per_round := array[1, 1, 1];
  elsif v_player_count <= 21 then
    v_hostages_per_round := array[2, 1, 1];
  else
    v_hostages_per_round := array[3, 2, 1];
  end if;

  -- Build character deck
  -- President + Bomber + Gambler (if odd) + Red/Blue fill
  v_gambler := (v_player_count % 2 = 1);
  v_chars := array['President', 'Bomber'];
  v_teams := array['blue', 'red'];
  if v_gambler then
    v_chars := v_chars || array['Gambler'];
    v_teams := v_teams || array['grey'];
  end if;

  -- Fill remaining slots with equal Red/Blue
  -- Remaining count = player_count - 2 (primary) - (1 if gambler else 0)
  v_red_count := floor((v_player_count - array_length(v_chars, 1))::numeric / 2);
  v_blue_count := v_player_count - array_length(v_chars, 1) - v_red_count;

  for i in 1..v_red_count loop
    v_chars := v_chars || array['Red Team'];
    v_teams := v_teams || array['red'];
  end loop;
  for i in 1..v_blue_count loop
    v_chars := v_chars || array['Blue Team'];
    v_teams := v_teams || array['blue'];
  end loop;

  -- Shuffle the deck (characters/teams together)
  with deck as (
    select v_chars[n] as ch, v_teams[n] as tm, random() as r
    from generate_series(1, v_player_count) n
  )
  select
    array_agg(ch order by r),
    array_agg(tm order by r)
  into v_chars, v_teams
  from deck;

  -- Assign rooms: split evenly. First half → room a, second half → room b.
  v_rooms := array_fill('a'::text, array[v_player_count]);
  for i in (ceil(v_player_count::numeric / 2)::int + 1)..v_player_count loop
    v_rooms[i] := 'b';
  end loop;

  v_round_ends_at := now() + interval '1 millisecond' * v_round_durations[1];

  v_game_state := jsonb_build_object(
    'round', 1,
    'rounds_total', 3,
    'round_durations_ms', to_jsonb(v_round_durations),
    'round_ends_at', v_round_ends_at,
    'hostages_per_round', to_jsonb(v_hostages_per_round),
    'room_a_leader', null,
    'room_b_leader', null,
    'selected_hostages', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb),
    'phase', 'playing'
  );

  -- Characters summary (for player_teams)
  v_characters := '{}'::jsonb;

  -- Insert game
  insert into games (
    room_id, game_type, word_list_name, game_words, team_words, status, settings, player_teams, game_state
  ) values (
    p_room_id, 'two_rooms', '', '[]'::jsonb, '{}'::jsonb, 'active',
    jsonb_build_object(
      'roundsTotal', 3,
      'roundDurationsMs', to_jsonb(v_round_durations),
      'hostagesPerRound', to_jsonb(v_hostages_per_round)
    ),
    '{}'::jsonb,
    v_game_state
  ) returning id into v_game_id;

  -- Assign character/team/room to each player via role jsonb
  for i in 1..v_player_count loop
    update players set
      game_id = v_game_id,
      team = case when v_teams[i] = 'red' then 1 when v_teams[i] = 'blue' then 2 else null end,
      role = jsonb_build_object(
        'room', v_rooms[i],
        'character', v_chars[i],
        'team', v_teams[i]
      )
    where id = v_player_ids[i];

    v_player_teams := v_player_teams || jsonb_build_object(
      v_player_ids[i]::text,
      jsonb_build_object(
        'team', case when v_teams[i] = 'red' then 1 when v_teams[i] = 'blue' then 2 else 0 end,
        'name', v_player_names[i],
        'character', v_chars[i],
        'room', v_rooms[i]
      )
    );
  end loop;

  update games set player_teams = v_player_teams where id = v_game_id;
  update rooms set current_game_id = v_game_id where id = p_room_id;

  return v_game_id;
end;
$$;

-- Appoint a leader in a room. Any player can appoint anyone in the same room
-- (including themselves? No - per rules, can't appoint self).
create or replace function appoint_leader(
  p_game_id uuid,
  p_appointer_id uuid,
  p_target_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_appointer_room text;
  v_target_room text;
  v_leader_key text;
  v_current_leader uuid;
begin
  if p_appointer_id = p_target_id then
    return false;
  end if;

  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  select (role->>'room') into v_appointer_room from players where id = p_appointer_id;
  select (role->>'room') into v_target_room from players where id = p_target_id;

  if v_appointer_room is null or v_target_room is null or v_appointer_room != v_target_room then
    return false;
  end if;

  v_leader_key := 'room_' || v_appointer_room || '_leader';
  v_current_leader := nullif(v_game.game_state->>v_leader_key, '')::uuid;

  -- Only allow appointment if no current leader (initial appointment)
  if v_current_leader is not null then
    return false;
  end if;

  update games set
    game_state = jsonb_set(game_state, array[v_leader_key], to_jsonb(p_target_id::text))
  where id = p_game_id;

  return true;
end;
$$;

-- Current leader abdicates to a target (who must be in the same room).
create or replace function abdicate_leader(
  p_game_id uuid,
  p_leader_id uuid,
  p_target_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_room text;
  v_leader_key text;
  v_target_room text;
begin
  if p_leader_id = p_target_id then return false; end if;

  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  select (role->>'room') into v_room from players where id = p_leader_id;
  select (role->>'room') into v_target_room from players where id = p_target_id;
  if v_room is null or v_target_room is null or v_room != v_target_room then return false; end if;

  v_leader_key := 'room_' || v_room || '_leader';
  if nullif(v_game.game_state->>v_leader_key, '')::uuid != p_leader_id then
    return false;  -- Not the current leader
  end if;

  update games set
    game_state = jsonb_set(game_state, array[v_leader_key], to_jsonb(p_target_id::text)),
    -- reset hostages selected by old leader
    game_state = jsonb_set(game_state, array['selected_hostages', v_room], '[]'::jsonb)
  where id = p_game_id;

  return true;
end;
$$;

-- Leader selects hostages for their room.
create or replace function select_hostages(
  p_game_id uuid,
  p_leader_id uuid,
  p_hostage_ids jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_room text;
  v_leader_key text;
  v_round int;
  v_expected_count int;
  v_hostage_id uuid;
begin
  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  select (role->>'room') into v_room from players where id = p_leader_id;
  if v_room is null then return false; end if;

  v_leader_key := 'room_' || v_room || '_leader';
  if nullif(v_game.game_state->>v_leader_key, '')::uuid != p_leader_id then
    return false;
  end if;

  v_round := (v_game.game_state->>'round')::int;
  v_expected_count := ((v_game.game_state->'hostages_per_round')->>(v_round - 1))::int;

  if jsonb_array_length(p_hostage_ids) != v_expected_count then
    return false;
  end if;

  -- Validate: each hostage must be in same room and not be the leader
  for v_hostage_id in select (jsonb_array_elements_text(p_hostage_ids))::uuid loop
    if v_hostage_id = p_leader_id then return false; end if;
    if not exists (
      select 1 from players
      where id = v_hostage_id and (role->>'room') = v_room
    ) then
      return false;
    end if;
  end loop;

  update games set
    game_state = jsonb_set(game_state, array['selected_hostages', v_room], p_hostage_ids)
  where id = p_game_id;

  return true;
end;
$$;

-- Advance to next round: swap hostages, reset leaders and selections, reset timer.
-- If this was the final round, reveal game and compute winner.
create or replace function advance_round(
  p_game_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_round int;
  v_rounds_total int;
  v_hostages_a jsonb;
  v_hostages_b jsonb;
  v_hostage_id uuid;
  v_durations jsonb;
  v_next_duration_ms int;
  v_new_state jsonb;
  v_president_room text;
  v_bomber_room text;
  v_winner int;
  v_new_player_teams jsonb;
begin
  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  v_round := (v_game.game_state->>'round')::int;
  v_rounds_total := (v_game.game_state->>'rounds_total')::int;
  v_hostages_a := v_game.game_state->'selected_hostages'->'a';
  v_hostages_b := v_game.game_state->'selected_hostages'->'b';

  -- Both leaders must have selected
  if jsonb_array_length(v_hostages_a) = 0 or jsonb_array_length(v_hostages_b) = 0 then
    return false;
  end if;

  -- Swap hostages: A → B, B → A
  for v_hostage_id in select (jsonb_array_elements_text(v_hostages_a))::uuid loop
    update players set role = jsonb_set(role, array['room'], '"b"'::jsonb) where id = v_hostage_id;
  end loop;
  for v_hostage_id in select (jsonb_array_elements_text(v_hostages_b))::uuid loop
    update players set role = jsonb_set(role, array['room'], '"a"'::jsonb) where id = v_hostage_id;
  end loop;

  -- Update player_teams with new rooms
  select jsonb_object_agg(
    pid,
    v_game.player_teams->pid || jsonb_build_object('room', p.role->>'room')
  )
  into v_new_player_teams
  from jsonb_object_keys(v_game.player_teams) pid
  join players p on p.id::text = pid;

  if v_round >= v_rounds_total then
    -- Final round: reveal and compute winner
    select p.role->>'room' into v_president_room
    from players p
    where p.game_id = p_game_id and p.role->>'character' = 'President'
    limit 1;

    select p.role->>'room' into v_bomber_room
    from players p
    where p.game_id = p_game_id and p.role->>'character' = 'Bomber'
    limit 1;

    -- Red wins (team 1) if President and Bomber in same room
    if v_president_room is not null and v_bomber_room is not null then
      v_winner := case when v_president_room = v_bomber_room then 1 else 2 end;
    end if;

    update games set
      status = 'revealed',
      ended_at = now(),
      winner_team = v_winner,
      player_teams = coalesce(v_new_player_teams, v_game.player_teams),
      game_state = game_state
        || jsonb_build_object('phase', 'ended')
        || jsonb_build_object('selected_hostages', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb))
    where id = p_game_id;
    return true;
  end if;

  -- Advance to next round
  v_durations := v_game.game_state->'round_durations_ms';
  v_next_duration_ms := (v_durations->>v_round)::int;  -- next round index (v_round, 0-indexed)

  v_new_state := v_game.game_state
    || jsonb_build_object(
      'round', v_round + 1,
      'round_ends_at', to_jsonb(now() + interval '1 millisecond' * v_next_duration_ms),
      'room_a_leader', null,
      'room_b_leader', null,
      'selected_hostages', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb)
    );

  update games set
    game_state = v_new_state,
    player_teams = coalesce(v_new_player_teams, v_game.player_teams)
  where id = p_game_id;

  return true;
end;
$$;
