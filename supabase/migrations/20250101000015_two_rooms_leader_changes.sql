-- Phase 2.2: Two Rooms and a Boom — leader usurpation (majority vote) and
-- "no givesy-backsies" enforcement per rulebook p.8.

-- Redefine start_two_rooms_game to seed usurp_votes and prior_leaders.
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
    'usurp_votes', jsonb_build_object('a', '{}'::jsonb, 'b', '{}'::jsonb),
    'prior_leaders', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb),
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

-- Helper: strip a voter from every tally list in a room's usurp_votes.
-- Returns the updated room votes object.
create or replace function _two_rooms_drop_voter(
  p_room_votes jsonb,
  p_voter_id uuid
) returns jsonb
language plpgsql
immutable
as $$
declare
  v_target text;
  v_list jsonb;
  v_new jsonb := '{}'::jsonb;
  v_filtered jsonb;
  v_entry jsonb;
begin
  if p_room_votes is null or jsonb_typeof(p_room_votes) != 'object' then
    return '{}'::jsonb;
  end if;
  for v_target in select jsonb_object_keys(p_room_votes) loop
    v_list := p_room_votes->v_target;
    v_filtered := '[]'::jsonb;
    if jsonb_typeof(v_list) = 'array' then
      for v_entry in select jsonb_array_elements(v_list) loop
        if v_entry::text != to_jsonb(p_voter_id::text)::text then
          v_filtered := v_filtered || jsonb_build_array(v_entry);
        end if;
      end loop;
    end if;
    if jsonb_array_length(v_filtered) > 0 then
      v_new := v_new || jsonb_build_object(v_target, v_filtered);
    end if;
  end loop;
  return v_new;
end;
$$;

-- Appoint a leader when the seat is empty. Rejects if target is a prior
-- leader this round (no givesy-backsies) or if appointer points at self.
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
  v_prior jsonb;
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

  if v_current_leader is not null then
    return false;
  end if;

  v_prior := coalesce(v_game.game_state->'prior_leaders'->v_appointer_room, '[]'::jsonb);
  if v_prior @> to_jsonb(p_target_id::text) then
    return false;
  end if;

  update games set
    game_state = jsonb_set(game_state, array[v_leader_key], to_jsonb(p_target_id::text))
  where id = p_game_id;

  return true;
end;
$$;

-- Current leader hands the card to a willing target in the same room.
-- Records the outgoing leader as a prior leader (can't get the card back
-- this round). Clears any usurp votes pending in that room.
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
  v_prior jsonb;
  v_new_state jsonb;
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
    return false;
  end if;

  v_prior := coalesce(v_game.game_state->'prior_leaders'->v_room, '[]'::jsonb);
  if v_prior @> to_jsonb(p_target_id::text) then
    return false;  -- target already led this round
  end if;
  v_prior := v_prior || to_jsonb(p_leader_id::text);

  v_new_state := v_game.game_state
    || jsonb_build_object(v_leader_key, to_jsonb(p_target_id::text));
  v_new_state := jsonb_set(v_new_state, array['selected_hostages', v_room], '[]'::jsonb);
  v_new_state := jsonb_set(v_new_state, array['prior_leaders', v_room], v_prior);
  v_new_state := jsonb_set(v_new_state, array['usurp_votes', v_room], '{}'::jsonb);

  update games set game_state = v_new_state where id = p_game_id;

  return true;
end;
$$;

