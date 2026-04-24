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
    <div className="ink-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="section-label">// Tally</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
          {pastGames.length} {pastGames.length === 1 ? 'round' : 'rounds'}
        </span>
      </div>
      <div className="space-y-0.5">
        {scores.map((s, idx) => (
          <div
            key={s.id}
            className="grid grid-cols-[1.25rem_1fr_auto_auto_auto] items-center gap-2 px-1 py-1 text-[12px] border-b border-dashed border-[color:var(--color-ink)]/15 last:border-b-0"
          >
            <span className="font-mono text-[10px] text-[color:var(--color-ink-soft)] tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <span className="font-medium text-[color:var(--color-ink)] truncate">{s.name}</span>
            <span className="font-mono font-semibold text-[color:var(--color-banner-gold)] tabular-nums text-[11px]">
              {s.wins}<span className="text-[color:var(--color-ink-soft)] ml-0.5">W</span>
            </span>
            <span className="font-mono text-[color:var(--color-ink-mid)] tabular-nums text-[11px]">
              {s.losses}<span className="text-[color:var(--color-ink-soft)] ml-0.5">L</span>
            </span>
            <span className="font-mono text-[color:var(--color-ink-soft)] tabular-nums text-[11px] w-6 text-right">
              {s.draws > 0 ? `${s.draws}D` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
