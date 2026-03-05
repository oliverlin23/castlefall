-- Add settings column to games for configurable word count and timer.
alter table games add column if not exists settings jsonb not null default '{}';
