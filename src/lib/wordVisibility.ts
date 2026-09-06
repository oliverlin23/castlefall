const HIDDEN_KEY = 'castlefall_word_hidden';

/**
 * Whether the player's own secret word should start out concealed.
 *
 * Persisted across rounds (and reloads) on purpose: someone who plays with
 * people looking over their shoulder wants the word hidden by default every
 * round, not just the round where they clicked "Hide".
 */
export function isWordHidden(): boolean {
  return localStorage.getItem(HIDDEN_KEY) === 'true';
}

export function setWordHidden(hidden: boolean) {
  localStorage.setItem(HIDDEN_KEY, String(hidden));
}
