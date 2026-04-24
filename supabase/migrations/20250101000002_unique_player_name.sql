-- Migration: enforce unique player names per room
-- Run this if you already ran the original schema.sql

-- Remove any current duplicates (keep the most recently seen one)
delete from players a
using players b
where a.room_id = b.room_id
  and a.display_name = b.display_name
  and a.last_seen < b.last_seen;

-- Add unique constraint
create unique index if not exists idx_players_room_name
  on players(room_id, display_name);
