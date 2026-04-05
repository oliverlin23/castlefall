import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';

const PLAYER_STORAGE_KEY = 'castlefall_player';
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface StoredPlayer {
  id: string;
  name: string;
  roomName: string;
}

function getStoredPlayer(): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storePlayer(id: string, name: string, roomName: string) {
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({ id, name, roomName }));
}

function clearStoredPlayer() {
  localStorage.removeItem(PLAYER_STORAGE_KEY);
}

export function usePlayers(roomId: string | undefined, activeGameId?: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
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
    setPlayersLoaded(true);
  }, [roomId]);

  const registerPlayer = useCallback(
    async (displayName: string) => {
      if (!roomId) return null;

      const trimmed = displayName.trim();
      if (!trimmed) return null;

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
          storePlayer(updated.id, trimmed, roomId);
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
      storePlayer(created.id, trimmed, roomId);
      return created;
    },
    [roomId],
  );

  const tryReconnect = useCallback(async () => {
    if (!roomId) return null;
    setReconnecting(true);

    const stored = getStoredPlayer();

    // Try by stored UUID first
    if (stored?.id) {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('id', stored.id)
        .eq('room_id', roomId)
        .single();

      if (data) {
        await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', data.id);
        setCurrentPlayer({ ...data, last_seen: new Date().toISOString() });
        storePlayer(data.id, data.display_name, roomId);
        setReconnecting(false);
        return data;
      }
    }

    // Fall back to name matching
    if (stored?.name) {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('display_name', stored.name)
        .single();

      if (data) {
        await supabase
          .from('players')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', data.id);
        setCurrentPlayer({ ...data, last_seen: new Date().toISOString() });
        storePlayer(data.id, data.display_name, roomId);
        setReconnecting(false);
        return data;
      }
    }

    setReconnecting(false);
    return null;
  }, [roomId]);

  const leaveRoom = useCallback(async () => {
    if (!currentPlayer) return;
    await supabase.from('players').delete().eq('id', currentPlayer.id);
    clearStoredPlayer();
    setCurrentPlayer(null);
  }, [currentPlayer]);

  const kickPlayer = useCallback(async (playerId: string) => {
    if (!currentPlayer || playerId === currentPlayer.id) return;
    await supabase.from('players').delete().eq('id', playerId);
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

  const storedPlayer = getStoredPlayer();

  return {
    players,
    currentPlayer,
    reconnecting,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    kickPlayer,
    storedName: storedPlayer?.name ?? '',
    playersLoaded,
  };
}
