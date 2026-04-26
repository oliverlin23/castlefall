import type { Game, Player } from '../../types';
import { ShieldSprite, BannerStripSprite, CrownSprite } from '../../components/sprites';

interface ResultsProps {
  game: Game;
  players: Player[];
  onReturnToLobby: () => void;
}

export function TwoRoomsResults({ game, players, onReturnToLobby }: ResultsProps) {
  const winner = game.winner_team;
  const winnerLabel = winner === 1 ? 'Crimson Team' : winner === 2 ? 'Blue Team' : null;
  const tone = winner === 1 ? 'team2' : winner === 2 ? 'team1' : 'ink';

  return (
    <div className="space-y-6 animate-fade-in">
      <section>
        <div className="text-center mb-2">
          <span className="section-label">// Final reckoning</span>
        </div>
        {winnerLabel ? (
          <div className="origin-top animate-banner-unfurl">
            <BannerStripSprite tone={tone as 'team1' | 'team2'} className="w-full h-16" />
            <div className="-mt-12 relative z-10 flex flex-col items-center gap-1 text-[color:var(--color-paper-bright)]">
              <CrownSprite tone="gold" className="h-4 w-auto" />
              <p
                className="display-heading text-[26px] sm:text-[32px] leading-none drop-shadow-[1px_1px_0_var(--color-ink)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {winnerLabel} prevails
              </p>
            </div>
          </div>
        ) : (
          <div className="parchment-card relative z-[1] py-6 text-center">
            <p className="display-heading text-[24px] text-[color:var(--color-ink-mid)]">No winner</p>
          </div>
        )}
      </section>

      <section className="ink-card p-5 space-y-3">
        <span className="section-label">// All players revealed</span>
        <ul className="border border-[color:var(--color-ink)] divide-y divide-[color:var(--color-ink)]/15 bg-[color:var(--color-paper-bright)]">
          {players.map((p) => {
            const r = p.role as { room?: string; character?: string; team?: string } | null;
            const teamTone = r?.team === 'red' ? 'team2' : r?.team === 'blue' ? 'team1' : 'ink';
            const teamColor =
              r?.team === 'red'
                ? 'text-[color:var(--color-team2)]'
                : r?.team === 'blue'
                  ? 'text-[color:var(--color-team1)]'
                  : 'text-[color:var(--color-ink-mid)]';
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <ShieldSprite className="h-5 w-auto shrink-0" tone={teamTone as 'team1' | 'team2' | 'ink'} />
                <span className="flex-1 text-[13px] font-medium text-[color:var(--color-ink)] truncate">
                  {p.display_name}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${teamColor}`}>
                  {r?.character ?? '—'} · Room {r?.room?.toUpperCase() ?? '—'}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <button onClick={onReturnToLobby} className="btn-seal w-full !py-3.5">
        Back to lobby
      </button>
    </div>
  );
}
