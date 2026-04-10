import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Room } from '../types';

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

  /** Handle room update from the unified subscription. */
  const handleRoomUpdate = useCallback((updated: Room) => {
    setRoom(updated);
  }, []);

  /** Mark room inactive (called when no players remain). */
  const deactivateRoom = useCallback(async () => {
    if (!room?.id) return;
    await supabase.rpc('deactivate_room', { p_room_id: room.id });
  }, [room?.id]);

  return { room, loading, joinRoom, deactivateRoom, handleRoomUpdate };
}
