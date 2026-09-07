import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Room, GameType } from '../types';

export function useRoom(roomName: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  const joinRoom = useCallback(async (name: string) => {
    setLoading(true);

    const { data: roomId, error: rpcError } = await supabase.rpc('get_or_create_room', {
      room_name: name,
    });

    if (rpcError || !roomId) {
      console.error('Failed to get or create room:', rpcError);
      setLoading(false);
      return null;
    }

    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    setRoom(roomData);
    setLoading(false);
    return roomData;
  }, []);

  useEffect(() => {
    if (!roomName) return;
    joinRoom(roomName);
  }, [roomName, joinRoom]);

  const roomId = room?.id;

  /** Re-read the room row, e.g. after the tab was backgrounded and may have
   *  missed a current_game_id change. */
  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (data) setRoom(data);
  }, [roomId]);

  /** Handle room update from the unified subscription. */
  const handleRoomUpdate = useCallback((updated: Room) => {
    setRoom(updated);
  }, []);

  /** Change the game type for this room. Syncs to all clients via CDC. */
  const setGameType = useCallback(async (gameType: GameType) => {
    if (!roomId) return;
    // Optimistic
    setRoom((prev) => (prev ? { ...prev, game_type: gameType } : prev));
    await supabase.rpc('set_room_game_type', {
      p_room_id: roomId,
      p_game_type: gameType,
    });
  }, [roomId]);

  return { room, loading, joinRoom, handleRoomUpdate, refreshRoom, setGameType };
}
