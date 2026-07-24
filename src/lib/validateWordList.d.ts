// Type declarations for validateWordList.js (kept as plain JS so the CLI
// script scripts/validate-wordlists.mjs can import it without a build step).

export interface ValidationResult {
  /** True when the list has no errors (warnings are still allowed). */
  ok: boolean;
  /** Problems that make the list unusable. */
  errors: string[];
  /** Problems that are silently fixed at runtime. */
  warnings: string[];
  /** The cleaned, deduped, in-order list. */
  words: string[];
}

export function validateWordList(
  rawText: string,
  opts?: { wordCount?: number; strict?: boolean },
): ValidationResult;
