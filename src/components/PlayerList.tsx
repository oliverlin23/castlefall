import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  showTeams?: boolean;
}

export function PlayerList({ players, currentPlayerId, showTeams }: PlayerListProps) {
  const teamColors: Record<number, string> = {
    1: 'text-team1',
    2: 'text-team2',
  };

  return (
    <div className="space-y-1">
      {players.map((player) => {
        const isSelf = player.id === currentPlayerId;
        const teamClass = showTeams && player.team ? teamColors[player.team] ?? '' : '';
        return (
          <div
            key={player.id}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
              isSelf ? 'bg-surface-hover' : ''
            }`}
          >
            <span className={`text-sm font-medium ${teamClass}`}>
              {player.display_name}
              {isSelf && (
                <span className="ml-1 text-xs text-text-secondary">(you)</span>
              )}
            </span>
            {showTeams && player.team && (
              <span className={`ml-auto text-xs font-mono ${teamClass}`}>
                Team {player.team}
                {player.assigned_word && (
                  <span className="ml-2 font-semibold">— {player.assigned_word}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
