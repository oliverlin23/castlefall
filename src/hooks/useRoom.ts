import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Room } from '../types';

export function useRoom(roomName: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  const joinRoom = useCallback(async (name: string) => {
    setLoading(true);

    // Look for an active room with this name
    const { data: active } = await supabase
      .from('rooms')
      .select('*')
      .eq('name', name)
      .eq('active', true)
      .single();

    if (active) {
      setRoom(active);
      setLoading(false);
      return active;
    }

    // Check for an inactive room to reactivate
    const { data: inactive } = await supabase
      .from('rooms')
      .select('*')
      .eq('name', name)
      .eq('active', false)
      .single();

    if (inactive) {
      const { data: reactivated } = await supabase
        .from('rooms')
        .update({ active: true })
        .eq('id', inactive.id)
        .select()
        .single();
      if (reactivated) {
        setRoom(reactivated);
        setLoading(false);
        return reactivated;
      }
    }

    // Create new room
    const { data: created, error } = await supabase
      .from('rooms')
      .insert({ name })
      .select()
      .single();

    if (error) {
      // Race condition: another client created or reactivated it
      const { data: retry } = await supabase
        .from('rooms')
        .select('*')
        .eq('name', name)
        .eq('active', true)
        .single();
      setRoom(retry);
      setLoading(false);
      return retry;
    }

    setRoom(created);
    setLoading(false);
    return created;
  }, []);

  useEffect(() => {
    if (!roomName) return;
    joinRoom(roomName);
  }, [roomName, joinRoom]);

  // Subscribe to room updates
  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setRoom(payload.new as Room);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  /** Mark room inactive (called when no players remain). */
  const deactivateRoom = useCallback(async () => {
    if (!room?.id) return;
    await supabase
      .from('rooms')
      .update({ active: false })
      .eq('id', room.id);
  }, [room?.id]);

  return { room, loading, joinRoom, deactivateRoom };
}
