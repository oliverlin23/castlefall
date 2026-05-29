#!/usr/bin/env node
// Validate every word list referenced from public/wordlists/index.json.
// Run via `npm run validate:wordlists`. Exits non-zero if any list has
// errors, so it can be wired into CI / pre-commit.
//
// Strict mode (`--strict`) escalates warnings to errors — use that for
// pre-deploy gates if you don't want sloppy contributions through.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWordList } from '../src/lib/validateWordList.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dir = resolve(root, 'public/wordlists');
const indexPath = resolve(dir, 'index.json');

const strict = process.argv.includes('--strict');
// Highest word-count setting the lobby exposes; any list must support it.
const wordCount = 24;

if (!existsSync(indexPath)) {
  console.error(`index.json not found at ${indexPath}`);
  process.exit(2);
}

/** @type {{ id: string, name: string, file: string }[]} */
let index;
try {
  index = JSON.parse(readFileSync(indexPath, 'utf8'));
} catch (e) {
  console.error(`index.json is not valid JSON: ${e.message}`);
  process.exit(2);
}

if (!Array.isArray(index)) {
  console.error('index.json must be an array of { id, name, file } objects.');
  process.exit(2);
}

let totalErrors = 0;
let totalWarnings = 0;

// Index-level checks (id and file collisions).
const seenIds = new Map();
const seenFiles = new Map();
for (let i = 0; i < index.length; i++) {
  const meta = index[i];
  if (!meta || typeof meta.id !== 'string' || typeof meta.name !== 'string' || typeof meta.file !== 'string') {
    console.error(`index.json entry #${i} is missing one of: id (string), name (string), file (string).`);
    totalErrors++;
    continue;
  }
  if (seenIds.has(meta.id)) {
    console.error(`Duplicate id "${meta.id}" in index.json (entries #${seenIds.get(meta.id)} and #${i}).`);
    totalErrors++;
  } else {
    seenIds.set(meta.id, i);
  }
  if (seenFiles.has(meta.file)) {
    console.error(`Duplicate file "${meta.file}" in index.json (entries #${seenFiles.get(meta.file)} and #${i}).`);
    totalErrors++;
  } else {
    seenFiles.set(meta.file, i);
  }
}

// Per-list checks.
for (const meta of index) {
  if (!meta || typeof meta.file !== 'string') continue;
  const filePath = resolve(dir, meta.file);
  if (!existsSync(filePath)) {
    console.error(`[FAIL] ${meta.name ?? meta.id} — referenced file does not exist: ${meta.file}`);
    totalErrors++;
    continue;
  }

  const text = readFileSync(filePath, 'utf8');
  const result = validateWordList(text, { wordCount, strict });
  totalErrors += result.errors.length;
  totalWarnings += result.warnings.length;

  const tag = result.ok ? '[ok]  ' : '[FAIL]';
  console.log(`${tag} ${meta.name} (${meta.file}) — ${result.words.length} unique words`);
  for (const err of result.errors) console.log(`        error: ${err}`);
  for (const warn of result.warnings) console.log(`        warn:  ${warn}`);
}

console.log(
  `\n${index.length} list${index.length === 1 ? '' : 's'}, ` +
    `${totalErrors} error${totalErrors === 1 ? '' : 's'}, ` +
    `${totalWarnings} warning${totalWarnings === 1 ? '' : 's'}.`,
);
process.exit(totalErrors > 0 ? 1 : 0);
