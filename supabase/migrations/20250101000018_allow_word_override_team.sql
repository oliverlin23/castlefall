-- Allow the declaration_type to transition from 'team' to 'word' so that a
-- counter word guess during an active team declaration can end the game.
-- All other declaration_type changes remain forbidden.

create or replace function enforce_game_state_machine()
returns trigger
language plpgsql
as $$
begin
  if OLD.status = 'revealed' then
    raise exception 'Cannot modify a revealed game';
  end if;

  if OLD.status = 'active' and NEW.status not in ('active', 'revealed') then
    raise exception 'Active games can only transition to revealed, got: %', NEW.status;
  end if;

  if OLD.declaration_type is not null
     and NEW.declaration_type is distinct from OLD.declaration_type
     and not (OLD.declaration_type = 'team' and NEW.declaration_type = 'word') then
    raise exception 'Cannot change declaration type once set';
  end if;

  return NEW;
end;
$$;
