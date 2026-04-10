import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, Player, Game } from '../types';

export interface RoomSubscriptionCallbacks {
  onRoomUpdate: (room: Room) => void;
  onPlayerEvent: (eventType: string, payload: { new?: Player; old?: Player }) => void;
  onGameUpdate: (game: Game) => void;
}

/**
 * Consolidates room, players, and game subscriptions into a single
 * Supabase Realtime channel per room. Chat stays separate (lazy).
 */
export function useRoomSubscription(
  roomId: string | undefined,
  callbacks: RoomSubscriptionCallbacks,
) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);
}
