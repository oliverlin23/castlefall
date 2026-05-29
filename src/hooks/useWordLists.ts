import { useEffect, useState, useCallback } from 'react';
import { validateWordList } from '../lib/validateWordList.js';

export interface WordListMeta {
  id: string;
  name: string;
  file: string;
}

const BASE_PATH = import.meta.env.BASE_URL + 'wordlists/';

export function useWordLists() {
  const [lists, setLists] = useState<WordListMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(BASE_PATH + 'index.json')
      .then((r) => r.json())
      .then((data: WordListMeta[]) => {
        setLists(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load word list index:', err);
        setLoading(false);
      });
  }, []);

  const loadWordList = useCallback(
    async (listId: string, wordCount?: number): Promise<string[]> => {
      const meta = lists.find((l) => l.id === listId);
      if (!meta) throw new Error(`Unknown word list: ${listId}`);

      const resp = await fetch(BASE_PATH + meta.file);
      const text = await resp.text();
      const result = validateWordList(text, { wordCount });
      if (!result.ok) {
        throw new Error(`Word list "${meta.name}" can't be used:\n• ${result.errors.join('\n• ')}`);
      }
      return result.words;
    },
    [lists],
  );

  return { lists, loading, loadWordList };
}
