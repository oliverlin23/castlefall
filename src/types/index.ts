export interface Room {
  id: string;
  name: string;
  created_at: string;
  current_game_id: string | null;
  active: boolean;
}

export interface GameSettings {
  wordCount: 12 | 18 | 24;
  timerDurationMs: 30000 | 60000 | 90000;
}

export interface Game {
  id: string;
  room_id: string;
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
  winner_team: number | null;
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
