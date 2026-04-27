import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Game, CastlefallSettings } from '../types';

const DEFAULT_SETTINGS: CastlefallSettings = { wordCount: 18, timerDurationMs: 60000 };

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
    async (
      callerId: string,
      wordList: string[],
      wordListName: string,
      settings: CastlefallSettings = DEFAULT_SETTINGS,
    ) => {
      if (!roomId) return null;

      const { data: gameId, error } = await supabase.rpc('start_game_atomic', {
        p_room_id: roomId,
        p_caller_id: callerId,
        p_words: wordList,
        p_word_list_name: wordListName,
        p_settings: settings,
      });

      if (error || !gameId) {
        console.error('Failed to start game:', error);
        return null;
      }

      // No need to fetch the game — the RPC updates rooms.current_game_id,
      // which triggers CDC → room subscription → currentGameId effect → fetch.
      return gameId;
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
    async (playerId: string) => {
      if (!game?.id) return;
      // Optimistic: add vote immediately
      setGame((prev) => {
        if (!prev) return prev;
        const votes = Array.isArray(prev.reveal_votes) ? prev.reveal_votes : [];
        if (votes.includes(playerId)) return prev;
        return { ...prev, reveal_votes: [...votes, playerId] };
      });
      await supabase.rpc('vote_to_reveal', {
        p_game_id: game.id,
        p_player_id: playerId,
      });
    },
    [game?.id],
  );

  const unvoteToReveal = useCallback(
    async (playerId: string) => {
      if (!game?.id) return;
      // Optimistic: remove vote immediately
      setGame((prev) => {
        if (!prev) return prev;
        const votes = Array.isArray(prev.reveal_votes) ? prev.reveal_votes : [];
        return { ...prev, reveal_votes: votes.filter((id) => id !== playerId) };
      });
      await supabase.rpc('unvote_to_reveal', {
        p_game_id: game.id,
        p_player_id: playerId,
      });
    },
    [game?.id],
  );

  const returnToLobby = useCallback(async () => {
    if (!roomId) return;
    await supabase.rpc('return_to_lobby', { p_room_id: roomId });
  }, [roomId]);

  const startTwoRoomsGame = useCallback(async () => {
    if (!roomId) return null;
    const { data: gameId, error } = await supabase.rpc('start_two_rooms_game', {
      p_room_id: roomId,
    });
    if (error || !gameId) {
      console.error('Failed to start two_rooms game:', error);
      return null;
    }
    return gameId as string;
  }, [roomId]);

  return { game, pastGames, loading, startGame, startTwoRoomsGame, revealGame, declareTeam, declareWord, voteToReveal, unvoteToReveal, returnToLobby, handleGameUpdate };
}
