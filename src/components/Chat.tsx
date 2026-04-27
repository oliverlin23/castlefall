import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { ChatGlyph } from './sprites';
import type { ChatMessage } from '../types';

interface ChatProps {
  roomId: string;
  playerName: string;
}

export function Chat({ roomId, playerName }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
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
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            const optimisticIdx = prev.findIndex(
              (m) => m.id.startsWith('optimistic-') && m.player_name === msg.player_name && m.message === msg.message,
            );
            if (optimisticIdx !== -1) {
              const next = [...prev];
              next[optimisticIdx] = msg;
              return next;
            }
            return [...prev, msg];
          });
          if (!openRef.current) {
            setUnread((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    if (!open) return;

    setUnread(0);
    supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        if (data) setMessages(data);
      });
  }, [roomId, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');

    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      room_id: roomId,
      player_name: playerName,
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    supabase.from('chat_messages').insert({
      room_id: roomId,
      player_name: playerName,
      message: text,
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 border border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)] w-12 h-12 flex items-center justify-center text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-dim)] z-50"
        style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
        title="Open chat"
      >
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 border border-[color:var(--color-ink)] bg-[color:var(--color-seal-red)] text-[color:var(--color-paper-bright)] text-[10px] font-bold flex items-center justify-center font-mono tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        <ChatGlyph className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-full h-full sm:bottom-4 sm:right-4 sm:w-[340px] sm:h-[440px] border border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)] flex flex-col z-50 animate-slide-up"
      style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
        <span className="section-label flex items-center gap-1.5">
          <ChatGlyph className="h-3.5 w-3.5" />
          // Chat
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-[color:var(--color-ink-mid)] hover:text-[color:var(--color-ink)] p-1 leading-none text-[16px]"
          title="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        {messages.length === 0 ? (
          <p className="font-mono text-[11px] text-center text-[color:var(--color-ink-soft)] uppercase tracking-[0.14em] py-4">
            // No messages yet
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="group">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] font-semibold text-[color:var(--color-seal-red)] uppercase tracking-[0.08em]">
                  {msg.player_name}
                </span>
                <span className="font-mono text-[9px] text-[color:var(--color-ink-soft)] tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[13px] text-[color:var(--color-ink)] leading-snug">{msg.message}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 px-3 py-2 border-t border-[color:var(--color-ink)] bg-[color:var(--color-paper)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pen a note…"
          autoFocus
          className="flex-1 min-w-0 !py-1 !px-2 !text-[12px]"
        />
        <button type="submit" disabled={!input.trim()} className="btn-ink !px-3 !py-1 !text-[11px]">
          Send
        </button>
      </form>
    </div>
  );
}
