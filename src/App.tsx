import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { RoomPage } from './RoomPage';
import { CastleSprite, InkSplatter } from './components/sprites';

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <CastleSprite className="h-20 w-auto text-[color:var(--color-ink)]" title="Castlefall" />
          <div className="text-center space-y-1">
            <h1 className="display-heading text-[40px] leading-none tracking-tight text-[color:var(--color-ink)]">
              Castlefall
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[color:var(--color-ink-soft)]">
              // a parlour game of words &amp; treason
            </p>
          </div>
        </div>

        <div className="parchment-card p-6 space-y-5 relative z-[1]">
          <div className="space-y-1">
            <label
              htmlFor="room-name"
              className="section-label block"
            >
              // Enter a chamber
            </label>
            <p className="text-[12px] text-[color:var(--color-ink-mid)]">
              Pick any name. Share it with your accomplices.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              id="room-name"
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="e.g. dragonfly, vault, oxbow…"
              autoFocus
              className="w-full text-center text-[15px]"
            />
            <button
              type="submit"
              disabled={!roomInput.trim()}
              className="btn-seal w-full"
            >
              Enter Room
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[color:var(--color-ink-soft)]">
          <span>v.0.1</span>
          <span aria-hidden>·</span>
          <span>printed in cream &amp; ink</span>
          <InkSplatter className="h-3 w-5 opacity-60" />
        </div>
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
