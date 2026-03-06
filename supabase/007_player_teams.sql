-- Store per-game player-team mapping so we can compute per-player wins
-- even after teams are reassigned in subsequent rounds.
alter table games add column if not exists player_teams jsonb not null default '{}';
