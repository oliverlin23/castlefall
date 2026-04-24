import type { Game, Player } from '../../types';

interface ResultsProps {
  game: Game;
  players: Player[];
}

export function TwoRoomsResults({ game, players }: ResultsProps) {
  const winner = game.winner_team;
  const winnerLabel = winner === 1 ? 'Red Team wins' : winner === 2 ? 'Blue Team wins' : 'No winner';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-xl bg-surface-alt border border-border p-5 text-center">
        <div className="text-xs text-text-secondary uppercase tracking-wider">Result</div>
        <div className="text-2xl font-bold mt-1">{winnerLabel}</div>
      </div>

      <div className="rounded-xl bg-surface-alt border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold">All players</h3>
        <ul className="space-y-1.5">
          {players.map((p) => {
            const r = p.role as { room?: string; character?: string; team?: string } | null;
            return (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-text-primary">{p.display_name}</span>
                <span className="text-text-secondary text-xs">
                  {r?.character ?? '—'} · {r?.team ?? '—'} · Room {r?.room?.toUpperCase() ?? '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
