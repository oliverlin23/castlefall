import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';

const PLAYER_STORAGE_KEY = 'castlefall_player';

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

export function usePlayers(roomId: string | undefined) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);

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
        await supabase.rpc('update_heartbeat', { p_player_id: existing.id });
        const { data: refreshed } = await supabase
          .from('players')
          .select('*')
          .eq('id', existing.id)
          .single();
        if (refreshed) {
          setCurrentPlayer(refreshed);
          storePlayer(refreshed.id, trimmed, roomId);
          return refreshed;
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
        await supabase.rpc('update_heartbeat', { p_player_id: data.id });
        const { data: refreshed } = await supabase
          .from('players')
          .select('*')
          .eq('id', data.id)
          .single();
        if (refreshed) {
          setCurrentPlayer(refreshed);
          storePlayer(refreshed.id, refreshed.display_name, roomId);
        }
        setReconnecting(false);
        return refreshed;
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
        await supabase.rpc('update_heartbeat', { p_player_id: data.id });
        const { data: refreshed } = await supabase
          .from('players')
          .select('*')
          .eq('id', data.id)
          .single();
        if (refreshed) {
          setCurrentPlayer(refreshed);
          storePlayer(refreshed.id, refreshed.display_name, roomId);
        }
        setReconnecting(false);
        return refreshed;
      }
    }

    setReconnecting(false);
    return null;
  }, [roomId]);

  const leaveRoom = useCallback(async () => {
    if (!currentPlayer) return;
    await supabase.rpc('leave_room', { p_player_id: currentPlayer.id });
    clearStoredPlayer();
    setCurrentPlayer(null);
  }, [currentPlayer]);

  const kickPlayer = useCallback(async (playerId: string) => {
    if (!currentPlayer || playerId === currentPlayer.id) return;
    await supabase.rpc('kick_player', {
      p_kicker_id: currentPlayer.id,
      p_target_id: playerId,
    });
  }, [currentPlayer]);

  // Fetch players on mount
  useEffect(() => {
    if (!roomId) return;
    fetchPlayers();
  }, [roomId, fetchPlayers]);

  /** Handle player events from the unified subscription. */
  const handlePlayerEvent = useCallback(
    (eventType: string, payload: { new?: Player; old?: Player }) => {
      if (eventType === 'INSERT' && payload.new) {
        const newPlayer = payload.new;
        setPlayers((prev) => {
          if (prev.some((p) => p.id === newPlayer.id)) return prev;
          return [...prev, newPlayer];
        });
      } else if (eventType === 'UPDATE' && payload.new) {
        const updated = payload.new;
        setPlayers((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        setCurrentPlayer((cur) => (cur && cur.id === updated.id ? updated : cur));
      } else if (eventType === 'DELETE' && payload.old) {
        const deletedId = payload.old.id;
        setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
        setCurrentPlayer((cur) => (cur && cur.id === deletedId ? null : cur));
      }
    },
    [],
  );

  const storedPlayer = getStoredPlayer();

  return {
    players,
    currentPlayer,
    reconnecting,
    registerPlayer,
    tryReconnect,
    leaveRoom,
    kickPlayer,
    handlePlayerEvent,
    storedName: storedPlayer?.name ?? '',
    playersLoaded,
  };
}
