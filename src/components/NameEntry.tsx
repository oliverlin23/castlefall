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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h2 className="text-2xl font-bold">Enter Your Name</h2>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          autoFocus
          maxLength={24}
          className="rounded-lg bg-surface-alt border border-border px-4 py-2 text-lg text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent w-64"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-accent px-5 py-2 text-lg font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Join
        </button>
      </form>
    </div>
  );
}
