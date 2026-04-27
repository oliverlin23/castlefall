import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';

const PLAYER_STORAGE_KEY = 'castlefall_player';

interface StoredPlayer {
  id: string;
  name: string;
  // The field is named roomName for backwards-compatibility with values
  // already in users' localStorage, but it actually holds the room id (uuid).
  roomName: string;
}

function readStoredPlayer(): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Only returns the stored player when it belongs to the room we're in.
// Without this guard, opening room B in another tab would overwrite the
// single localStorage key, and reloading room A would silently re-register
// the user under room B's identity.
function getStoredPlayerForRoom(roomId: string | undefined): StoredPlayer | null {
  if (!roomId) return null;
  const stored = readStoredPlayer();
  if (!stored || stored.roomName !== roomId) return null;
  return stored;
}

function storePlayer(id: string, name: string, roomId: string) {
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify({ id, name, roomName: roomId }));
}

function clearStoredPlayer() {
  localStorage.removeItem(PLAYER_STORAGE_KEY);
}

export function usePlayers(roomId: string | undefined, currentGameId?: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const tombstonesRef = useRef<Set<string>>(new Set());
  const eventsSeenRef = useRef(false);

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });
    if (data) {
      setPlayers((prev) => {
        const filtered = data.filter((p) => !tombstonesRef.current.has(p.id));
        // If realtime has already mutated `prev`, trust prev for any id it knows;
        // only add rows from the snapshot that prev hasn't seen.
        if (!eventsSeenRef.current) return filtered;
        const byId = new Map(prev.map((p) => [p.id, p]));
        for (const p of filtered) if (!byId.has(p.id)) byId.set(p.id, p);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
        );
      });
      // Resync currentPlayer from authoritative DB state in case a realtime
      // UPDATE for this player was dropped (e.g. start_game_atomic assigned
      // the team / word but the per-row CDC never arrived).
      setCurrentPlayer((cur) => {
        if (!cur) return cur;
        if (tombstonesRef.current.has(cur.id)) return cur;
        return data.find((p) => p.id === cur.id) ?? cur;
      });
    }
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
        supabase.rpc('update_heartbeat', { p_player_id: existing.id });
        setCurrentPlayer(existing);
        storePlayer(existing.id, trimmed, roomId);
        return existing;
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

    const stored = getStoredPlayerForRoom(roomId);

    // Try by stored UUID first
    if (stored?.id) {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('id', stored.id)
        .eq('room_id', roomId)
        .single();

      if (data) {
        supabase.rpc('update_heartbeat', { p_player_id: data.id });
        setCurrentPlayer(data);
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
        supabase.rpc('update_heartbeat', { p_player_id: data.id });
        setCurrentPlayer(data);
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

  // Fetch players on mount, and resync whenever a new game starts so we
  // pick up team / assigned_word even if individual row CDC events were
  // dropped between start_game_atomic's per-player updates and the final
  // rooms.current_game_id update.
  useEffect(() => {
    if (!roomId) return;
    fetchPlayers();
  }, [roomId, currentGameId, fetchPlayers]);

  /** Handle player events from the unified subscription. */
  const handlePlayerEvent = useCallback(
    (eventType: string, payload: { new?: Player; old?: Player }) => {
      eventsSeenRef.current = true;
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
        tombstonesRef.current.add(deletedId);
        setPlayers((prev) => prev.filter((p) => p.id !== deletedId));
        setCurrentPlayer((cur) => (cur && cur.id === deletedId ? null : cur));
      }
    },
    [],
  );

  const storedPlayer = getStoredPlayerForRoom(roomId);

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
