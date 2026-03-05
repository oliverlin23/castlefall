import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { buildGameData } from '../lib/gameLogic';
import { computeWinner } from '../lib/scoring';
import type { Game, GameSettings, Player } from '../types';

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

  // Subscribe to game updates
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`game-${game.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${game.id}`,
        },
        (payload) => {
          const updated = payload.new as Game;
          setGame(updated);
          if (updated.status === 'revealed') {
            setPastGames((prev) => {
              if (prev.some((g) => g.id === updated.id)) {
                return prev.map((g) => (g.id === updated.id ? updated : g));
              }
              return [updated, ...prev];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  const startGame = useCallback(
    async (players: Player[], wordList: string[], wordListName: string, settings: GameSettings = DEFAULT_SETTINGS) => {
      if (!roomId || players.length < 4) return null;

      const playerIds = players.map((p) => p.id);
      const { gameWords, teamWords, playerData } = buildGameData(playerIds, wordList, settings.wordCount);

      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          word_list_name: wordListName,
          game_words: gameWords,
          team_words: teamWords,
          status: 'active',
          settings,
        })
        .select()
        .single();

      if (gameError || !newGame) {
        console.error('Failed to create game:', gameError);
        return null;
      }

      const updatePromises = playerData.map((pd) =>
        supabase
          .from('players')
          .update({
            game_id: newGame.id,
            team: pd.team,
            assigned_word: pd.assignedWord,
            word_order: pd.wordOrder,
          })
          .eq('id', pd.id),
      );
      await Promise.all(updatePromises);

      await supabase
        .from('rooms')
        .update({ current_game_id: newGame.id })
        .eq('id', roomId);

      setGame(newGame);
      return newGame;
    },
    [roomId],
  );

  const revealGame = useCallback(async (players?: Player[]) => {
    if (!game?.id) return;
    const winner = players ? computeWinner(game, players) : null;
    await supabase
      .from('games')
      .update({
        status: 'revealed',
        ended_at: new Date().toISOString(),
        winner_team: winner,
      })
      .eq('id', game.id);
  }, [game]);

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

      const { error } = await supabase
        .from('games')
        .update({
          declaration_type: 'word',
          declaration_player_id: playerId,
          declaration_player_name: playerName,
          declaration_data: { guessedWord },
          declaration_at: new Date().toISOString(),
          status: 'revealed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', game.id);

      return !error;
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

  return { game, pastGames, loading, startGame, revealGame, declareTeam, declareWord, voteToReveal, unvoteToReveal };
}
