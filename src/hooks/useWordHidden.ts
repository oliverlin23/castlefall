import { useCallback, useState } from 'react';

const STORAGE_KEY = 'castlefall_word_hidden';

/**
 * Whether the player's own secret word is concealed on the board.
 *
 * Persisted so it carries across rounds and reloads: a player hiding their
 * word from onlookers wants it hidden at the start of every round, not just
 * the one in which they pressed the button.
 */
export function useWordHidden(): [hidden: boolean, toggle: () => void] {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return [hidden, toggle];
}
