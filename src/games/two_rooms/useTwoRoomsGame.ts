import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export function useTwoRoomsGame(gameId: string | null | undefined) {
  const appointLeader = useCallback(
    async (appointerId: string, targetId: string) => {
      if (!gameId) return false;
      const { data, error } = await supabase.rpc('appoint_leader', {
        p_game_id: gameId,
        p_appointer_id: appointerId,
        p_target_id: targetId,
      });
      return !error && data === true;
    },
    [gameId],
  );

  const abdicateLeader = useCallback(
    async (leaderId: string, targetId: string) => {
      if (!gameId) return false;
      const { data, error } = await supabase.rpc('abdicate_leader', {
        p_game_id: gameId,
        p_leader_id: leaderId,
        p_target_id: targetId,
      });
      return !error && data === true;
    },
    [gameId],
  );

  const selectHostages = useCallback(
    async (leaderId: string, hostageIds: string[]) => {
      if (!gameId) return false;
      const { data, error } = await supabase.rpc('select_hostages', {
        p_game_id: gameId,
        p_leader_id: leaderId,
        p_hostage_ids: hostageIds,
      });
      return !error && data === true;
    },
    [gameId],
  );

  const advanceRound = useCallback(async () => {
    if (!gameId) return false;
    const { data, error } = await supabase.rpc('advance_round', {
      p_game_id: gameId,
    });
    return !error && data === true;
  }, [gameId]);

  const startRoundTimer = useCallback(
    async (leaderId: string) => {
      if (!gameId) return false;
      const { data, error } = await supabase.rpc('start_round_timer', {
        p_game_id: gameId,
        p_leader_id: leaderId,
      });
      return !error && data === true;
    },
    [gameId],
  );

  const usurpLeader = useCallback(
    async (voterId: string, targetId: string) => {
      if (!gameId) return false;
      const { data, error } = await supabase.rpc('usurp_leader', {
        p_game_id: gameId,
        p_voter_id: voterId,
        p_target_id: targetId,
      });
      return !error && data === true;
    },
    [gameId],
  );

  return { appointLeader, abdicateLeader, selectHostages, advanceRound, startRoundTimer, usurpLeader };
}
