-- Atomic vote/unvote/declare operations to prevent race conditions.

-- Atomically add a player's vote to reveal. Auto-reveals if threshold met.
create or replace function vote_to_reveal(
  p_game_id uuid,
  p_player_id uuid,
  p_player_count int
)
returns void
language plpgsql
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

-- Atomically remove a player's vote to reveal.
create or replace function unvote_to_reveal(
  p_game_id uuid,
  p_player_id uuid
)
returns void
language plpgsql
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

  -- Remove the player from the array
  new_votes := '[]'::jsonb;
  for i in 0..jsonb_array_length(current_votes) - 1 loop
    if current_votes->i != to_jsonb(p_player_id::text) then
      new_votes := new_votes || jsonb_build_array(current_votes->i);
    end if;
  end loop;

  update games set reveal_votes = new_votes where id = p_game_id;
end;
$$;

-- Atomically declare a team, only if no declaration exists yet.
create or replace function declare_team_atomic(
  p_game_id uuid,
  p_player_id uuid,
  p_player_name text,
  p_selected jsonb
)
returns boolean
language plpgsql
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
