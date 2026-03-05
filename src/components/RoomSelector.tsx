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

  return (
    <div className="flex items-center gap-3">
      <span className="text-text-secondary text-sm">
        Room: <span className="text-text-primary font-semibold">{currentRoom}</span>
      </span>
      {open ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Room name..."
            autoFocus
            className="rounded-lg bg-surface-alt border border-border px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-surface-alt border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-surface-alt border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
        >
          Change Room
        </button>
      )}
    </div>
  );
}
