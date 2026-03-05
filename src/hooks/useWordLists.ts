import { useEffect, useState, useCallback } from 'react';

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
    async (listId: string): Promise<string[]> => {
      const meta = lists.find((l) => l.id === listId);
      if (!meta) throw new Error(`Unknown word list: ${listId}`);

      const resp = await fetch(BASE_PATH + meta.file);
      const text = await resp.text();
      return text
        .split('\n')
        .map((w) => w.trim())
        .filter((w) => w.length > 0);
    },
    [lists],
  );

  return { lists, loading, loadWordList };
}
