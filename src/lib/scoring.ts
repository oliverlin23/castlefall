import type { Game, Player } from '../types';

export function computeWinner(game: Game, players: Player[]): number | null {
  if (!game.declaration_type) return null;

  if (game.declaration_type === 'team') {
    const declarerId = game.declaration_player_id;
    const declarer = players.find((p) => p.id === declarerId);
    if (!declarer || !declarer.team) return null;

    const selectedIds: string[] = game.declaration_data?.selectedPlayers ?? [];
    const declarerTeam = declarer.team;
    const actualTeammates = players
      .filter((p) => p.team === declarerTeam)
      .map((p) => p.id);

    const selectedSet = new Set(selectedIds);
    const actualSet = new Set(actualTeammates);
    const correct =
      selectedSet.size === actualSet.size &&
      [...selectedSet].every((id) => actualSet.has(id));

    return correct ? declarerTeam : (declarerTeam === 1 ? 2 : 1);
  }

  if (game.declaration_type === 'word') {
    const declarerId = game.declaration_player_id;
    const declarer = players.find((p) => p.id === declarerId);
    if (!declarer || !declarer.team) return null;

    const guessedWord = game.declaration_data?.guessedWord;
    const declarerTeam = declarer.team;
    const otherTeam = declarerTeam === 1 ? 2 : 1;
    const otherTeamWord = game.team_words[otherTeam];

    return guessedWord === otherTeamWord ? declarerTeam : otherTeam;
  }

  return null;
}

export interface PlayerScore {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
}

export function computePlayerScores(games: Game[]): PlayerScore[] {
  const scores: Record<string, PlayerScore> = {};

  for (const g of games) {
    const pt = g.player_teams;
    if (!pt || typeof pt !== 'object') continue;

    for (const [playerId, info] of Object.entries(pt)) {
      if (!scores[playerId]) {
        scores[playerId] = { id: playerId, name: info.name, wins: 0, losses: 0, draws: 0 };
      }
      const entry = scores[playerId];
      entry.name = info.name;

      if (g.winner_team == null) {
        entry.draws++;
      } else if (info.team === g.winner_team) {
        entry.wins++;
      } else {
        entry.losses++;
      }
    }
  }

  return Object.values(scores).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}
