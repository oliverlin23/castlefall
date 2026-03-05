import type { Game } from '../types';
import { computeScoreboard } from '../lib/scoring';

interface ScoreboardProps {
  pastGames: Game[];
}

export function Scoreboard({ pastGames }: ScoreboardProps) {
  if (pastGames.length === 0) return null;

  const { team1Wins, team2Wins, draws } = computeScoreboard(pastGames);

  return (
    <div className="rounded-xl bg-surface-alt border border-border p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-text-secondary uppercase tracking-wider">Score</span>
        <span className="text-text-secondary">{pastGames.length} rounds</span>
      </div>
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="text-center">
          <div className="text-lg font-bold text-team1">{team1Wins}</div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">Team 1</div>
        </div>
        {draws > 0 && (
          <div className="text-center">
            <div className="text-lg font-bold text-text-secondary">{draws}</div>
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Draw</div>
          </div>
        )}
        <div className="text-center">
          <div className="text-lg font-bold text-team2">{team2Wins}</div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">Team 2</div>
        </div>
      </div>
    </div>
  );
}
