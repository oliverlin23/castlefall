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
            className={`rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors select-none ${
              isAssigned
                ? 'bg-highlight/20 text-highlight border-2 border-highlight ring-2 ring-highlight/30'
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
