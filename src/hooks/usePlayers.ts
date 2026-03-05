import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';

const PLAYER_NAME_KEY = 'castlefall_player_name';
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function getStoredPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) || '';
}

export function usePlayers(roomId: string | undefined, activeGameId?: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pruneRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data);
  }, [roomId]);

  const registerPlayer = useCallback(
    async (displayName: string) => {
      if (!roomId) return null;

      const trimmed = displayName.trim();
      if (!trimmed) return null;

      localStorage.setItem(PLAYER_NAME_KEY, trimmed);

      const { data: existing } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('display_name', trimmed)
        .single();

      if (existing) {
        const { data: updated } = await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (updated) {
          setCurrentPlayer(updated);
          return updated;
        }
      }

      const { data: created, error } = await supabase
        .from('players')
        .insert({ room_id: roomId, display_name: trimmed })
        .select()
        .single();

      if (error) {
        console.error('Failed to register player:', error);
        return null;
      }

      setCurrentPlayer(created);
      return created;
    },
    [roomId],
  );

  const tryReconnect = useCallback(async () => {
    if (!roomId) return null;
    const storedName = getStoredPlayerName();
    if (!storedName) return null;

    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('display_name', storedName)
      .single();

    if (data) {
      await supabase
        .from('players')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', data.id);
      setCurrentPlayer({ ...data, last_seen: new Date().toISOString() });
      return data;
    }
    return null;
  }, [roomId]);

  const leaveRoom = useCallback(async () => {
    if (!currentPlayer) return;
    await supabase.from('players').delete().eq('id', currentPlayer.id);
    localStorage.removeItem(PLAYER_NAME_KEY);
    setCurrentPlayer(null);
  }, [currentPlayer]);

  // Subscribe to player changes in this room
  useEffect(() => {
    if (!roomId) return;
    fetchPlayers();

    const channel = supabase
      .channel(`players-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => {
              if (prev.some((p) => p.id === (payload.new as Player).id)) return prev;
              return [...prev, payload.new as Player];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Player;
            setPlayers((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p)),
            );
            setCurrentPlayer((cur) => (cur && cur.id === updated.id ? updated : cur));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Player).id;
            setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
            setCurrentPlayer((cur) => (cur && cur.id === deletedId ? null : cur));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchPlayers]);

  // Heartbeat + periodic stale-player pruning
  useEffect(() => {
    if (!currentPlayer || !roomId) return;

    heartbeatRef.current = setInterval(async () => {
      await supabase
        .from('players')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', currentPlayer.id);
    }, 30_000);

    // Prune stale players who are NOT in the active game.
    // Players in an active game are protected so they can reconnect.
    pruneRef.current = setInterval(async () => {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
      let query = supabase
        .from('players')
        .delete()
        .eq('room_id', roomId)
        .lt('last_seen', cutoff);

      if (activeGameId) {
        query = query.or(`game_id.is.null,game_id.neq.${activeGameId}`);
      }

      await query;
    }, 60_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pruneRef.current) clearInterval(pruneRef.current);
    };
  }, [currentPlayer?.id, roomId, activeGameId]);

  return {
    players,
    currentPlayer,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    storedName: getStoredPlayerName(),
  };
}
