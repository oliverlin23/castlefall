-- Add winner_team column for scoring/history.
alter table games add column if not exists winner_team integer;
