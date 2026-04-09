-- Phase 2: Tighten RLS policies + helper RPCs
-- After Phase 1 RPCs are SECURITY DEFINER, we can lock down direct table access.

-- ============================================================
-- Drop all existing permissive policies
-- ============================================================

-- Rooms
drop policy if exists "rooms_select" on rooms;
drop policy if exists "rooms_insert" on rooms;
drop policy if exists "rooms_update" on rooms;

-- Games
drop policy if exists "games_select" on games;
drop policy if exists "games_insert" on games;
drop policy if exists "games_update" on games;

-- Players
drop policy if exists "players_select" on players;
drop policy if exists "players_insert" on players;
drop policy if exists "players_update" on players;
drop policy if exists "players_delete" on players;

-- Chat messages
drop policy if exists "chat_select" on chat_messages;
drop policy if exists "chat_insert" on chat_messages;

-- Word lists
drop policy if exists "word_lists_select" on word_lists;
drop policy if exists "word_lists_insert" on word_lists;

-- ============================================================
-- Create new restrictive policies
-- ============================================================

-- Rooms: read-only
create policy "rooms_select" on rooms for select using (true);

-- Games: read-only
create policy "games_select" on games for select using (true);

-- Players: read + insert (registration), no update/delete
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);

-- Chat messages: read + insert
create policy "chat_select" on chat_messages for select using (true);
create policy "chat_insert" on chat_messages for insert with check (true);

-- Word lists: read-only
create policy "word_lists_select" on word_lists for select using (true);

-- ============================================================
-- Helper RPCs (all SECURITY DEFINER to bypass RLS)
-- ============================================================

-- Update player heartbeat (last_seen timestamp)
create or replace function update_heartbeat(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update players set last_seen = now() where id = p_player_id;
end;
$$;

-- Remove a player from their room (self-leave)
create or replace function leave_room(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from players where id = p_player_id;
end;
$$;

-- Kick a player (host-only: caller must be the earliest-joined player in the room)
create or replace function kick_player(p_kicker_id uuid, p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_room uuid;
  v_host_id uuid;
begin
  -- Find the target's room
  select room_id into v_target_room from players where id = p_target_id;
  if v_target_room is null then
    return false;
  end if;

  -- Find the host (earliest joined_at in the room)
  select id into v_host_id
  from players
  where room_id = v_target_room
  order by joined_at asc
  limit 1;

  -- Only the host can kick
  if v_host_id is null or v_host_id != p_kicker_id then
    return false;
  end if;

  delete from players where id = p_target_id;
  return true;
end;
$$;

-- Deactivate a room (mark inactive)
create or replace function deactivate_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rooms set active = false where id = p_room_id;
end;
$$;
