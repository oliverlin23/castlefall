import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatMessage } from '../types';

interface ChatProps {
  roomId: string;
  playerName: string;
}

export function Chat({ roomId, playerName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data);
      });

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');

    await supabase.from('chat_messages').insert({
      room_id: roomId,
      player_name: playerName,
      message: text,
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 rounded-full bg-accent w-12 h-12 flex items-center justify-center text-white shadow-lg hover:bg-accent-hover transition-colors z-50"
        title="Open chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 rounded-xl bg-surface border border-border shadow-2xl flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-bold">Chat</span>
        <button
          onClick={() => setOpen(false)}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id}>
            <span className="text-xs font-bold text-accent">{msg.player_name}: </span>
            <span className="text-xs text-text-primary">{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 px-3 py-2.5 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg bg-surface-alt border border-border px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
