import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Player } from '../types';

const BOT_PREFIX = '[bot] ';

const BOT_NAMES = [
  'Mordred', 'Lancelot', 'Galahad', 'Percival', 'Gawain', 'Tristan',
  'Bedivere', 'Kay', 'Bors', 'Geraint', 'Lamorak', 'Pelleas',
  'Ywain', 'Dagonet', 'Palamedes', 'Ector', 'Lionel', 'Aglovale',
  'Bran', 'Cei', 'Lucan', 'Sagramore', 'Bellangere', 'Brunor',
];

interface DevPanelProps {
  roomId: string | undefined;
  players: Player[];
}

export function DevPanel({ roomId, players }: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!import.meta.env.DEV) return null;

  const bots = players.filter((p) => p.display_name.startsWith(BOT_PREFIX));

  async function addBots(n: number) {
    if (!roomId || n <= 0) return;
    setBusy(true);
    setError(null);

    const taken = new Set(players.map((p) => p.display_name));
    const pool = BOT_NAMES.filter((name) => !taken.has(BOT_PREFIX + name));
    const picked: string[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    while (picked.length < n) {
      picked.push(`bot-${Date.now()}-${picked.length}`);
    }

    const rows = picked.map((name) => ({
      room_id: roomId,
      display_name: BOT_PREFIX + name,
    }));
    const { error } = await supabase.from('players').insert(rows);
    if (error) setError(error.message);
    setBusy(false);
  }

  async function removeAllBots() {
    if (!roomId || bots.length === 0) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('players')
      .delete()
      .in('id', bots.map((b) => b.id));
    if (error) setError(error.message);
    setBusy(false);
  }

  async function nukeRoom() {
    if (!roomId) return;
    if (!confirm('Delete every player and clear the current game in this room?')) return;
    setBusy(true);
    setError(null);
    const { error: pErr } = await supabase.from('players').delete().eq('room_id', roomId);
    if (pErr) {
      setError(pErr.message);
      setBusy(false);
      return;
    }
    const { error: rErr } = await supabase
      .from('rooms')
      .update({ current_game_id: null })
      .eq('id', roomId);
    if (rErr) setError(rErr.message);
    setBusy(false);
  }

  async function fillTo(target: number) {
    const need = target - players.length;
    if (need > 0) await addBots(need);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-50 font-mono text-[10px] uppercase tracking-[0.18em] bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)] px-2.5 py-1.5 border border-[color:var(--color-ink)] hover:bg-[color:var(--color-seal-red)]"
        title="Dev tools"
      >
        DEV · {bots.length}/{players.length}
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[260px] bg-[color:var(--color-paper-bright)] border border-[color:var(--color-ink)] shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-[color:var(--color-paper-bright)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">// Dev tools</span>
        <button
          onClick={() => setOpen(false)}
          className="font-mono text-[12px] hover:text-[color:var(--color-seal-red)]"
        >
          ×
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="font-mono text-[11px] text-[color:var(--color-ink-mid)]">
          players: <span className="text-[color:var(--color-ink)] font-semibold">{players.length}</span>{' '}
          (<span className="text-[color:var(--color-ink)] font-semibold">{bots.length}</span> bots)
        </div>
        <div className="grid grid-cols-3 gap-1">
          <DevBtn disabled={busy || !roomId} onClick={() => addBots(1)}>+1</DevBtn>
          <DevBtn disabled={busy || !roomId} onClick={() => addBots(3)}>+3</DevBtn>
          <DevBtn disabled={busy || !roomId} onClick={() => addBots(5)}>+5</DevBtn>
          <DevBtn disabled={busy || !roomId} onClick={() => fillTo(4)}>fill 4</DevBtn>
          <DevBtn disabled={busy || !roomId} onClick={() => fillTo(6)}>fill 6</DevBtn>
          <DevBtn disabled={busy || !roomId} onClick={() => fillTo(10)}>fill 10</DevBtn>
        </div>
        <button
          onClick={removeAllBots}
          disabled={busy || bots.length === 0}
          className="w-full font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1.5 border border-[color:var(--color-ink)] hover:bg-[color:var(--color-seal-red)] hover:text-[color:var(--color-paper-bright)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear all bots
        </button>
        <button
          onClick={nukeRoom}
          disabled={busy || !roomId}
          className="w-full font-mono text-[10px] uppercase tracking-[0.18em] px-2 py-1.5 border border-[color:var(--color-seal-red)] text-[color:var(--color-seal-red)] hover:bg-[color:var(--color-seal-red)] hover:text-[color:var(--color-paper-bright)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Nuke room
        </button>
        {error && (
          <p className="font-mono text-[10px] text-[color:var(--color-seal-red)] break-words">{error}</p>
        )}
        <p className="font-mono text-[9px] text-[color:var(--color-ink-soft)] leading-relaxed">
          Bots are inserted directly into the players table. They won't heartbeat, but pruning is disabled. Clear them when done.
        </p>
      </div>
    </div>
  );
}

function DevBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1.5 border border-[color:var(--color-ink)] hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper-bright)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
