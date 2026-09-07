import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, Player, Game } from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RoomSubscriptionCallbacks {
  onRoomUpdate: (room: Room) => void;
  onPlayerEvent: (eventType: string, payload: { new?: Player; old?: Player }) => void;
  onGameUpdate: (game: Game) => void;
  /** The set of player ids currently tracked on the presence channel. */
  onPresenceSync: (connectedIds: Set<string>) => void;
  /** The tab came back to the foreground; state may have moved on without us. */
  onResume: () => void;
}

export interface PresenceIdentity {
  playerId: string;
  displayName: string;
}

/**
 * One Supabase Realtime channel per room carrying row changes for rooms,
 * players and games, plus Presence.
 *
 * Presence is informational only. A dropped websocket (locked phone,
 * backgrounded tab) makes the player show as away; it does not remove them.
 * Removal is the job of prune_stale_players, fed by useHeartbeat.
 */
export function useRoomSubscription(
  roomId: string | undefined,
  callbacks: RoomSubscriptionCallbacks,
  identity: PresenceIdentity | null,
) {
  const cbRef = useRef(callbacks);
  const identityRef = useRef(identity);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    cbRef.current = callbacks;
    identityRef.current = identity;
  }, [callbacks, identity]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-all-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            cbRef.current.onRoomUpdate(payload.new as Room);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        (payload) => {
          cbRef.current.onPlayerEvent(payload.eventType, {
            new: payload.new as Player | undefined,
            old: payload.old as Player | undefined,
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            cbRef.current.onGameUpdate(payload.new as Game);
          }
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceIdentity>();
        const ids = new Set<string>();
        for (const refs of Object.values(state)) {
          for (const r of refs) if (r.playerId) ids.add(r.playerId);
        }
        cbRef.current.onPresenceSync(ids);
      })
      .subscribe();

    channelRef.current = channel;

    // Mobile browsers close or starve the websocket while the tab is hidden.
    // supabase-js reconnects with backoff, but its timers are throttled too,
    // so on return we reconnect eagerly, re-announce presence, and let the
    // page refetch anything it might have missed.
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (!supabase.realtime.isConnected()) supabase.realtime.connect();
      if (identityRef.current) channel.track(identityRef.current);
      cbRef.current.onResume();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleBeforeUnload = () => {
      if (identityRef.current) channel.untrack();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Presence is tracked separately so an identity change doesn't tear the
  // channel down.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !identity) return;
    channel.track(identity);
  }, [identity]);
}
