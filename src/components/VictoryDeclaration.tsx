import { useState, useMemo, type FormEvent } from 'react';
import { Timer } from './Timer';
import { suggestedN } from '../lib/gameLogic';
import { playSound } from '../lib/sounds';
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
  const timerDurationMs =
    (game.settings && 'timerDurationMs' in game.settings ? game.settings.timerDurationMs : undefined) ?? 60_000;

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
      playSound('declare');
      onDeclareTeam(Array.from(selectedPlayers));
    }
  }

  function handleDeclareWord(e: FormEvent) {
    e.preventDefault();
    if (wordGuess.trim()) {
      playSound('declare');
      onDeclareWord(wordGuess.trim());
    }
  }

  if (game.declaration_type === 'team' && game.declaration_at) {
    const declarerName = game.declaration_player_name ?? 'Someone';
    const iDeclared = game.declaration_player_id === currentPlayer.id;
    const selectedIds: string[] = game.declaration_data?.selectedPlayers ?? [];
    const declarationTimestamp = new Date(game.declaration_at).getTime();

    return (
      <div className="rounded-xl bg-surface-alt border border-border p-6 space-y-5 animate-slide-up">
        <h3 className="text-sm font-semibold text-center">
          {iDeclared ? 'Your' : `${declarerName}'s`} Team Declaration
        </h3>
        <p className="text-xs text-text-secondary text-center">
          {declarerName} claims these players are on their team:
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {players
            .filter((p) => selectedIds.includes(p.id))
            .map((p) => (
              <span
                key={p.id}
                className="rounded-full bg-accent/15 text-accent px-3 py-1 text-xs font-medium"
              >
                {p.display_name}
              </span>
            ))}
        </div>
        <Timer
          durationMs={timerDurationMs}
          startedAt={declarationTimestamp}
          onExpired={onTimerExpired}
          label="Time to counter with a word guess"
        />

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs text-text-secondary text-center">
            Counter with a word guess to override the declaration:
          </p>
          <form onSubmit={handleDeclareWord} className="flex flex-col sm:flex-row gap-2 justify-center">
            <select
              value={wordGuess}
              onChange={(e) => setWordGuess(e.target.value)}
              className="rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-team2"
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
              className="rounded-lg bg-team2 px-4 py-2 text-sm font-medium text-white hover:bg-team2/80 disabled:opacity-40"
            >
              Guess Word
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-alt border border-border p-6 space-y-5 animate-slide-up">
      <h3 className="text-sm font-semibold text-center">Declare Victory</h3>

      <div className="flex rounded-lg bg-surface border border-border p-0.5">
        <button
          type="button"
          onClick={() => setShowWordGuess(false)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            !showWordGuess ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Name teammates
        </button>
        <button
          type="button"
          onClick={() => setShowWordGuess(true)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            showWordGuess ? 'bg-surface-hover text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Guess word
        </button>
      </div>

      {!showWordGuess ? (
        <form onSubmit={handleDeclareTeam} className="space-y-3 animate-fade-in">
          <p className="text-xs text-text-secondary">
            Select <strong>{n}</strong> players (including yourself) that you believe are on your team.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((p) => {
              const isSelected = selectedPlayers.has(p.id);
              const isSelf = p.id === currentPlayer.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  disabled={isSelf}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'bg-surface border border-border text-text-primary hover:border-border hover:bg-surface-hover'
                  } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {p.display_name}
                  {isSelf && <span className="ml-1 text-text-secondary">you</span>}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={selectedPlayers.size < n}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Declare Team ({selectedPlayers.size}/{n})
          </button>
        </form>
      ) : (
        <form onSubmit={handleDeclareWord} className="space-y-3 animate-fade-in">
          <p className="text-xs text-text-secondary">
            Guess the other team's word. The round ends immediately.
          </p>
          <select
            value={wordGuess}
            onChange={(e) => setWordGuess(e.target.value)}
            className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-team2"
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
            className="w-full rounded-lg bg-team2 px-4 py-2.5 text-sm font-medium text-white hover:bg-team2/80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guess Word
          </button>
        </form>
      )}
    </div>
  );
}
