import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const HEARTBEAT_MS = 45_000;

/**
 * Keeps players.last_seen fresh so prune_stale_players can tell an idle tab
 * from an abandoned one. Beats only while the tab is visible: a locked phone
 * stops beating and is pruned after the server-side grace period, which is
 * the intended behaviour.
 */
export function useHeartbeat(playerId: string | undefined) {
  useEffect(() => {
    if (!playerId) return;

    function beat() {
      if (document.visibilityState !== 'visible') return;
      supabase.rpc('update_heartbeat', { p_player_id: playerId }).then();
    }

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [playerId]);
}
