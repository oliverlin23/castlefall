import { CrownSprite } from './sprites';

interface WordListProps {
  words: string[];
  assignedWord: string | null;
  /** When true, the assigned word is drawn like every other word (no crown, no
   *  illumination) so a passer-by can't spot it. */
  concealed?: boolean;
}

export function WordList({ words, assignedWord, concealed = false }: WordListProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {words.map((word) => {
        const isAssigned = !concealed && word === assignedWord;
        return (
          <div
            key={word}
            className={`relative border px-3 py-3 text-center select-none min-w-0 overflow-hidden transition-transform duration-150 hover:-translate-y-[1px] ${
              isAssigned
                ? 'illuminated-tile border-[color:var(--color-banner-gold)] bg-[color:var(--color-banner-gold-soft)]/35 text-[color:var(--color-ink)]'
                : 'border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)] text-[color:var(--color-ink)]'
            }`}
          >
            {isAssigned && (
              <CrownSprite
                tone="gold"
                className="absolute -top-[7px] left-1/2 -translate-x-1/2 h-3 w-auto"
              />
            )}
            <span
              className={`block truncate text-[14px] ${
                isAssigned ? 'illuminated text-[17px] leading-tight tracking-tight' : 'font-medium'
              }`}
              title={word}
            >
              {word}
            </span>
            {isAssigned && (
              <span
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 0 1px var(--color-banner-gold)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
