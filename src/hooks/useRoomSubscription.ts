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

// Grace window before treating a presence-leave as a real disconnect.
// A page reload fires untrack() then re-tracks within ~1s; waiting here
// lets the reload cancel its own cleanup so no row churn happens.
const DISCONNECT_GRACE_MS = 4000;

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

    const pendingCleanups = new Map<string, ReturnType<typeof setTimeout>>();

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
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        for (const presence of newPresences) {
          const state = presence as unknown as PresenceState;
          const joinedId = state.playerId;
          if (!joinedId) continue;
          const pending = pendingCleanups.get(joinedId);
          if (pending) {
            clearTimeout(pending);
            pendingCleanups.delete(joinedId);
          }
        }
      })
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
            const existing = pendingCleanups.get(departedId);
            if (existing) clearTimeout(existing);
            const handle = setTimeout(() => {
              pendingCleanups.delete(departedId);
              // Belt-and-suspenders: if the player has re-tracked under any
              // presence ref by now, the join event may have raced past us.
              // Skip the delete if presence still claims this playerId.
              const state = channel.presenceState() as Record<string, PresenceState[]>;
              for (const refs of Object.values(state)) {
                for (const r of refs) {
                  if (r?.playerId === departedId) return;
                }
              }
              supabase.rpc('release_disconnected_player', { p_player_id: departedId }).then();
            }, DISCONNECT_GRACE_MS);
            pendingCleanups.set(departedId, handle);
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
      for (const handle of pendingCleanups.values()) clearTimeout(handle);
      pendingCleanups.clear();
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
