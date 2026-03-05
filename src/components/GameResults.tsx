import { useState } from 'react';
import type { Game, Player } from '../types';
import type { WordListMeta } from '../hooks/useWordLists';
import { PlayerList } from './PlayerList';

interface GameResultsProps {
  game: Game;
  players: Player[];
  currentPlayerId?: string;
  wordLists: WordListMeta[];
  lastWordListId: string;
  onNewRound: (wordListId: string) => void;
}

export function GameResults({
  game,
  players,
  currentPlayerId,
  wordLists,
  lastWordListId,
  onNewRound,
}: GameResultsProps) {
  const [selectedList, setSelectedList] = useState(lastWordListId);

  const team1Players = players.filter((p) => p.team === 1);
  const team2Players = players.filter((p) => p.team === 2);
  const teamWords = game.team_words as Record<number, string>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-center">Round Over — Teams Revealed</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-alt border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-team1" />
            <h3 className="font-bold text-team1">Team 1</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Word: <span className="font-bold text-team1">{teamWords[1]}</span>
          </p>
          <PlayerList players={team1Players} currentPlayerId={currentPlayerId} showTeams />
        </div>

        <div className="rounded-xl bg-surface-alt border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-team2" />
            <h3 className="font-bold text-team2">Team 2</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Word: <span className="font-bold text-team2">{teamWords[2]}</span>
          </p>
          <PlayerList players={team2Players} currentPlayerId={currentPlayerId} showTeams />
        </div>
      </div>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <label htmlFor="next-word-list" className="block text-sm font-bold">
          Word list for next round
        </label>
        <select
          id="next-word-list"
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
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => onNewRound(selectedList)}
          className="rounded-lg bg-accent px-6 py-2.5 font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Start New Round
        </button>
      </div>
    </div>
  );
}
