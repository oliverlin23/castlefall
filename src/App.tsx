import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { RoomPage } from './RoomPage';

function getHashRoom(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  return hash || null;
}

function RoomEntry({ onJoin }: { onJoin: (name: string) => void }) {
  const [roomInput, setRoomInput] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const name = roomInput.trim().toLowerCase();
    if (name) onJoin(name);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold uppercase tracking-[0.25em] text-text-primary">Castlefall</h1>
          <p className="text-sm text-text-secondary">Enter a room name to join or create a game.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Room name..."
            autoFocus
            className="w-full rounded-xl bg-surface-alt border border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent text-center"
          />
          <button
            type="submit"
            disabled={!roomInput.trim()}
            className="w-full rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [roomName, setRoomName] = useState<string | null>(getHashRoom);

  useEffect(() => {
    function handleHashChange() {
      setRoomName(getHashRoom());
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleChangeRoom = useCallback((name: string) => {
    window.location.hash = `#${name}`;
    setRoomName(name);
  }, []);

  if (!roomName) {
    return <RoomEntry onJoin={handleChangeRoom} />;
  }

  return <RoomPage key={roomName} roomName={roomName} onChangeRoom={handleChangeRoom} />;
}
