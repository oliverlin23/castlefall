import type { Player } from '../types';
import { PennantSprite } from './sprites';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  showTeams?: boolean;
  onKick?: (playerId: string) => void;
}

const PENNANT_TONES = ['gold', 'team1', 'team2', 'violet', 'moss', 'seal'] as const;

function pennantTone(name: string): (typeof PENNANT_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PENNANT_TONES[Math.abs(hash) % PENNANT_TONES.length];
}

export function PlayerList({ players, currentPlayerId, showTeams, onKick }: PlayerListProps) {
  return (
    <ul className="divide-y divide-[color:var(--color-ink)]/15 border border-[color:var(--color-ink)] bg-[color:var(--color-paper-bright)]">
      {players.map((player, idx) => {
        const isSelf = player.id === currentPlayerId;
        const teamTone = showTeams && player.team === 1
          ? 'team1'
          : showTeams && player.team === 2
            ? 'team2'
            : pennantTone(player.display_name);
        const teamLabel = showTeams && player.team
          ? player.team === 1 ? 'Blue' : 'Crimson'
          : null;
        const teamColorClass = showTeams && player.team === 1
          ? 'text-[color:var(--color-team1)]'
          : showTeams && player.team === 2
            ? 'text-[color:var(--color-team2)]'
            : '';

        return (
          <li
            key={player.id}
            className={`group flex items-center gap-3 px-3 py-2 ${
              isSelf ? 'bg-[color:var(--color-banner-gold-soft)]/30' : ''
            }`}
          >
            <span className="font-mono text-[10px] text-[color:var(--color-ink-soft)] w-5 tabular-nums">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <PennantSprite className="h-4 w-4 shrink-0" tone={teamTone} />
            <span className={`text-[13px] font-medium flex-1 min-w-0 truncate text-[color:var(--color-ink)] ${teamColorClass}`}>
              {player.display_name}
            </span>
            {isSelf && (
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-ink-mid)] border border-[color:var(--color-ink)] bg-[color:var(--color-paper)] px-1.5 py-0.5">
                you
              </span>
            )}
            {showTeams && player.team && (
              <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${teamColorClass}`}>
                {teamLabel}
                {player.assigned_word && (
                  <span className="ml-1.5 font-semibold normal-case">· {player.assigned_word}</span>
                )}
              </span>
            )}
            {onKick && !isSelf && (
              <button
                onClick={() => onKick(player.id)}
                className="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-team2)] transition-opacity"
                title={`Banish ${player.display_name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
