interface WordListProps {
  words: string[];
  assignedWord: string | null;
}

export function WordList({ words, assignedWord }: WordListProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {words.map((word) => {
        const isAssigned = word === assignedWord;
        return (
          <div
            key={word}
            className={`rounded-lg px-3 py-2.5 text-center text-sm font-medium select-none transition-transform duration-150 hover:scale-[1.03] min-w-0 overflow-hidden text-ellipsis ${
              isAssigned
                ? 'bg-highlight/15 text-highlight border border-highlight/40 animate-pulse-glow'
                : 'bg-surface-alt border border-border text-text-primary'
            }`}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
}
