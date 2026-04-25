import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, Player, Game } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentPlayerIdRef = useRef(currentPlayerId);
  currentPlayerIdRef.current = currentPlayerId;

  // Create channel once per room — does NOT depend on player identity
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-all-${roomId}`)
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
        const currentPlayers = playersRef.current;
        const hostId = currentPlayers.length > 0 ? currentPlayers[0].id : null;
        const myId = currentPlayerIdRef.current;

        for (const presence of leftPresences) {
          const state = presence as unknown as PresenceState;
          const departedId = state.playerId;
          if (!departedId || departedId === '_unregistered') continue;

          let shouldCleanup = false;
          if (hostId === myId) {
            shouldCleanup = true;
          } else if (departedId === hostId) {
            const nextHost = currentPlayers.find((p) => p.id !== departedId);
            shouldCleanup = nextHost?.id === myId;
          }

          if (shouldCleanup) {
            supabase.rpc('release_disconnected_player', { p_player_id: departedId }).then();
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    const handleBeforeUnload = () => {
      if (currentPlayerIdRef.current) {
        channel.untrack();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Track/update presence separately — no channel teardown on identity change
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !currentPlayerId || !currentPlayerName) return;

    channel.track({
      playerId: currentPlayerId,
      displayName: currentPlayerName,
    } satisfies PresenceState);
  }, [currentPlayerId, currentPlayerName]);
}
