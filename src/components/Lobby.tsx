import { useState } from 'react';
import type { Player } from '../types';
import type { WordListMeta } from '../hooks/useWordLists';
import { PlayerList } from './PlayerList';

interface LobbyProps {
  players: Player[];
  currentPlayerId?: string;
  wordLists: WordListMeta[];
  wordListsLoading: boolean;
  onStartGame: (wordListId: string) => void;
}

export function Lobby({
  players,
  currentPlayerId,
  wordLists,
  wordListsLoading,
  onStartGame,
}: LobbyProps) {
  const [selectedList, setSelectedList] = useState(wordLists[0]?.id ?? '');

  // Sync default selection when lists load
  if (!selectedList && wordLists.length > 0) {
    setSelectedList(wordLists[0].id);
  }

  const canStart = players.length >= 2 && !!selectedList && !wordListsLoading;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            Players ({players.length})
          </h2>
          {players.length < 2 && (
            <span className="text-xs text-text-secondary">
              Need at least 2 players to start
            </span>
          )}
        </div>

        {players.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">
            No one has joined yet. Share the link to invite players!
          </p>
        ) : (
          <PlayerList players={players} currentPlayerId={currentPlayerId} />
        )}
      </div>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <label htmlFor="word-list-select" className="block text-sm font-bold">
          Word List
        </label>
        {wordListsLoading ? (
          <p className="text-sm text-text-secondary animate-pulse">Loading word lists...</p>
        ) : (
          <select
            id="word-list-select"
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {wordLists.map((wl) => (
              <option key={wl.id} value={wl.id}>
                {wl.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={() => onStartGame(selectedList)}
        disabled={!canStart}
        className="w-full rounded-xl bg-accent px-6 py-3 text-lg font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {canStart ? 'Start Round' : `Waiting for players (${players.length}/2)...`}
      </button>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <h3 className="font-bold text-sm text-text-secondary uppercase tracking-wider">
          How to Play
        </h3>
        <ul className="text-sm text-text-secondary space-y-2 list-disc list-inside">
          <li>
            Everyone receives the same list of words, but shuffled differently.
          </li>
          <li>
            You'll be secretly assigned to one of two teams. Your teammates share
            the same highlighted word.
          </li>
          <li>
            Give clues about your word to find teammates — but don't make it too
            obvious, or the other team will figure it out!
          </li>
          <li>
            Win by either naming your teammates or guessing the other team's word.
          </li>
        </ul>
      </div>
    </div>
  );
}
