-- Allow a word guess to override an in-progress team declaration.
-- Previously declare_word_atomic only matched games where declaration_type
-- is null, so the "counter with a word guess" form silently no-op'd once a
-- team declaration timer was running.

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
    and (declaration_type is null or declaration_type = 'team')
  for update;

  if v_game is null then
    return false;
  end if;

  v_declarer_team := (v_game.player_teams->p_player_id::text->>'team')::int;
  if v_declarer_team is null then
    return false;
  end if;

  v_other_team := case when v_declarer_team = 1 then 2 else 1 end;
  v_other_team_word := v_game.team_words->>v_other_team::text;

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
