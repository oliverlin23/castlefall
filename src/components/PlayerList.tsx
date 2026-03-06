import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  showTeams?: boolean;
  onKick?: (playerId: string) => void;
}

const avatarColors = [
  'bg-accent',
  'bg-team1',
  'bg-team2',
  'bg-highlight',
  'bg-accent-hover',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export function PlayerList({ players, currentPlayerId, showTeams, onKick }: PlayerListProps) {
  const teamColors: Record<number, string> = {
    1: 'text-team1',
    2: 'text-team2',
  };

  return (
    <div className="space-y-0.5">
      {players.map((player) => {
        const isSelf = player.id === currentPlayerId;
        const teamClass = showTeams && player.team ? teamColors[player.team] ?? '' : '';
        const initial = player.display_name.charAt(0).toUpperCase();
        return (
          <div
            key={player.id}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-surface-hover ${
              isSelf ? 'bg-surface-hover' : ''
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
              showTeams && player.team ? (player.team === 1 ? 'bg-team1' : 'bg-team2') : getAvatarColor(player.display_name)
            }`}>
              {initial}
            </div>
            <span className={`text-sm font-medium flex-1 min-w-0 truncate ${teamClass}`}>
              {player.display_name}
            </span>
            {isSelf && (
              <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-medium">
                you
              </span>
            )}
            {showTeams && player.team && (
              <span className={`text-xs font-mono ${teamClass}`}>
                Team {player.team}
                {player.assigned_word && (
                  <span className="ml-1.5 font-semibold">-- {player.assigned_word}</span>
                )}
              </span>
            )}
            {onKick && !isSelf && (
              <button
                onClick={() => onKick(player.id)}
                className="opacity-0 group-hover:opacity-100 rounded-md p-0.5 text-text-secondary hover:text-team2 transition-opacity"
                title={`Kick ${player.display_name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
