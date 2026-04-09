import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Game, GameSettings } from '../types';

const DEFAULT_SETTINGS: GameSettings = { wordCount: 18, timerDurationMs: 60000 };

export function useGame(roomId: string | undefined, currentGameId: string | null | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  const [pastGames, setPastGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch current game
  useEffect(() => {
    if (!currentGameId) {
      setGame(null);
      return;
    }

    setLoading(true);
    supabase
      .from('games')
      .select('*')
      .eq('id', currentGameId)
      .single()
      .then(({ data }) => {
        if (data) setGame(data);
        setLoading(false);
      });
  }, [currentGameId]);

  // Fetch past games for this room
  useEffect(() => {
    if (!roomId) return;
    supabase
      .from('games')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'revealed')
      .order('ended_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setPastGames(data);
      });
  }, [roomId]);

  /** Handle game update from the unified subscription. */
  const handleGameUpdate = useCallback(
    (updated: Game) => {
      // Only process updates for the current game
      if (game?.id && updated.id === game.id) {
        setGame(updated);
      }
      if (updated.status === 'revealed') {
        setPastGames((prev) => {
          if (prev.some((g) => g.id === updated.id)) {
            return prev.map((g) => (g.id === updated.id ? updated : g));
          }
          return [updated, ...prev];
        });
      }
    },
    [game?.id],
  );

  const startGame = useCallback(
    async (wordList: string[], wordListName: string, settings: GameSettings = DEFAULT_SETTINGS) => {
      if (!roomId) return null;

      const { data: gameId, error } = await supabase.rpc('start_game_atomic', {
        p_room_id: roomId,
        p_words: wordList,
        p_word_list_name: wordListName,
        p_settings: settings,
      });

      if (error || !gameId) {
        console.error('Failed to start game:', error);
        return null;
      }

      const { data: newGame } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (newGame) setGame(newGame);
      return newGame;
    },
    [roomId],
  );

  const revealGame = useCallback(async () => {
    if (!game?.id) return;
    await supabase.rpc('reveal_game', { p_game_id: game.id });
  }, [game?.id]);

  const declareTeam = useCallback(
    async (_playerId: string, _playerName: string, selectedPlayerIds: string[]) => {
      if (!game?.id) return false;
      const { data, error } = await supabase.rpc('declare_team_atomic', {
        p_game_id: game.id,
        p_player_id: _playerId,
        p_player_name: _playerName,
        p_selected: selectedPlayerIds,
      });
      return !error && data === true;
    },
    [game?.id],
  );

  const declareWord = useCallback(
    async (playerId: string, playerName: string, guessedWord: string) => {
      if (!game?.id) return false;

      const { data, error } = await supabase.rpc('declare_word_atomic', {
        p_game_id: game.id,
        p_player_id: playerId,
        p_player_name: playerName,
        p_guessed_word: guessedWord,
      });

      return !error && data === true;
    },
    [game?.id],
  );

  const voteToReveal = useCallback(
    async (playerId: string, playerCount: number) => {
      if (!game?.id) return;
      await supabase.rpc('vote_to_reveal', {
        p_game_id: game.id,
        p_player_id: playerId,
        p_player_count: playerCount,
      });
    },
    [game?.id],
  );

  const unvoteToReveal = useCallback(
    async (playerId: string) => {
      if (!game?.id) return;
      await supabase.rpc('unvote_to_reveal', {
        p_game_id: game.id,
        p_player_id: playerId,
      });
    },
    [game?.id],
  );

  return { game, pastGames, loading, startGame, revealGame, declareTeam, declareWord, voteToReveal, unvoteToReveal, handleGameUpdate };
}
