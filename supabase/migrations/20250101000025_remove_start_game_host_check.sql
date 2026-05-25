-- Phase 11: revert the host-only restriction on start_game_atomic.
--
-- Migration 22 locked starting a round to the earliest-joined player.
-- In practice, party-game etiquette doesn't need that gate — whoever's
-- ready first should be able to start. The room/player row locks added
-- in 22 (which prevent concurrent starts from interleaving) are kept.
--
-- p_caller_id stays in the signature for compatibility with the
-- current client; we just no longer compare it to the host.

do $migration$
begin
  execute $sql$
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
as $body$
declare
  v_game_id uuid;
  v_existing_game_id uuid;
  v_existing_status text;
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

  update players set
    game_id = null,
    team = null,
    assigned_word = null,
    word_order = null,
    role = null
  where room_id = p_room_id;

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
$body$
  $sql$;
end
$migration$;
