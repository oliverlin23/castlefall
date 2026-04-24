-- Migration: room active flag, declaration fields, reveal votes
-- Run this if you already ran the original schema.sql

-- Room active flag
alter table rooms add column if not exists active boolean not null default true;

-- Declaration fields on games
alter table games add column if not exists declaration_type text
  check (declaration_type in ('team', 'word'));
alter table games add column if not exists declaration_player_id uuid;
alter table games add column if not exists declaration_player_name text;
alter table games add column if not exists declaration_data jsonb;
alter table games add column if not exists declaration_at timestamptz;

-- Reveal votes
alter table games add column if not exists reveal_votes jsonb not null default '[]';
