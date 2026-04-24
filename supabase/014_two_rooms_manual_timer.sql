-- Phase 2.1: Two Rooms and a Boom — manual timer start for IRL play
-- The app is used alongside a physical two-room game. Leaders start each
-- round's timer manually once everyone has physically moved into their
-- room and the two Leaders have been appointed.

-- Redefine start_two_rooms_game: identical to 013, but round_ends_at starts null.
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
  v_round_durations int[] := array[180000, 120000, 60000];
  v_hostages_per_round int[];
  v_game_state jsonb;
  v_player_teams jsonb := '{}'::jsonb;
  v_gambler boolean;
begin
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

  if v_player_count <= 10 then
    v_hostages_per_round := array[1, 1, 1];
  elsif v_player_count <= 21 then
    v_hostages_per_round := array[2, 1, 1];
  else
    v_hostages_per_round := array[3, 2, 1];
  end if;

  v_gambler := (v_player_count % 2 = 1);
  v_chars := array['President', 'Bomber'];
  v_teams := array['blue', 'red'];
  if v_gambler then
    v_chars := v_chars || array['Gambler'];
    v_teams := v_teams || array['grey'];
  end if;

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

  with deck as (
    select v_chars[n] as ch, v_teams[n] as tm, random() as r
    from generate_series(1, v_player_count) n
  )
  select
    array_agg(ch order by r),
    array_agg(tm order by r)
  into v_chars, v_teams
  from deck;

  v_rooms := array_fill('a'::text, array[v_player_count]);
  for i in (ceil(v_player_count::numeric / 2)::int + 1)..v_player_count loop
    v_rooms[i] := 'b';
  end loop;

  v_game_state := jsonb_build_object(
    'round', 1,
    'rounds_total', 3,
    'round_durations_ms', to_jsonb(v_round_durations),
    'round_ends_at', null,
    'hostages_per_round', to_jsonb(v_hostages_per_round),
    'room_a_leader', null,
    'room_b_leader', null,
    'selected_hostages', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb),
    'phase', 'playing'
  );

  v_characters := '{}'::jsonb;

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

-- Redefine advance_round: between-round timer stays null until a leader starts it.
-- Final-round reveal path is unchanged.
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

  if jsonb_array_length(v_hostages_a) = 0 or jsonb_array_length(v_hostages_b) = 0 then
    return false;
  end if;

  for v_hostage_id in select (jsonb_array_elements_text(v_hostages_a))::uuid loop
    update players set role = jsonb_set(role, array['room'], '"b"'::jsonb) where id = v_hostage_id;
  end loop;
  for v_hostage_id in select (jsonb_array_elements_text(v_hostages_b))::uuid loop
    update players set role = jsonb_set(role, array['room'], '"a"'::jsonb) where id = v_hostage_id;
  end loop;

  select jsonb_object_agg(
    pid,
    v_game.player_teams->pid || jsonb_build_object('room', p.role->>'room')
  )
  into v_new_player_teams
  from jsonb_object_keys(v_game.player_teams) pid
  join players p on p.id::text = pid;

  if v_round >= v_rounds_total then
    select p.role->>'room' into v_president_room
    from players p
    where p.game_id = p_game_id and p.role->>'character' = 'President'
    limit 1;

    select p.role->>'room' into v_bomber_room
    from players p
    where p.game_id = p_game_id and p.role->>'character' = 'Bomber'
    limit 1;

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

  v_new_state := v_game.game_state
    || jsonb_build_object(
      'round', v_round + 1,
      'round_ends_at', null,
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

-- Start the current round's timer. Callable by either room's leader once both
-- leaders are set and the timer hasn't already been started.
create or replace function start_round_timer(
  p_game_id uuid,
  p_leader_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_round int;
  v_duration_ms int;
  v_leader_a uuid;
  v_leader_b uuid;
begin
  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  if v_game.game_state->'round_ends_at' is not null
     and jsonb_typeof(v_game.game_state->'round_ends_at') != 'null' then
    return false;
  end if;

  v_leader_a := nullif(v_game.game_state->>'room_a_leader', '')::uuid;
  v_leader_b := nullif(v_game.game_state->>'room_b_leader', '')::uuid;
  if v_leader_a is null or v_leader_b is null then return false; end if;
  if p_leader_id != v_leader_a and p_leader_id != v_leader_b then return false; end if;

  v_round := (v_game.game_state->>'round')::int;
  v_duration_ms := ((v_game.game_state->'round_durations_ms')->>(v_round - 1))::int;

  update games set
    game_state = jsonb_set(
      game_state,
      array['round_ends_at'],
      to_jsonb(now() + interval '1 millisecond' * v_duration_ms)
    )
  where id = p_game_id;

  return true;
end;
$$;
