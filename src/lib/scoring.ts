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

export interface ScoreboardData {
  team1Wins: number;
  team2Wins: number;
  draws: number;
}

export function computeScoreboard(games: Game[]): ScoreboardData {
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;

  for (const g of games) {
    if (g.winner_team === 1) team1Wins++;
    else if (g.winner_team === 2) team2Wins++;
    else draws++;
  }

  return { team1Wins, team2Wins, draws };
}
