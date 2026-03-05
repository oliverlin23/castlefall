import { useState, type FormEvent } from 'react';

interface NameEntryProps {
  defaultName: string;
  onSubmit: (name: string) => void;
}

export function NameEntry({ defaultName, onSubmit }: NameEntryProps) {
  const [name, setName] = useState(defaultName);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-full max-w-sm rounded-xl bg-surface-alt border border-border p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Join game</h2>
          <p className="text-sm text-text-secondary">Enter a display name to get started.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name..."
            autoFocus
            maxLength={24}
            className="w-full rounded-lg bg-surface border border-border px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
