-- Phase 7: round-reset hardening + return-to-lobby + safer disconnect.
--
-- Three coupled fixes:
--
--  1. start_game_atomic / start_two_rooms_game now CLEAR every player's
--     per-round fields (game_id, team, assigned_word, word_order, role)
--     before snapshotting the player list. Any player that races in
--     after the snapshot will have NULLs (and so render as "waiting"),
--     never as a relic carrying the previous round's word.
--
--  2. New RPC return_to_lobby(p_room_id) — anyone in the room can call
--     it from the results screen. Clears rooms.current_game_id and
--     wipes per-round fields on every player. Past games stay archived.
--
--  3. release_disconnected_player no longer deletes a player whose
--     game_id matches rooms.current_game_id, even if that game is
--     'revealed'. This protects players viewing the just-finished
--     round's results from being culled on reload.

create or replace function start_game_atomic(
  p_room_id uuid,
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
  -- Wipe any leftover per-round state so a player who races in
  -- after the snapshot below cannot carry stale data into the round.
  update players set
    game_id = null,
    team = null,
    assigned_word = null,
    word_order = null,
    role = null
  where room_id = p_room_id;

  select array_agg(id), array_agg(display_name)
  into v_player_ids, v_player_names
  from (
    select id, display_name
    from players
    where room_id = p_room_id
    order by random()
  ) sub;

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
  -- Wipe any leftover per-round state (see comment in start_game_atomic).
  update players set
    game_id = null,
    team = null,
    assigned_word = null,
    word_order = null,
    role = null
  where room_id = p_room_id;

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

create or replace function return_to_lobby(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rooms set current_game_id = null where id = p_room_id;
  update players set
    game_id = null,
    team = null,
    assigned_word = null,
    word_order = null,
    role = null
  where room_id = p_room_id;
end;
$$;

create or replace function release_disconnected_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from players p
  where p.id = p_player_id
    and (
      p.game_id is null
      or (
        -- Don't cull a player who is in the room's current game,
        -- even if that game is 'revealed' (results screen viewers).
        not exists (
          select 1
          from rooms r
          where r.id = p.room_id
            and r.current_game_id = p.game_id
        )
        and p.game_id not in (select id from games where status = 'active')
      )
    );
end;
$$;
