import { useState, useMemo, type FormEvent } from 'react';
import { Timer } from './Timer';
import { suggestedN } from '../lib/gameLogic';
import type { Game, Player } from '../types';

interface VictoryDeclarationProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  onDeclareTeam: (selectedPlayerIds: string[]) => void;
  onDeclareWord: (word: string) => void;
  onTimerExpired: () => void;
}

export function VictoryDeclaration({
  game,
  players,
  currentPlayer,
  onDeclareTeam,
  onDeclareWord,
  onTimerExpired,
}: VictoryDeclarationProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(
    new Set([currentPlayer.id]),
  );
  const [wordGuess, setWordGuess] = useState('');
  const [showWordGuess, setShowWordGuess] = useState(false);

  const n = useMemo(() => suggestedN(players.length), [players.length]);

  function togglePlayer(playerId: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (playerId === currentPlayer.id) return next;
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  function handleDeclareTeam(e: FormEvent) {
    e.preventDefault();
    if (selectedPlayers.size >= n) {
      onDeclareTeam(Array.from(selectedPlayers));
    }
  }

  function handleDeclareWord(e: FormEvent) {
    e.preventDefault();
    if (wordGuess.trim()) {
      onDeclareWord(wordGuess.trim());
    }
  }

  // Active team declaration: show timer + counter-guess to everyone
  if (game.declaration_type === 'team' && game.declaration_at) {
    const declarerName = game.declaration_player_name ?? 'Someone';
    const iDeclared = game.declaration_player_id === currentPlayer.id;
    const selectedIds: string[] = game.declaration_data?.selectedPlayers ?? [];
    const declarationTimestamp = new Date(game.declaration_at).getTime();

    return (
      <div className="rounded-xl bg-surface-alt border border-border p-6 space-y-4">
        <h3 className="text-lg font-bold text-center">
          {iDeclared ? 'Your' : `${declarerName}'s`} Team Declaration
        </h3>
        <p className="text-sm text-text-secondary text-center">
          {declarerName} claims these players are on their team:
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {players
            .filter((p) => selectedIds.includes(p.id))
            .map((p) => (
              <span
                key={p.id}
                className="rounded-lg bg-accent/20 text-accent px-3 py-1 text-sm font-medium"
              >
                {p.display_name}
              </span>
            ))}
        </div>
        <Timer
          durationMs={60_000}
          startedAt={declarationTimestamp}
          onExpired={onTimerExpired}
          label="Time remaining to counter with a word guess"
        />

        <div className="border-t border-border pt-4">
          <p className="text-sm text-text-secondary mb-2 text-center">
            Counter with a word guess (overrides the team declaration):
          </p>
          <form onSubmit={handleDeclareWord} className="flex gap-2 justify-center">
            <select
              value={wordGuess}
              onChange={(e) => setWordGuess(e.target.value)}
              className="rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-team2"
            >
              <option value="">Select a word...</option>
              {game.game_words
                .filter((w) => w !== currentPlayer.assigned_word)
                .map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={!wordGuess}
              className="rounded-lg bg-team2 px-4 py-2 text-sm font-medium text-white hover:bg-team2/80 transition-colors disabled:opacity-40"
            >
              Guess Word
            </button>
          </form>
        </div>
      </div>
    );
  }

  // No active declaration: show the declaration form (only to declare)
  return (
    <div className="rounded-xl bg-surface-alt border border-border p-6 space-y-6">
      <h3 className="text-lg font-bold text-center">Declare Victory</h3>

      {!showWordGuess && (
        <form onSubmit={handleDeclareTeam} className="space-y-3">
          <p className="text-sm text-text-secondary">
            Method 1: Select <strong>{n}</strong> players (including yourself) that you
            believe are on your team.
          </p>
          <div className="space-y-1">
            {players.map((p) => {
              const isSelected = selectedPlayers.has(p.id);
              const isSelf = p.id === currentPlayer.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  disabled={isSelf}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'bg-surface border border-border text-text-primary hover:bg-surface-hover'
                  } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {p.display_name}
                  {isSelf && <span className="text-xs text-text-secondary ml-1">(you)</span>}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={selectedPlayers.size < n}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Declare Team ({selectedPlayers.size}/{n} selected)
          </button>
        </form>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <button
          onClick={() => setShowWordGuess(!showWordGuess)}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {showWordGuess ? 'Switch to team guess' : 'Or guess the other word'}
        </button>
        <div className="flex-1 h-px bg-border" />
      </div>

      {showWordGuess && (
        <form onSubmit={handleDeclareWord} className="space-y-3">
          <p className="text-sm text-text-secondary">
            Method 2: Guess the other team's word. The round ends immediately.
          </p>
          <select
            value={wordGuess}
            onChange={(e) => setWordGuess(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-team2"
          >
            <option value="">Select a word...</option>
            {game.game_words
              .filter((w) => w !== currentPlayer.assigned_word)
              .map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
          </select>
          <button
            type="submit"
            disabled={!wordGuess}
            className="w-full rounded-lg bg-team2 px-4 py-2.5 text-sm font-medium text-white hover:bg-team2/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guess Word
          </button>
        </form>
      )}
    </div>
  );
}
