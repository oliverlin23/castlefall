import type { Game } from '../types';
import { computePlayerScores } from '../lib/scoring';

interface ScoreboardProps {
  pastGames: Game[];
}

export function Scoreboard({ pastGames }: ScoreboardProps) {
  if (pastGames.length === 0) return null;

  const scores = computePlayerScores(pastGames);
  if (scores.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-alt border border-border p-4">
      <div className="flex items-center justify-between text-xs mb-3">
        <span className="font-semibold text-text-secondary uppercase tracking-wider">Scoreboard</span>
        <span className="text-text-secondary">{pastGames.length} rounds</span>
      </div>
      <div className="space-y-1">
        {scores.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs">
            <span className="flex-1 font-medium text-text-primary truncate">{s.name}</span>
            <span className="text-accent font-bold tabular-nums">{s.wins}W</span>
            <span className="text-text-secondary tabular-nums">{s.losses}L</span>
            {s.draws > 0 && (
              <span className="text-text-secondary tabular-nums">{s.draws}D</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
