import { useState } from 'react';
import type { Game, Player, GameSettings } from '../types';
import type { WordListMeta } from '../hooks/useWordLists';
import { PlayerList } from './PlayerList';
import { Scoreboard } from './Scoreboard';

interface GameResultsProps {
  game: Game;
  players: Player[];
  currentPlayerId?: string;
  wordLists: WordListMeta[];
  lastWordListId: string;
  lastSettings: GameSettings;
  pastGames: Game[];
  onNewRound: (wordListId: string, settings: GameSettings) => void;
}

function outcomeMessage(game: Game, players: Player[]): string | null {
  if (!game.declaration_type) return 'Draw — revealed by vote';

  const declarer = players.find((p) => p.id === game.declaration_player_id);
  const declarerName = game.declaration_player_name ?? 'Someone';

  if (game.declaration_type === 'team') {
    if (game.winner_team && declarer?.team === game.winner_team) {
      return `${declarerName} correctly named their teammates`;
    }
    return `${declarerName} got it wrong — other team wins`;
  }

  if (game.declaration_type === 'word') {
    if (game.winner_team && declarer?.team === game.winner_team) {
      return `${declarerName} correctly guessed the other team's word`;
    }
    return `${declarerName} guessed wrong — other team wins`;
  }

  return null;
}

export function GameResults({
  game,
  players,
  currentPlayerId,
  wordLists,
  lastWordListId,
  lastSettings,
  pastGames,
  onNewRound,
}: GameResultsProps) {
  const [selectedList, setSelectedList] = useState(lastWordListId);

  const team1Players = players.filter((p) => p.team === 1);
  const team2Players = players.filter((p) => p.team === 2);
  const teamWords = game.team_words as Record<number, string>;
  const outcome = outcomeMessage(game, players);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-sm font-semibold text-center text-text-secondary uppercase tracking-wider">
        Round Over — Teams Revealed
      </h2>

      {game.winner_team ? (
        <div className={`text-center text-lg font-bold ${game.winner_team === 1 ? 'text-team1' : 'text-team2'}`}>
          Team {game.winner_team} wins!
        </div>
      ) : (
        <div className="text-center text-lg font-bold text-text-secondary">
          Draw
        </div>
      )}

      {outcome && (
        <p className="text-xs text-text-secondary text-center">{outcome}</p>
      )}

      <Scoreboard pastGames={pastGames} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface-alt border border-border border-l-2 border-l-team1 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-team1 uppercase tracking-wider">Team 1</h3>
          <p className="text-lg font-bold text-team1 text-center py-1">{teamWords[1]}</p>
          <PlayerList players={team1Players} currentPlayerId={currentPlayerId} showTeams />
        </div>

        <div className="rounded-xl bg-surface-alt border border-border border-l-2 border-l-team2 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-team2 uppercase tracking-wider">Team 2</h3>
          <p className="text-lg font-bold text-team2 text-center py-1">{teamWords[2]}</p>
          <PlayerList players={team2Players} currentPlayerId={currentPlayerId} showTeams />
        </div>
      </div>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <label htmlFor="next-word-list" className="block text-sm font-semibold">
          Next round
        </label>
        <select
          id="next-word-list"
          value={selectedList}
          onChange={(e) => setSelectedList(e.target.value)}
          className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
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
          onClick={() => onNewRound(selectedList, lastSettings)}
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Start New Round
        </button>
      </div>
    </div>
  );
}
