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
          placeholder="Room name..."
          autoFocus
          className="w-24 sm:w-auto rounded-md bg-surface-alt border border-border px-2.5 py-1 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-hover"
        >
          Go
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-1.5 py-1 text-text-secondary hover:text-text-primary sm:hidden"
          title="Cancel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="hidden sm:inline-block rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt border border-border px-3 py-1 text-xs text-text-secondary hover:border-accent/50 hover:text-text-primary max-w-[120px] sm:max-w-none"
    >
      <span className="font-medium text-text-primary truncate">{currentRoom}</span>
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </button>
  );
}
