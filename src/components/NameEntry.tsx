import { useState, type FormEvent } from 'react';
import { QuillSprite } from './sprites';

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
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in py-8">
      <div className="w-full max-w-sm parchment-card p-7 space-y-5 relative z-[1]">
        <div className="flex items-center gap-3">
          <QuillSprite className="h-6 w-6 text-[color:var(--color-ink)]" />
          <div className="space-y-0.5">
            <h2 className="display-heading text-[20px] leading-tight text-[color:var(--color-ink)]">
              Sign your name
            </h2>
            <p className="text-[12px] text-[color:var(--color-ink-mid)]">
              The herald needs to know who has joined the chamber.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your given name…"
            autoFocus
            maxLength={24}
            className="w-full text-[15px]"
          />
          <button type="submit" disabled={!name.trim()} className="btn-seal w-full">
            Sign &amp; Enter
          </button>
        </form>
      </div>
    </div>
  );
}
