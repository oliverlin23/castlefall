// Pure validator for word-list files (public/wordlists/*.txt).
// Used at game-start (src/hooks/useWordLists.ts) and from the CLI
// (scripts/validate-wordlists.mjs). No dependencies, no React.

/**
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors    Problems that make the list unusable.
 * @property {string[]} warnings  Problems that are silently fixed at runtime.
 * @property {string[]} words     The cleaned, deduped, in-order list.
 */

/**
 * Validate a raw word-list file.
 *
 * @param {string} rawText
 * @param {{ wordCount?: number, strict?: boolean }} [opts]
 *   wordCount: how many distinct words the game needs at the strictest
 *     setting that should still work. Defaults to 24 (the highest setting
 *     the lobby offers). Pass the player's chosen wordCount for a
 *     per-game check.
 *   strict: if true, warnings are reported as errors. Used by CI.
 * @returns {ValidationResult}
 */
export function validateWordList(rawText, opts = {}) {
  const wordCount = opts.wordCount ?? 24;
  const strict = opts.strict ?? false;

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  const lines = rawText.replace(/^﻿/, '').split('\n');
  /** @type {{ text: string, line: number }[]} */
  const entries = [];
  let hasUntrimmed = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, '');
    const stripped = raw.trim();
    if (stripped === '') continue;
    if (raw !== stripped) hasUntrimmed = true;
    entries.push({ text: stripped, line: i + 1 });
  }

  if (entries.length === 0) {
    errors.push('List is empty: no non-blank lines were found.');
    return { ok: false, errors, warnings, words: [] };
  }

  // Duplicate detection (case-insensitive to catch "Cat" vs "cat").
  const firstSeenAt = new Map();
  /** @type {{ word: string, line: number, firstLine: number }[]} */
  const duplicates = [];
  /** @type {string[]} */
  const uniqueWords = [];

  for (const e of entries) {
    const key = e.text.toLowerCase();
    if (firstSeenAt.has(key)) {
      duplicates.push({ word: e.text, line: e.line, firstLine: firstSeenAt.get(key) });
    } else {
      firstSeenAt.set(key, e.line);
      uniqueWords.push(e.text);
    }
  }

  if (uniqueWords.length < 2) {
    errors.push(
      `Only ${uniqueWords.length} unique word${uniqueWords.length === 1 ? '' : 's'} in the list; ` +
        'need at least 2 so the two teams can be assigned different words.',
    );
  } else if (uniqueWords.length < wordCount) {
    errors.push(
      `Only ${uniqueWords.length} unique words; need at least ${wordCount} to deal a full game at the ` +
        `selected word-count setting. Either add more words or pick a lower word-count setting.`,
    );
  }

  if (duplicates.length > 0) {
    const sample = duplicates
      .slice(0, 3)
      .map((d) => `"${d.word}" on line ${d.line} (first seen on line ${d.firstLine})`)
      .join('; ');
    const more = duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : '';
    warnings.push(
      `${duplicates.length} duplicate ${duplicates.length === 1 ? 'entry' : 'entries'}; ` +
        `runtime will dedupe but the list is sloppier than it looks: ${sample}${more}.`,
    );
  }

  if (hasUntrimmed) {
    warnings.push('Some entries had leading or trailing whitespace, which is stripped at runtime.');
  }

  const tooLong = entries.filter((e) => e.text.length > 80);
  if (tooLong.length > 0) {
    const preview = tooLong[0].text.slice(0, 40);
    warnings.push(
      `${tooLong.length} ${tooLong.length === 1 ? 'entry is' : 'entries are'} longer than 80 ` +
        `characters and will display poorly (line ${tooLong[0].line}: "${preview}…"). ` +
        'Likely a paste accident — check that each line is a single word or short phrase.',
    );
  }

  if (strict && warnings.length > 0) {
    errors.push(...warnings.splice(0, warnings.length));
  }

  return { ok: errors.length === 0, errors, warnings, words: uniqueWords };
}
