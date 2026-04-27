-- Phase 7: vote_to_reveal computes its threshold server-side.
--
-- The previous version accepted p_player_count from the client and used it
-- as the basis for the reveal threshold. A modified client could pass
-- p_player_count := 1 to instantly trigger a reveal. Even without abuse,
-- the client's count can be stale if a player joined or left between fetch
-- and call.
--
-- This version drops p_player_count and counts the players currently in
-- the game directly.

drop function if exists vote_to_reveal(uuid, uuid, int);

create or replace function vote_to_reveal(
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
  v_player_count int;
  threshold int;
begin
  select reveal_votes into current_votes
    from games where id = p_game_id and status = 'active'
    for update;

  if current_votes is null then return; end if;

  if current_votes @> to_jsonb(p_player_id::text) then return; end if;

  new_votes := current_votes || to_jsonb(p_player_id::text);

  select count(*) into v_player_count
  from players
  where game_id = p_game_id;

  threshold := ceil(v_player_count::numeric / 2);

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
