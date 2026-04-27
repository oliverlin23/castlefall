import { useState, type FormEvent } from 'react';

interface RoomSelectorProps {
  currentRoom: string;
  onChangeRoom: (name: string) => void;
}

export function RoomSelector({ currentRoom, onChangeRoom }: RoomSelectorProps) {
  const [open, setOpen] = useState(false);
  const [roomInput, setRoomInput] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = roomInput.trim().toLowerCase();
    if (name && name !== currentRoom) {
      onChangeRoom(name);
    }
    setOpen(false);
    setRoomInput('');
  }

  if (open) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 animate-fade-in">
        <input
          type="text"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          placeholder="room name…"
          autoFocus
          className="w-28 sm:w-40 !py-1 !px-2 !text-[12px]"
        />
        <button type="submit" className="btn-ink !px-3 !py-1 !text-[11px]">
          Go
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
          title="Cancel"
        >
          ×
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-2 border border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-[color:var(--color-ink-mid)] hover:bg-[color:var(--color-paper-dim)] max-w-[160px] sm:max-w-none"
      title="Switch to another chamber"
    >
      <span className="text-[color:var(--color-ink-soft)]">#</span>
      <span className="font-semibold text-[color:var(--color-ink)] truncate normal-case">{currentRoom}</span>
      <span className="text-[color:var(--color-ink-soft)]">▾</span>
    </button>
  );
}
