import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, Player, Game } from '../types';

export interface RoomSubscriptionCallbacks {
  onRoomUpdate: (room: Room) => void;
  onPlayerEvent: (eventType: string, payload: { new?: Player; old?: Player }) => void;
  onGameUpdate: (game: Game) => void;
}

interface PresenceState {
  playerId: string;
  displayName: string;
}

/**
 * Consolidates room, players, and game subscriptions into a single
 * Supabase Realtime channel per room. Also handles Presence tracking
 * for instant disconnect detection (replaces heartbeat polling).
 */
export function useRoomSubscription(
  roomId: string | undefined,
  callbacks: RoomSubscriptionCallbacks,
  currentPlayerId: string | undefined,
  currentPlayerName: string | undefined,
  players: Player[],
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const playersRef = useRef(players);
  playersRef.current = players;

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-all-${roomId}`, {
        config: {
          presence: { key: currentPlayerId ?? '_unregistered' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            cbRef.current.onRoomUpdate(payload.new as Room);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          cbRef.current.onPlayerEvent(payload.eventType, {
            new: payload.new as Player | undefined,
            old: payload.old as Player | undefined,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            cbRef.current.onGameUpdate(payload.new as Game);
          }
        },
      )
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        // When a client disconnects, clean up their player record.
        // Only the host (first player in list) handles cleanup to avoid
        // N clients all calling leave_room simultaneously.
        const currentPlayers = playersRef.current;
        const hostId = currentPlayers.length > 0 ? currentPlayers[0].id : null;

        for (const presence of leftPresences) {
          const state = presence as unknown as PresenceState;
          const departedId = state.playerId;
          if (!departedId || departedId === '_unregistered') continue;

          // Determine if we should handle this cleanup
          let shouldCleanup = false;
          if (hostId === currentPlayerId) {
            // We are the host — handle it
            shouldCleanup = true;
          } else if (departedId === hostId) {
            // The host left — the next player in line handles it
            const nextHost = currentPlayers.find((p) => p.id !== departedId);
            shouldCleanup = nextHost?.id === currentPlayerId;
          }

          if (shouldCleanup) {
            supabase.rpc('leave_room', { p_player_id: departedId }).then();
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentPlayerId && currentPlayerName) {
          await channel.track({
            playerId: currentPlayerId,
            displayName: currentPlayerName,
          } satisfies PresenceState);
        }
      });

    // Explicitly untrack on tab close for instant disconnect detection.
    // Without this, Supabase detects the WebSocket drop after ~5-10s.
    const handleBeforeUnload = () => {
      if (currentPlayerId) {
        channel.untrack();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(channel);
    };
  }, [roomId, currentPlayerId, currentPlayerName]);
}