-- Cast or toggle a vote to replace the current leader with a target.
-- Rules:
--   - Voter & target must be in the same room and not the same person.
--   - Target cannot be a prior leader this round.
--   - A voter has at most one active vote per room (switching targets moves it).
--   - Passing p_target_id = p_voter_id cancels the voter's vote.
--   - If any target reaches a strict majority (> half of room population),
--     they become leader. The outgoing leader (if any) is appended to
--     prior_leaders for that room. All usurp votes in the room clear.
create or replace function usurp_leader(
  p_game_id uuid,
  p_voter_id uuid,
  p_target_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_voter_room text;
  v_target_room text;
  v_leader_key text;
  v_current_leader uuid;
  v_prior jsonb;
  v_votes jsonb;
  v_room_votes jsonb;
  v_target_list jsonb;
  v_room_size int;
  v_threshold int;
  v_winner_target text;
  v_count int;
  v_key text;
  v_new_state jsonb;
  v_cancel boolean := (p_voter_id = p_target_id);
begin
  select * into v_game
  from games where id = p_game_id and status = 'active' and game_type = 'two_rooms'
  for update;
  if v_game is null then return false; end if;

  select (role->>'room') into v_voter_room from players where id = p_voter_id;
  if v_voter_room is null then return false; end if;

  if not v_cancel then
    select (role->>'room') into v_target_room from players where id = p_target_id;
    if v_target_room is null or v_target_room != v_voter_room then return false; end if;

    v_prior := coalesce(v_game.game_state->'prior_leaders'->v_voter_room, '[]'::jsonb);
    if v_prior @> to_jsonb(p_target_id::text) then
      return false;
    end if;

    v_leader_key := 'room_' || v_voter_room || '_leader';
    v_current_leader := nullif(v_game.game_state->>v_leader_key, '')::uuid;
    if v_current_leader = p_target_id then
      return false;  -- already the leader
    end if;
  end if;

  v_votes := coalesce(v_game.game_state->'usurp_votes', jsonb_build_object('a', '{}'::jsonb, 'b', '{}'::jsonb));
  v_room_votes := coalesce(v_votes->v_voter_room, '{}'::jsonb);

  -- Remove voter from any existing target list in this room.
  v_room_votes := _two_rooms_drop_voter(v_room_votes, p_voter_id);

  if not v_cancel then
    v_target_list := coalesce(v_room_votes->(p_target_id::text), '[]'::jsonb);
    v_target_list := v_target_list || to_jsonb(p_voter_id::text);
    v_room_votes := v_room_votes || jsonb_build_object(p_target_id::text, v_target_list);
  end if;

  -- Compute room size and majority threshold.
  select count(*) into v_room_size
  from players
  where game_id = p_game_id and (role->>'room') = v_voter_room;
  v_threshold := (v_room_size / 2) + 1;  -- strict majority

  -- Check whether any target has reached threshold.
  v_winner_target := null;
  if not v_cancel then
    for v_key in select jsonb_object_keys(v_room_votes) loop
      v_count := jsonb_array_length(v_room_votes->v_key);
      if v_count >= v_threshold then
        v_winner_target := v_key;
        exit;
      end if;
    end loop;
  end if;

  v_new_state := v_game.game_state;

  if v_winner_target is not null then
    v_leader_key := 'room_' || v_voter_room || '_leader';
    v_current_leader := nullif(v_game.game_state->>v_leader_key, '')::uuid;
    v_prior := coalesce(v_game.game_state->'prior_leaders'->v_voter_room, '[]'::jsonb);
    if v_current_leader is not null and not (v_prior @> to_jsonb(v_current_leader::text)) then
      v_prior := v_prior || to_jsonb(v_current_leader::text);
    end if;
    v_new_state := v_new_state
      || jsonb_build_object(v_leader_key, to_jsonb(v_winner_target));
    v_new_state := jsonb_set(v_new_state, array['prior_leaders', v_voter_room], v_prior);
    v_new_state := jsonb_set(v_new_state, array['usurp_votes', v_voter_room], '{}'::jsonb);
    -- Invalidate hostage selection because the leader changed mid-round.
    v_new_state := jsonb_set(v_new_state, array['selected_hostages', v_voter_room], '[]'::jsonb);
  else
    v_new_state := jsonb_set(v_new_state, array['usurp_votes', v_voter_room], v_room_votes);
  end if;

  update games set game_state = v_new_state where id = p_game_id;

  return true;
end;
$$;

-- Redefine advance_round: identical mechanics to migration 014, plus reset
-- of usurp_votes and prior_leaders on round rollover.
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
        || jsonb_build_object('usurp_votes', jsonb_build_object('a', '{}'::jsonb, 'b', '{}'::jsonb))
        || jsonb_build_object('prior_leaders', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb))
    where id = p_game_id;
    return true;
  end if;

  v_new_state := v_game.game_state
    || jsonb_build_object(
      'round', v_round + 1,
      'round_ends_at', null,
      'room_a_leader', null,
      'room_b_leader', null,
      'selected_hostages', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb),
      'usurp_votes', jsonb_build_object('a', '{}'::jsonb, 'b', '{}'::jsonb),
      'prior_leaders', jsonb_build_object('a', '[]'::jsonb, 'b', '[]'::jsonb)
    );

  update games set
    game_state = v_new_state,
    player_teams = coalesce(v_new_player_teams, v_game.player_teams)
  where id = p_game_id;

  return true;
end;
$$;
