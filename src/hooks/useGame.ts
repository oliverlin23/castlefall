import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { buildGameData } from '../lib/gameLogic';
import type { Game, Player } from '../types';

export function useGame(roomId: string | undefined, currentGameId: string | null | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

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
          setGame(payload.new as Game);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  const startGame = useCallback(
    async (players: Player[], wordList: string[], wordListName: string) => {
      if (!roomId || players.length < 2) return null;

      const playerIds = players.map((p) => p.id);
      const { gameWords, teamWords, playerData } = buildGameData(playerIds, wordList);

      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert({
          room_id: roomId,
          word_list_name: wordListName,
          game_words: gameWords,
          team_words: teamWords,
          status: 'active',
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

  const revealGame = useCallback(async () => {
    if (!game?.id) return;
    await supabase
      .from('games')
      .update({ status: 'revealed', ended_at: new Date().toISOString() })
      .eq('id', game.id);
  }, [game?.id]);

  /**
   * Method 1: Declare your team. Only succeeds if no declaration exists yet.
   */
  const declareTeam = useCallback(
    async (playerId: string, playerName: string, selectedPlayerIds: string[]) => {
      if (!game?.id) return false;

      const { error } = await supabase
        .from('games')
        .update({
          declaration_type: 'team',
          declaration_player_id: playerId,
          declaration_player_name: playerName,
          declaration_data: { selectedPlayers: selectedPlayerIds },
          declaration_at: new Date().toISOString(),
        })
        .eq('id', game.id)
        .is('declaration_type', null);

      return !error;
    },
    [game?.id],
  );

  /**
   * Method 2: Guess the other team's word. Overrides any active team
   * declaration and immediately reveals the game.
   */
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

  /**
   * Vote to reveal teams early. If enough players vote (>= half),
   * the game is revealed.
   */
  const voteToReveal = useCallback(
    async (playerId: string, playerCount: number) => {
      if (!game?.id) return;

      const currentVotes: string[] = Array.isArray(game.reveal_votes)
        ? game.reveal_votes
        : [];

      if (currentVotes.includes(playerId)) return;

      const newVotes = [...currentVotes, playerId];

      const threshold = Math.ceil(playerCount / 2);
      const shouldReveal = newVotes.length >= threshold;

      await supabase
        .from('games')
        .update({
          reveal_votes: newVotes,
          ...(shouldReveal
            ? { status: 'revealed' as const, ended_at: new Date().toISOString() }
            : {}),
        })
        .eq('id', game.id);
    },
    [game?.id, game?.reveal_votes],
  );

  const unvoteToReveal = useCallback(
    async (playerId: string) => {
      if (!game?.id) return;

      const currentVotes: string[] = Array.isArray(game.reveal_votes)
        ? game.reveal_votes
        : [];

      if (!currentVotes.includes(playerId)) return;

      const newVotes = currentVotes.filter((id) => id !== playerId);

      await supabase
        .from('games')
        .update({ reveal_votes: newVotes })
        .eq('id', game.id);
    },
    [game?.id, game?.reveal_votes],
  );

  return { game, loading, startGame, revealGame, declareTeam, declareWord, voteToReveal, unvoteToReveal };
}
