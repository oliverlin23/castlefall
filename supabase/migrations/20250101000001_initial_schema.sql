-- Castlefall database schema
-- Run this in the Supabase SQL editor to set up the database.

-- Rooms
create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now() not null,
  current_game_id uuid,
  active boolean not null default true
);

-- Games
create table if not exists games (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  word_list_name text not null default 'default',
  game_words jsonb not null default '[]',
  team_words jsonb not null default '{}',
  started_at timestamptz default now() not null,
  ended_at timestamptz,
  status text not null default 'active' check (status in ('waiting', 'active', 'revealed')),
  declaration_type text check (declaration_type in ('team', 'word')),
  declaration_player_id uuid,
  declaration_player_name text,
  declaration_data jsonb,
  declaration_at timestamptz,
  reveal_votes jsonb not null default '[]'
);

alter table rooms
  add constraint fk_rooms_current_game
  foreign key (current_game_id)
  references games(id)
  on delete set null;

-- Players
create table if not exists players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references games(id) on delete set null,
  room_id uuid references rooms(id) on delete cascade not null,
  display_name text not null,
  team integer,
  assigned_word text,
  word_order jsonb,
  joined_at timestamptz default now() not null,
  last_seen timestamptz default now() not null
);

-- Chat messages
create table if not exists chat_messages (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id) on delete cascade not null,
  player_name text not null,
  message text not null,
  created_at timestamptz default now() not null
);

-- Word lists
create table if not exists word_lists (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  words jsonb not null default '[]',
  created_at timestamptz default now() not null
);

-- Unique name per room (enables reconnect-by-name)
create unique index if not exists idx_players_room_name
  on players(room_id, display_name);

-- Indexes
create index if not exists idx_players_room_id on players(room_id);
create index if not exists idx_players_game_id on players(game_id);
create index if not exists idx_games_room_id on games(room_id);
create index if not exists idx_chat_messages_room_id on chat_messages(room_id);

-- Enable realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table chat_messages;

-- Row Level Security
alter table rooms enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table chat_messages enable row level security;
alter table word_lists enable row level security;

-- Policies: allow all operations for anonymous users (anon role)
-- Rooms
create policy "rooms_select" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (true);
create policy "rooms_update" on rooms for update using (true);

-- Games
create policy "games_select" on games for select using (true);
create policy "games_insert" on games for insert with check (true);
create policy "games_update" on games for update using (true);

-- Players
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);
create policy "players_update" on players for update using (true);
create policy "players_delete" on players for delete using (true);

-- Chat messages
create policy "chat_select" on chat_messages for select using (true);
create policy "chat_insert" on chat_messages for insert with check (true);

-- Word lists
create policy "word_lists_select" on word_lists for select using (true);
create policy "word_lists_insert" on word_lists for insert with check (true);

-- Function to get or create a room by name
create or replace function get_or_create_room(room_name text)
returns uuid
language plpgsql
as $$
declare
  room_id uuid;
begin
  select id into room_id from rooms where name = room_name;
  if room_id is null then
    insert into rooms (name) values (room_name) returning id into room_id;
  end if;
  return room_id;
end;
$$;
