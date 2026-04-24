-- Phase 3: State machine trigger on games table
-- Prevents invalid state transitions even if someone bypasses the RPCs.

create or replace function enforce_game_state_machine()
returns trigger
language plpgsql
as $$
begin
  -- Revealed games are immutable
  if OLD.status = 'revealed' then
    raise exception 'Cannot modify a revealed game';
  end if;

  -- Active games can only transition to 'active' or 'revealed'
  if OLD.status = 'active' and NEW.status not in ('active', 'revealed') then
    raise exception 'Active games can only transition to revealed, got: %', NEW.status;
  end if;

  -- Once a declaration is set, it cannot be changed
  if OLD.declaration_type is not null and NEW.declaration_type is distinct from OLD.declaration_type then
    raise exception 'Cannot change declaration type once set';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_game_state_machine on games;

create trigger trg_game_state_machine
  before update on games
  for each row
  execute function enforce_game_state_machine();
