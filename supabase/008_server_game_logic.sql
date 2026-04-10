-- Phase 1: Server-side game logic RPCs
-- Moves critical game operations behind SECURITY DEFINER functions
-- so clients cannot manipulate game state directly.

-- 1a. Extend get_or_create_room to handle reactivation of inactive rooms.
create or replace function get_or_create_room(room_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  -- Check for an active room
  select id into v_room_id from rooms where name = room_name and active = true;
  if v_room_id is not null then
    return v_room_id;
  end if;

  -- Check for an inactive room to reactivate
  select id into v_room_id from rooms where name = room_name and active = false;
  if v_room_id is not null then
    update rooms set active = true, current_game_id = null where id = v_room_id;
    return v_room_id;
  end if;

  -- Create a new room
  insert into rooms (name) values (room_name) returning id into v_room_id;
  return v_room_id;
end;
$$;

-- 1b. Atomically start a new game with server-side shuffling and team assignment.
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
  v_player record;
  v_players record[];
  v_player_count int;
  v_word_count int;
  v_game_words jsonb;
  v_team1_word text;
  v_team2_word text;
  v_team_words jsonb;
  v_player_teams jsonb := '{}'::jsonb;
  v_half int;
  v_idx int := 0;
  v_team int;
  v_assigned_word text;
  v_word_order jsonb;
begin
  -- Fetch all players in room, shuffled for random team assignment
  v_player_count := 0;
  for v_player in
    select id, display_name
    from players
    where room_id = p_room_id
    order by random()
  loop
    v_player_count := v_player_count + 1;
    v_players[v_player_count] := v_player;
  end loop;

  if v_player_count < 4 then
    raise exception 'Need at least 4 players to start a game (have %)', v_player_count;
  end if;

  -- Determine word count from settings
  v_word_count := coalesce((p_settings->>'wordCount')::int, 18);

  -- Sample N words from the provided list (shuffled)
  select jsonb_agg(word) into v_game_words
  from (
    select value as word
    from jsonb_array_elements_text(p_words)
    order by random()
    limit v_word_count
  ) sub;

  -- Pick 2 team words from the game words
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

  -- Insert game record
  insert into games (
    room_id, word_list_name, game_words, team_words, status, settings, player_teams
  ) values (
    p_room_id, p_word_list_name, v_game_words, v_team_words, 'active', p_settings, '{}'::jsonb
  ) returning id into v_game_id;

  -- Assign teams and words to each player
  v_half := ceil(v_player_count::numeric / 2);
  v_idx := 0;

  for i in 1..v_player_count loop
    v_idx := v_idx + 1;
    v_team := case when v_idx <= v_half then 1 else 2 end;
    v_assigned_word := case when v_team = 1 then v_team1_word else v_team2_word end;

    -- Generate a shuffled word order for this player
    select jsonb_agg(w) into v_word_order
    from (
      select value as w
      from jsonb_array_elements_text(v_game_words)
      order by random()
    ) sub;

    -- Update the player record
    update players set
      game_id = v_game_id,
      team = v_team,
      assigned_word = v_assigned_word,
      word_order = v_word_order
    where id = v_players[i].id;

    -- Build the player_teams mapping
    v_player_teams := v_player_teams || jsonb_build_object(
      v_players[i].id::text,
      jsonb_build_object('team', v_team, 'name', v_players[i].display_name)
    );
  end loop;

  -- Store player_teams on the game
  update games set player_teams = v_player_teams where id = v_game_id;

  -- Point the room at this game
  update rooms set current_game_id = v_game_id where id = p_room_id;

  return v_game_id;
end;
$$;

-- 1c. Atomically declare a word guess and compute winner server-side.
create or replace function declare_word_atomic(
  p_game_id uuid,
  p_player_id uuid,
  p_player_name text,
  p_guessed_word text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_declarer_team int;
  v_other_team int;
  v_other_team_word text;
  v_winner int;
begin
  select * into v_game
  from games
  where id = p_game_id
    and status = 'active'
    and declaration_type is null
  for update;

  if v_game is null then
    return false;
  end if;

  -- Look up declarer's team from player_teams jsonb
  v_declarer_team := (v_game.player_teams->p_player_id::text->>'team')::int;
  if v_declarer_team is null then
    return false;
  end if;

  v_other_team := case when v_declarer_team = 1 then 2 else 1 end;
  v_other_team_word := v_game.team_words->>v_other_team::text;

  -- Winner: declarer's team if they guessed correctly, other team otherwise
  v_winner := case when p_guessed_word = v_other_team_word then v_declarer_team else v_other_team end;

  update games set
    declaration_type = 'word',
    declaration_player_id = p_player_id,
    declaration_player_name = p_player_name,
    declaration_data = jsonb_build_object('guessedWord', p_guessed_word),
    declaration_at = now(),
    status = 'revealed',
    ended_at = now(),
    winner_team = v_winner
  where id = p_game_id;

  return true;
end;
$$;

-- 1d. Reveal a game (timer expiry / manual reveal) with server-side winner computation.
create or replace function reveal_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game record;
  v_winner int := null;
  v_declarer_team int;
  v_other_team int;
  v_selected jsonb;
  v_actual_teammates jsonb;
  v_correct boolean;
begin
  select * into v_game
  from games
  where id = p_game_id
    and status = 'active'
  for update;

  if v_game is null then
    return;
  end if;

  if v_game.declaration_type = 'team' then
    -- Team declaration: check if selected players match actual teammates
    v_declarer_team := (v_game.player_teams->v_game.declaration_player_id::text->>'team')::int;
    if v_declarer_team is not null then
      v_other_team := case when v_declarer_team = 1 then 2 else 1 end;
      v_selected := v_game.declaration_data->'selectedPlayers';

      -- Build array of actual teammate IDs from player_teams
      select jsonb_agg(key) into v_actual_teammates
      from jsonb_each(v_game.player_teams)
      where (value->>'team')::int = v_declarer_team;

      -- Compare: same size and every selected id is an actual teammate
      v_correct := (
        jsonb_array_length(v_selected) = jsonb_array_length(v_actual_teammates)
        and not exists (
          select 1
          from jsonb_array_elements_text(v_selected) as sel(id)
          where sel.id not in (
            select jsonb_array_elements_text(v_actual_teammates)
          )
        )
      );

      v_winner := case when v_correct then v_declarer_team else v_other_team end;
    end if;

  elsif v_game.declaration_type = 'word' then
    -- Word declaration: same logic as declare_word_atomic
    v_declarer_team := (v_game.player_teams->v_game.declaration_player_id::text->>'team')::int;
    if v_declarer_team is not null then
      v_other_team := case when v_declarer_team = 1 then 2 else 1 end;
      v_winner := case
        when (v_game.declaration_data->>'guessedWord') = (v_game.team_words->>v_other_team::text)
        then v_declarer_team
        else v_other_team
      end;
    end if;
  end if;
  -- If no declaration, winner stays null (draw)

  update games set
    status = 'revealed',
    ended_at = now(),
    winner_team = v_winner
  where id = p_game_id;
end;
$$;

-- Also make existing atomic functions SECURITY DEFINER
-- so they continue to work after RLS is tightened.

create or replace function vote_to_reveal(
  p_game_id uuid,
  p_player_id uuid,
  p_player_count int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_votes jsonb;
  new_votes jsonb;
  threshold int;
begin
  select reveal_votes into current_votes
    from games where id = p_game_id and status = 'active'
    for update;

  if current_votes is null then return; end if;

  -- No-op if already voted
  if current_votes @> to_jsonb(p_player_id::text) then return; end if;

  new_votes := current_votes || to_jsonb(p_player_id::text);
  threshold := ceil(p_player_count::numeric / 2);

  if jsonb_array_length(new_votes) >= threshold then
    update games set
      reveal_votes = new_votes,
      status = 'revealed',
      ended_at = now()
    where id = p_game_id;
  else
    update games set reveal_votes = new_votes where id = p_game_id;
  end if;
end;
$$;

create or replace function unvote_to_reveal(
  p_game_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_votes jsonb;
  new_votes jsonb;
  i int;
begin
  select reveal_votes into current_votes
    from games where id = p_game_id and status = 'active'
    for update;

  if current_votes is null then return; end if;

  new_votes := '[]'::jsonb;
  for i in 0..jsonb_array_length(current_votes) - 1 loop
    if current_votes->i != to_jsonb(p_player_id::text) then
      new_votes := new_votes || jsonb_build_array(current_votes->i);
    end if;
  end loop;

  update games set reveal_votes = new_votes where id = p_game_id;
end;
$$;

create or replace function declare_team_atomic(
  p_game_id uuid,
  p_player_id uuid,
  p_player_name text,
  p_selected jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected int;
begin
  update games set
    declaration_type = 'team',
    declaration_player_id = p_player_id,
    declaration_player_name = p_player_name,
    declaration_data = jsonb_build_object('selectedPlayers', p_selected),
    declaration_at = now()
  where id = p_game_id
    and declaration_type is null
    and status = 'active';

  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;
