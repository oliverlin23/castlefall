-- Phase 7: Fix start_two_rooms_game shuffle so player ids and names stay aligned.
--
-- The previous version used:
--   array_agg(id order by random()), array_agg(display_name order by random())
-- Two independent ORDER BY random() clauses produce *different* orderings for
-- each aggregate, so v_player_ids[i] and v_player_names[i] referred to two
-- different players. Roles assigned to the players table were correct, but
-- games.player_teams[id].name was the wrong player's name. That field is
-- consumed by src/lib/scoring.ts for the persistent Scoreboard, so historical
-- Two Rooms games show scrambled names against wins/losses.
--
-- Fix: shuffle once in the inner subquery and aggregate without ORDER BY so
-- both arrays follow the same input order.

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
  -- DO NOT add `order by random()` to the individual array_agg calls — each
  -- one would produce its own ordering and the two arrays would no longer
  -- correspond. The single `order by random()` in the inner subquery shuffles
  -- the rows once; the outer aggregates then preserve that order.
  select array_agg(id), array_agg(display_name)
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
