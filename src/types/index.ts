export type GameType = 'castlefall' | 'two_rooms';

export interface Room {
  id: string;
  name: string;
  created_at: string;
  current_game_id: string | null;
  active: boolean;
  game_type: GameType;
}

export interface CastlefallSettings {
  wordCount: 12 | 18 | 24;
  timerDurationMs: 30000 | 60000 | 90000;
}

export interface TwoRoomsSettings {
  roundsTotal: number;
  roundDurationsMs: number[];
  hostagesPerRound: number[];
}

export type GameSettings = CastlefallSettings | TwoRoomsSettings;

export interface Game {
  id: string;
  room_id: string;
  game_type: GameType;
  word_list_name: string;
  game_words: string[];
  team_words: Record<number, string>;
  started_at: string;
  ended_at: string | null;
  status: 'waiting' | 'active' | 'revealed';
  declaration_type: 'team' | 'word' | null;
  declaration_player_id: string | null;
  declaration_player_name: string | null;
  declaration_data: { selectedPlayers?: string[]; guessedWord?: string } | null;
  declaration_at: string | null;
  reveal_votes: string[];
  settings: GameSettings;
  game_state: Record<string, unknown>;
  winner_team: number | null;
  player_teams: Record<string, { team: number; name: string }>;
}

export interface TwoRoomsRole {
  room: 'a' | 'b';
  character: string;
  team: 'red' | 'blue' | 'grey';
}

export interface Player {
  id: string;
  game_id: string | null;
  room_id: string;
  display_name: string;
  team: number | null;
  assigned_word: string | null;
  word_order: string[] | null;
  joined_at: string;
  last_seen: string;
  role: TwoRoomsRole | Record<string, unknown> | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  player_name: string;
  message: string;
  created_at: string;
}

export interface WordList {
  id: string;
  name: string;
  words: string[];
  created_at: string;
}

export type GamePhase = 'lobby' | 'playing' | 'revealed';
